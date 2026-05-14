# 🚲 Bike Angels Optimizer

Real-time Citibike Bike Angels route optimizer. Finds the best station clusters near you based on live point values.

## How it works

- Pulls real Bike Angels point data from Citibike's private layer API
- Clusters nearby stations by walkable distance
- Ranks clusters by total point opportunity
- Auto-refreshes every 60 seconds

## Setup

### Prerequisites
- Node.js 18+

### Install & run

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

### Development (auto-reload)

```bash
npm run dev
```

## Architecture

```
bike-angels/
├── server/
│   └── index.js        # Express server + proxy to Citibike layer API
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js       # Map, clustering, UI logic
└── package.json
```

## Why a backend proxy?

The Citibike layer API (`layer.bicyclesharing.net`) doesn't include CORS headers, so browsers block direct requests from frontend JS. The Express server acts as a thin proxy — it fetches the data server-side and returns it to the frontend.

## Data sources

| Source | Data | Auth required |
|--------|------|---------------|
| `layer.bicyclesharing.net/map/v1/nyc/stations` | Real Bike Angels points, bike/dock counts | None |
| `gbfs.citibikenyc.com` | Station info, status (fallback) | None |

## Deployment

Works on any Node.js host — Railway, Render, Fly.io, or a VPS.

```bash
# Set PORT env var if needed (default: 3000)
PORT=8080 npm start
```

## Roadmap

- [ ] Route drawing between cluster stations
- [ ] Point history / session tracker
- [ ] Push notifications for high-value nearby stations
- [ ] iOS/Android PWA wrapper
- [ ] User accounts + leaderboard
