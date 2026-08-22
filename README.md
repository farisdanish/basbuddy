# BasBuddy

> **Unofficial** RapidKL bus tracker — live vehicle positions + estimated arrival times for your favourite stops and routes.  
> Not affiliated with, endorsed by, or connected to Prasarana / Rapid Bus / Rapid KL.

[![Data: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-blue)](https://creativecommons.org/licenses/by/4.0/)
[![Data source: data.gov.my](https://img.shields.io/badge/Source-data.gov.my-green)](https://api.data.gov.my)

---

## ⚠️ Disclaimer

- **Unofficial tool.** BasBuddy is an independent personal project and is **not affiliated with, endorsed by, or connected to** Prasarana, RapidKL, or any government agency.
- **Estimates only.** Arrival times are computed estimates, not official guarantees. Actual bus arrivals may differ.
- **Data attribution.** Transit data is sourced from [data.gov.my](https://data.gov.my) and provided by Prasarana, licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) under the [Malaysian Government Open Data Terms of Use 1.0](https://www.data.gov.my/p/pekeliling-data-terbuka).

---

## Project Structure (Monorepo)

```
basbuddy/
├── packages/
│   ├── shared/       — shared TypeScript types (API contracts, GTFS types)
│   ├── ingestion/    — M1: static GTFS download + Postgres upsert script
│   ├── poller/       — M2: GTFS-RT realtime poller + ETA engine → Valkey
│   ├── api/          — M4: Express REST API (reads Valkey + Postgres)
│   └── frontend/     — M5-M6: React + Vite PWA (map, stop sheet, favourites)
├── docker/           — Dockerfiles per service
├── migrations/       — SQL schema migrations (node-pg-migrate)
├── docs/             — Architecture docs, API spec
├── .env.example      — environment variable template
└── docker-compose.yml
```

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Node.js 20 + Express + TypeScript |
| Static data | PostgreSQL (GTFS tables) |
| Realtime cache | Valkey (Redis-compatible) |
| GTFS-RT parsing | `gtfs-realtime-bindings` |
| Frontend | React 18 + Vite + TypeScript |
| Map | react-leaflet |
| UI components | shadcn/ui (Radix + Tailwind) + Vaul |

## Quick Start

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (running locally or via Docker)
- Valkey / Redis (running locally or via Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Postgres/Valkey connection details
```

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Run the ingestion script (M1)

```bash
npm run ingest
# Downloads GTFS static feed from data.gov.my, parses, and upserts into Postgres
# Expected: routes, stops, trips, stop_times, shapes, calendar row counts logged
```

### 5. Start the realtime poller (M2)

```bash
npm run poller
# Polls GTFS-RT every 30s, computes ETAs, writes to Valkey
```

### 6. Start the API server (M4)

```bash
npm run api
# Default: http://localhost:3001
```

### 7. Start the frontend (M5)

```bash
npm run frontend
# Default: http://localhost:5173
```

### 8. Run unit test suite

```bash
npm test
# Runs Vitest tests for GTFS parsers and Poller/ETA engine
```

---

## Production Architecture & Deployment

BasBuddy is designed to run on any Linux host with minimal operational overhead:

- **Reverse Proxy & TLS**: Caddy reverse proxy routing `/api/*` to the Express backend (`:3001`) and serving the built Vite PWA static bundle for frontend requests with automatic HTTPS.
- **Service Management**: Systemd daemon units for process isolation and auto-restart on failure:
  - `basbuddy-api.service`: Stateless REST API server reading from Valkey & Postgres.
  - `basbuddy-poller.service`: Single-instance GTFS-RT poller running continuous 30s drift-corrected cycles.
  - `basbuddy-ingest.timer` / `.service`: Scheduled daily cron updating static GTFS schedule feeds.
- **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml` & `deploy.yml`) running automated typechecks, unit tests, and Playwright E2E smoke tests before automated deployment.

---

## Milestones

| # | Scope | Status |
|---|---|---|
| M1 | Ingestion script — static GTFS → Postgres upsert pipeline | ✅ Complete |
| M2 | Poller & Valkey cache — GTFS-RT 30s poller + vehicle-to-shape ETA engine | ✅ Complete |
| M3 | CI/CD & Deployment — GitHub Actions automated deployment pipeline, systemd units, Caddy reverse proxy | ✅ Complete & Live |
| M4 | REST API — Express endpoints (`/routes`, `/stops/:id/etas`, `/stops/near`, etc.) | ✅ Complete |
| M5 | Frontend Shell — React 18 + Vite PWA + Leaflet map container + Golden Hour theme | 🟡 Next |
| M6 | Frontend Live Tracking — Live bus markers, StopBottomSheet, favourites, signal-lost UI | 🔲 Planned |


---

## Data Source & Attribution

Transit data is provided by **Prasarana** via **[data.gov.my](https://api.data.gov.my)**.  
Licensed under **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)** under the **[Malaysian Government Open Data Terms of Use 1.0](https://www.data.gov.my/p/pekeliling-data-terbuka)**.

The data owner provides no guarantee of data accuracy, completeness, or availability.
