# Event Edge – Prediction Market Dashboard

Scans prediction markets and flags potentially mispriced events using a composite **dislocation score** based on price change, spread, liquidity, and volume signals.

## Tech Stack

| Layer      | Tool                        |
| ---------- | --------------------------- |
| Framework  | Next.js 14 (App Router)     |
| Language   | TypeScript                  |
| Styling    | Tailwind CSS                |
| Database   | PostgreSQL                  |
| ORM        | Prisma                      |

---

## Quick Start

### 1. Prerequisites

- **Node.js** >= 18
- **PostgreSQL** running locally (or a remote connection string)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL
# Default: postgresql://postgres:postgres@localhost:5432/event_edge?schema=public
```

### 4. Create the database and generate Prisma client

```bash
npx prisma db push      # Creates tables from the schema
npx prisma generate      # Generates the typed client
```

### 5. Seed sample data

```bash
npm run db:seed
```

This inserts 12 realistic prediction markets with historical snapshots and computes initial dislocation scores.

### 6. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** to view the dashboard.

---

## Project Structure

```
prisma/
  schema.prisma         Database models (Market, Snapshot)
  seed.ts               Sample data seeder

src/
  app/
    layout.tsx           Root layout with nav bar
    page.tsx             Home page - all markets grid
    globals.css          Tailwind imports + base styles
    flagged/
      page.tsx           Flagged opportunities (score >= 40)
    markets/
      [id]/
        page.tsx         Market detail + snapshot chart
    components/
      MarketCard.tsx     Reusable market card
      CategoryFilter.tsx Category pill filter
      SortSelect.tsx     Sort dropdown
      SnapshotChart.tsx  CSS bar chart for price history
    api/
      markets/
        route.ts         GET /api/markets (list + filter)
        [id]/
          route.ts       GET /api/markets/:id (detail)
      cron/
        route.ts         GET /api/cron (simulate refresh)
  lib/
    prisma.ts            Prisma client singleton
    dislocation.ts       Dislocation score algorithm
    format.ts            Display formatting helpers

.env.example             Environment template
tailwind.config.ts       Tailwind configuration
tsconfig.json            TypeScript config
next.config.js           Next.js config
```

---

## API Routes

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/markets`      | List markets. Query: `category`, `sort`, `active` |
| GET    | `/api/markets/:id`  | Single market with snapshot history      |
| GET    | `/api/cron`         | Simulate price update and recalculate scores |

---

## Dislocation Score

A 0-100 composite score combining four signals:

| Signal                  | Weight | Max trigger          |
| ----------------------- | ------ | -------------------- |
| Rapid probability change | 30     | >= 15c move          |
| Wide spread             | 25     | >= 10c spread        |
| Thin liquidity          | 25     | Below market average  |
| Unusual volume          | 20     | >= 4x market average  |

Higher score = more likely mispricing opportunity.

---

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:seed      # Re-seed sample data
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:reset     # Drop all tables, recreate, and re-seed
```

---

## Phase 1 Scope

This is intentionally minimal:

- Sample/simulated data (no live Polymarket API yet)
- No authentication
- No auto-trading
- No ML models
- Simple CSS bar chart instead of a charting library

Future phases can add live data ingestion, real-time WebSocket updates, alerting, and more sophisticated models.
