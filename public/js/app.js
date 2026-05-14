// Bike Angels Optimizer — frontend app
// Expects a backend at /api/stations that proxies layer.bicyclesharing.net

const API_URL = '/api/stations';
const REFRESH_INTERVAL = 60 * 1000; // auto-refresh every 60s

let map, userLat = 40.7549, userLon = -73.9840;
let allStations = [], markers = [], userMarker = null;
let selectedClusterIdx = null;
let radiusBlocks = 6;
let refreshTimer = null;

// ─── Map ────────────────────────────────────────────────────────────────────

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false })
    .setView([userLat, userLon], 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);
}

// ─── Geo helpers ─────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function blocksToMeters(b) { return b * 80; }

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadStations() {
  setStatus('Fetching live Bike Angels data...');
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const { stations, updated } = await res.json();
    allStations = stations;
    const ts = new Date(updated);
    document.getElementById('last-updated').textContent = 'Updated ' + ts.toLocaleTimeString();
    setStatus(`${stations.length} stations loaded · real point values`);
  } catch (err) {
    console.warn('API fetch failed:', err.message);
    setStatus('Could not reach server. Make sure the backend is running.');
    return;
  }
  selectedClusterIdx = null;
  renderMap();
  renderClusters();
  scheduleRefresh();
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadStations, REFRESH_INTERVAL);
}

// ─── Map rendering ────────────────────────────────────────────────────────────

function pointColor(action) {
  if (action === 'give') return '#1D9E75';
  if (action === 'take') return '#E24B4A';
  return '#EF9F27';
}

function renderMap() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const radiusM = blocksToMeters(radiusBlocks);
  const nearby = allStations.filter(s =>
    haversine(userLat, userLon, s.lat, s.lon) <= radiusM
  );

  nearby.forEach(s => {
    const r = 5 + Math.abs(s.pts) * 2;
    const color = pointColor(s.action);
    const ptsLabel = s.pts > 0 ? `+${s.pts}` : String(s.pts);
    const circle = L.circleMarker([s.lat, s.lon], {
      radius: r,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      fillOpacity: 0.88
    }).addTo(map);
    circle.bindTooltip(
      `<b>${s.name}</b><br>${ptsLabel} pts · ${s.bikes_available} bikes / ${s.docks_available} docks`,
      { direction: 'top' }
    );
    markers.push(circle);
  });

  // User location dot
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.circleMarker([userLat, userLon], {
    radius: 9, fillColor: '#185FA5', color: '#fff', weight: 2.5, fillOpacity: 1
  }).bindTooltip('You').addTo(map);
}

// ─── Cluster logic ────────────────────────────────────────────────────────────

function findClusters() {
  const radiusM = blocksToMeters(radiusBlocks);
  const clusterRadius = blocksToMeters(4); // ~320m — walkable loop

  const nearby = allStations.filter(s =>
    haversine(userLat, userLon, s.lat, s.lon) <= radiusM && s.pts !== 0
  );

  const clusters = [];
  const used = new Set();

  // Seed from highest-value stations outward
  nearby.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));

  nearby.forEach(seed => {
    if (used.has(seed.id)) return;
    const members = nearby.filter(s =>
      haversine(seed.lat, seed.lon, s.lat, s.lon) <= clusterRadius && !used.has(s.id)
    );
    if (members.length >= 2) {
      const totalPts = members.reduce((sum, s) => sum + Math.abs(s.pts), 0);
      const distFromUser = Math.round(haversine(userLat, userLon, seed.lat, seed.lon));
      clusters.push({ seed, members, totalPts, distFromUser });
      members.forEach(s => used.add(s.id));
    }
  });

  return clusters.sort((a, b) => b.totalPts - a.totalPts).slice(0, 5);
}

// ─── UI rendering ─────────────────────────────────────────────────────────────

function renderClusters() {
  const clusters = findClusters();
  const list = document.getElementById('cluster-list');

  if (!clusters.length) {
    list.innerHTML = '<p class="empty">No clusters found. Try a wider radius.</p>';
    return;
  }

  list.innerHTML = clusters.map((c, i) => `
    <div class="cluster-item${selectedClusterIdx === i ? ' active' : ''}" data-idx="${i}">
      <div class="cluster-row">
        <span class="cluster-name">${c.seed.name.split('&')[0].trim()} area</span>
        <span class="cluster-pts">+${c.totalPts} pts</span>
      </div>
      <div class="cluster-meta">${c.members.length} stations · ${c.distFromUser}m away</div>
    </div>
  `).join('');

  list.querySelectorAll('.cluster-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedClusterIdx = parseInt(el.dataset.idx);
      renderClusters();
      renderStations(clusters[selectedClusterIdx].members);
      const c = clusters[selectedClusterIdx];
      map.setView([c.seed.lat, c.seed.lon], 16);
    });
  });

  // Auto-select best cluster on first load
  if (selectedClusterIdx === null) {
    selectedClusterIdx = 0;
    renderStations(clusters[0].members);
  }
}

function renderStations(stations) {
  const list = document.getElementById('station-list');
  const sorted = [...stations].sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));

  list.innerHTML = sorted.map(s => {
    const cls = s.pts > 0 ? 'pt-pos' : s.pts < 0 ? 'pt-neg' : 'pt-zero';
    const label = s.pts > 0 ? `+${s.pts}` : String(s.pts);
    const action = s.action === 'give' ? '↑ pick up' : s.action === 'take' ? '↓ drop off' : 'neutral';
    return `
      <div class="station-row">
        <span class="pt-badge ${cls}">${label}</span>
        <span class="sname">
          ${s.name}
          <span class="saction">${action}</span>
        </span>
        <span class="savail">${s.bikes_available}🚲 ${s.docks_available}🅿</span>
      </div>`;
  }).join('');
}

function setStatus(msg) {
  document.getElementById('status-text').textContent = msg;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('radius').addEventListener('input', function () {
  radiusBlocks = parseInt(this.value);
  document.getElementById('radius-val').textContent = `${radiusBlocks} blocks`;
  selectedClusterIdx = null;
  renderMap();
  renderClusters();
});

document.getElementById('locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation not supported in this browser.');
    return;
  }
  setStatus('Getting your location...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      map.setView([userLat, userLon], 15);
      selectedClusterIdx = null;
      renderMap();
      renderClusters();
      setStatus(`Location found · clusters within ${radiusBlocks} blocks`);
    },
    () => setStatus('Location access denied. Using Midtown Manhattan.')
  );
});

document.getElementById('refresh-btn').addEventListener('click', () => {
  selectedClusterIdx = null;
  loadStations();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

initMap();
loadStations();
