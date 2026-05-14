const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
const GBFS_INFO = 'https://gbfs.citibikenyc.com/gbfs/en/station_information.json';
const GBFS_STATUS = 'https://gbfs.citibikenyc.com/gbfs/en/station_status.json';
function inferPoints(bikes, capacity) {
  const pct = bikes / (capacity || 1);
  if (pct >= 0.9) return { pts: 3, action: 'give' };
  if (pct >= 0.75) return { pts: 2, action: 'give' };
  if (pct >= 0.6) return { pts: 1, action: 'give' };
  if (pct <= 0.1) return { pts: -3, action: 'take' };
  if (pct <= 0.25) return { pts: -2, action: 'take' };
  if (pct <= 0.4) return { pts: -1, action: 'take' };
  return { pts: 0, action: 'neutral' };
}
app.get('/api/stations', async (req, res) => {
  try {
    const [infoRes, statusRes] = await Promise.all([fetch(GBFS_INFO), fetch(GBFS_STATUS)]);
    const infoData = await infoRes.json();
    const statusData = await statusRes.json();
    const statusMap = {};
    statusData.data.stations.forEach(s => { statusMap[s.station_id] = s; });
    const stations = infoData.data.stations.map(s => {
      const st = statusMap[s.station_id] || {};
      const bikes = st.num_bikes_available || 0;
      const docks = st.num_docks_available || 0;
      const capacity = s.capacity || (bikes + docks) || 1;
      const { pts, action } = inferPoints(bikes, capacity);
      return { id: s.station_id, name: s.name, lat: s.lat, lon: s.lon, bikes_available: bikes, docks_available: docks, capacity, pts, action };
    }).filter(s => s.capacity > 0);
    res.json({ stations, updated: Date.now(), source: 'gbfs' });
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch station data' });
  }
});
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.listen(PORT, () => console.log(`Bike Angels running on port ${PORT}`));
