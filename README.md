# Event Edge – Prediction Market Dashboard

Scans prediction markets and flags potentially mispriced events using a composite **dislocation score** based on price change, spread, liquidity, and volume signals. Groups related markets into **event clusters** to detect cross-market inconsistencies.

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

This inserts 20 prediction markets, 5 event clusters, historical snapshots, dislocation scores, and cluster signals.

### 6. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** to view the dashboard.

---

## Project Structure

```
prisma/
  schema.prisma             Database models
  seed.ts                   Sample data seeder (markets + clusters)

src/
  app/
    layout.tsx              Root layout with nav bar
    page.tsx                Home page - all markets grid
    globals.css             Tailwind imports + base styles
    markets/
      page.tsx              /markets - re-exports homepage
      [id]/
        page.tsx            Market detail + snapshot chart
    clusters/
      page.tsx              /clusters - all clusters grid
      [id]/
        page.tsx            Cluster detail + probability bars + signals
    flagged/
      page.tsx              Flagged opportunities (dislocation >= 40)
    components/
      MarketCard.tsx        Reusable market card
      ClusterCard.tsx       Reusable cluster card
      SignalBadge.tsx       Severity-colored signal display
      CategoryFilter.tsx    Category pill filter
      SortSelect.tsx        Sort dropdown
      SnapshotChart.tsx     CSS bar chart for price history
    api/
      markets/
        route.ts            GET /api/markets (list + filter)
        [id]/
          route.ts          GET /api/markets/:id (detail)
      clusters/
        route.ts            GET /api/clusters (list + filter)
        [id]/
          route.ts          GET /api/clusters/:id (detail)
      cron/
        route.ts            GET /api/cron (refresh all data)
  lib/
    prisma.ts               Prisma client singleton
    types.ts                Shared TypeScript interfaces
    dislocation.ts          Per-market dislocation score algorithm
    cluster-analytics.ts    Cluster-level analytics computation
    cluster-signals.ts      Rules-based signal detection engine
    format.ts               Display formatting helpers

.env.example                Environment template
tailwind.config.ts          Tailwind configuration
tsconfig.json               TypeScript config
next.config.js              Next.js config
```

---

## Database Schema

### Phase 1 tables

| Table      | Purpose                                           |
| ---------- | ------------------------------------------------- |
| Market     | One prediction market question with latest prices |
| Snapshot   | Point-in-time price/volume capture for a market   |

### Phase 2 tables

| Table         | Purpose                                                 |
| ------------- | ------------------------------------------------------- |
| Cluster       | A thematic group of related markets with computed scores |
| ClusterMarket | Join table linking markets to clusters (many-to-many)    |
| ClusterSignal | A flagged signal on a cluster with type and severity     |

---

## API Routes

| Method | Path                 | Description                                        |
| ------ | -------------------- | -------------------------------------------------- |
| GET    | `/api/markets`       | List markets. Query: `category`, `sort`, `active`  |
| GET    | `/api/markets/:id`   | Single market with snapshot history                |
| GET    | `/api/clusters`      | List clusters. Query: `theme`, `sort`              |
| GET    | `/api/clusters/:id`  | Single cluster with member markets and signals     |
| GET    | `/api/cron`          | Simulate price update, recalculate all scores      |

---

## Dislocation Score (per market)

A 0-100 composite score combining four signals:

| Signal                   | Weight | Max trigger          |
| ------------------------ | ------ | -------------------- |
| Rapid probability change | 30     | >= 15c move          |
| Wide spread              | 25     | >= 10c spread        |
| Thin liquidity           | 25     | Below market average  |
| Unusual volume           | 20     | >= 4x market average  |

Higher score = more likely mispricing opportunity.

---

## Event Clusters (Phase 2)

Clusters group related prediction markets by theme (crypto, rates, elections, geopolitics, technology). Each cluster computes five analytics scores:

| Score                  | What it measures                                           |
| ---------------------- | ---------------------------------------------------------- |
| avgProbability         | Mean YES price across member markets                       |
| probabilityDispersion  | Standard deviation of YES prices                           |
| inconsistencyScore     | 0-100 — how much members disagree (dispersion vs max)      |
| divergenceScore        | 0-100 — avg dislocation (60%) + dislocation spread (40%)   |
| confidenceScore        | 0-100 — member count (30%) + liquidity (40%) + spreads (30%) |

### Signal Engine

A rules-based engine flags clusters when interesting patterns appear. No ML — every signal has a plain-English explanation.

| Signal            | Triggers when                                              |
| ----------------- | ---------------------------------------------------------- |
| Disagreement      | Related markets have 30c+ price range                      |
| Reprice Lag       | One member's dislocation is 20+ points above cluster avg   |
| Thin Liquidity    | Any member has < $500K liquidity                           |
| Unusual Activity  | Avg 24h volume exceeds 30% of avg liquidity                |

Each signal has a severity (low / medium / high) and a human-readable message explaining why it fired.

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

## Scope

Phase 1 and Phase 2 are complete. The project intentionally does not include:

- Live API ingestion (uses simulated/seed data)
- Authentication
- Auto-trading or execution
- ML models
- Real-time WebSocket updates
