# BasBuddy

> **High-performance RapidKL bus tracking & live arrival estimates for Klang Valley commuters.**  
> Powered by open transit data from `data.gov.my` and Prasarana.

[![Data: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-blue)](https://creativecommons.org/licenses/by/4.0/)
[![Data source: data.gov.my](https://img.shields.io/badge/Source-data.gov.my-green)](https://api.data.gov.my)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview & Mission

BasBuddy is an independent, mobile-first transit tracker designed to solve the daily uncertainty of bus commuting across Greater Kuala Lumpur and the Klang Valley. By bridging real-time GTFS Realtime vehicle positions with static GTFS schedules, BasBuddy provides fast, accurate arrival countdowns, live vehicle maps, and transparent data freshness indicators.

### Key Capabilities

- **Live Vehicle Tracking**: Interactive full-screen map rendering real-time bus positions with directional heading arrows and GPS signal pulse indicators.
- **Instant Arrival Estimates (ETAs)**: Sub-millisecond stop arrival countdowns served directly from high-speed cache, calculated via polyline projection and schedule reconciliation.
- **Transparent Data Freshness**: Clear visual badges differentiating active real-time GPS telemetry from static timetable estimates, with automatic degraded feed detection.
- **Commuter-First Interaction**: Gesture-driven bottom sheets, one-tap favorite stops tray, nearby stop geolocation discovery, and instant debounced search.
- **Progressive Web App (PWA)**: Installable application with offline app shell caching and responsive daylight-optimized design tokens.

---

## ⚠️ Disclaimer

- **Unofficial tool.** BasBuddy is an independent project and is **not affiliated with, endorsed by, or connected to** Prasarana Malaysia Berhad, Rapid Bus Sdn Bhd, RapidKL, or any government agency.
- **Estimates only.** Arrival times are computed estimates derived from open telemetry and published timetables; actual road conditions and arrival times may vary.
- **Data attribution.** Transit data is sourced from [data.gov.my](https://data.gov.my) and provided by Prasarana, licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) under the [Malaysian Government Open Data Terms of Use 1.0](https://www.data.gov.my/p/pekeliling-data-terbuka).

---

## 📡 Real-Time Data Coverage & Open API Limitations

BasBuddy strictly mirrors the official open data stream from [`data.gov.my`](https://data.gov.my) without fabricating or guessing bus locations. Commuters and developers should note the following characteristics of the upstream data pipeline:

1. **Open Data vs. Proprietary CAD/AVL Systems**:
   - Prasarana's internal kiosk portal (`myrapidbus.prasarana.com.my`) queries live on-bus transponder hardware directly.
   - `data.gov.my` publishes an open **GTFS Realtime (GTFS-RT)** protobuf stream exported upstream by Prasarana.
2. **Partial Fleet Telemetry in Public Feeds**:
   - At any given time, only buses actively bound to official static GTFS schedule blocks are exported to the public feed.
   - Feeder routes (e.g. MRT/LRT feeder buses), ad-hoc depot dispatches, or buses with unlinked trip blocks may operate on the road and appear on internal hardware portals while being omitted from the public open feed.
3. **Rate Limits & Polling Intervals**:
   - Upstream API rate limits on `data.gov.my` (~4 requests/minute) dictate a single-instance **30-second polling cycle**.
   - GPS telemetry latency is typically 30–60 seconds behind real-world vehicle position.
4. **Vehicle Identification & License Plates**:
   - The public GTFS-RT stream from `data.gov.my` broadcasts vehicle coordinates, bearing, trip IDs, and route numbers.
   - Road vehicle registration plate numbers (e.g., `WXX 1234`) are **omitted by Prasarana** in the open dataset. BasBuddy resolves live buses by mapping active `trip_id` and `route_id` to determine route numbers, destination headsigns, and stop countdowns.
5. **Transparent Fallbacks & Freshness Badging**:
   - **🟢 Live**: Verified real-time GPS telemetry updated within the last 120 seconds.
   - **🟡 Stale**: Telemetry between 120s and 240s old (e.g., GPS tunnel or bridge dropout).
   - **🔴 Signal Lost / Schedule**: If GPS telemetry is unavailable, BasBuddy automatically displays published static timetable departure schedules and explicitly flags the arrival as non-realtime.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ data.gov.my (GTFS-RT protobuf, 30s cycle)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Single-instance fetcher)
                               ▼
                    ┌─────────────────────┐
                    │   packages/poller   │ ──(Reads static trips/shapes)──┐
                    └──────────┬──────────┘                                │
                               │ (SET stop_etas, vehicle, route)           │
                               ▼                                           ▼
┌──────────────────┐   ┌───────────────┐                          ┌─────────────────┐
│ packages/        │──▶│ Valkey /      │                          │ Postgres +      │
│ frontend (React) │   │ Redis Cache   │                          │ PostGIS         │
└────────┬─────────┘   └───────▲───────┘                          └────────┬────────┘
         │ (GET /api)          │                                           │
         ▼                     │ (Cache read)                              │ (Static fallback)
┌──────────────────┐           │                                           │
│  packages/api    │───────────┴───────────────────────────────────────────┘
│  (Express/REST)  │
└──────────────────┘
```

### Monorepo Workspaces (`packages/*`)

- **`@basbuddy/shared`**: Canonical TypeScript interfaces, API response contracts, GTFS types, and cache key definitions.
- **`@basbuddy/ingestion`**: Automated static GTFS feed downloader, parser, and PostgreSQL upsert pipeline.
- **`@basbuddy/poller`**: Drift-corrected GTFS-RT poller, entity decoder, vehicle-to-shape matcher, ETA engine, and Valkey cache writer.
- **`@basbuddy/api`**: Stateless REST API server serving instant cached ETAs with automatic static timetable fallback.
- **`@basbuddy/frontend`**: Mobile-first React + Vite + PWA web client with live Leaflet map tracking, gesture bottom sheets, and search.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Backend & API** | Node.js 20, Express, TypeScript |
| **Static Database** | PostgreSQL + PostGIS (spatial geometry indexing) |
| **Realtime Cache** | Valkey (Redis-compatible high-performance cache) |
| **Telemetry Ingestion** | Protocol Buffers (`gtfs-realtime-bindings`), Streams |
| **Frontend Framework** | React 18, Vite, TypeScript |
| **Mapping & GIS** | Leaflet, React-Leaflet, OpenStreetMap |
| **UI & Styling** | Tailwind CSS, PostCSS, Vaul (drawer), Lucide Icons |
| **Testing & Quality** | Vitest (unit & integration), Playwright (E2E browser testing), ESLint |

---

## Quick Start & Local Development

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose (for local Postgres and Valkey)

### 1. Start Infrastructure & Install Dependencies

```bash
# Start local PostgreSQL and Valkey containers
docker compose up -d

# Install workspace dependencies
npm install

# Build shared types
npm run build
```

### 2. Configure Environment

```bash
cp .env.example .env
# Verify connection strings in .env
```

### 3. Run Database Migrations & Ingest Static GTFS Data

```bash
# Run schema migrations
npm run migrate

# Download and populate static GTFS routes, stops, trips, and shapes
npm run ingest
```

### 4. Start Services

```bash
# Start realtime poller (fetches GTFS-RT every 30s)
npm run poller

# Start Express API server (port 3001)
npm run api

# Start Vite React frontend (port 5173)
npm run frontend
```

### 5. Run Test Suite

```bash
# Run Vitest unit & integration tests
npm test

# Run Playwright E2E browser tests
npm run test:e2e
```

---

## Production Architecture & Deployment

BasBuddy is designed to operate on any Linux host with minimal operational overhead:

- **Reverse Proxy & TLS**: Caddy reverse proxy routing `/api/*` to the Express backend (`:3001`) and serving the built Vite PWA static bundle with automatic HTTPS.
- **Service Isolation**: Systemd daemon units ensuring auto-restart on failure:
  - `basbuddy-api.service`: Stateless REST API server reading from Valkey & Postgres.
  - `basbuddy-poller.service`: Single-instance GTFS-RT poller running continuous 30s drift-corrected cycles.
  - `basbuddy-ingest.timer` / `.service`: Scheduled daily cron updating static GTFS schedule feeds.
- **CI/CD Pipeline**: GitHub Actions running automated TypeScript compilation checks, ESLint verification, Vitest suites, and Playwright browser smoke tests prior to automated zero-downtime deployment.

---

## Data Source & Attribution

Transit data is provided by **Prasarana** via **[data.gov.my](https://api.data.gov.my)**.  
Licensed under **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)** under the **[Malaysian Government Open Data Terms of Use 1.0](https://www.data.gov.my/p/pekeliling-data-terbuka)**.
