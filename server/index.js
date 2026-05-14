const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Proxy endpoint — forwards request to Citibike layer API and returns real point data
app.get('/api/stations', async (req, res) => {
  try {
    const response = await fetch('https://layer.bicyclesharing.net/map/v1/nyc/stations');
    if (!response.ok) throw new Error(`Layer API error: ${response.status}`);
    const data = await response.json();

    // Normalize into a clean flat array
    const stations = data.features.map(f => {
      const p = f.properties;
      const s = p.station;
      const [lon, lat] = f.geometry.coordinates;
      return {
        id: s.id,
        name: s.name,
        lat,
        lon,
        bikes_available: s.bikes_available,
        docks_available: s.docks_available,
        capacity: s.capacity,
        pts: p.bike_angels_points || 0,
        action: p.bike_angels_action || 'neutral', // 'give' | 'take' | 'neutral'
        installed: s.installed,
        renting: s.renting,
        returning: s.returning,
      };
    }).filter(s => s.installed && s.renting);

    res.json({ stations, updated: Date.now() });
  } catch (err) {
    console.error('Station fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch station data', detail: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, () => console.log(`Bike Angels server running on http://localhost:${PORT}`));
