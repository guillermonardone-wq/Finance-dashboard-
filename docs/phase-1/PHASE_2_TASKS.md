# Racing Coach MVP — Phase 2 Engineering Task Breakdown

**Version:** 1.1
**Date:** 2026-03-14 (Revised)

---

## Phase 2 Goal

Build the core pipeline end-to-end: upload sensor data → detect laps → segment corners → analyze driving → generate coaching. A user should be able to upload a real sensor file, pick a track, and receive corner-by-corner coaching feedback.

---

## Task Groups

### Group A: Project Setup (Estimated: 2–3 days) <!-- CHANGED in v1.1: added Redis, object storage, updated estimate -->

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| A1 | Initialize Next.js 14 project with TypeScript, Tailwind, App Router | — | Working `next dev` with hello world page |
| A2 | Set up PostgreSQL + Prisma | A1 | `prisma migrate dev` runs, DB is seeded |
| A3 | Create Prisma schema from DATABASE_SCHEMA.md (v1.1) | A2 | All models created (incl. AnalysisJob, TrackGpsTrace), initial migration |
| A4 | Set up Python analysis worker with Redis consumer | — | Worker connects to Redis, processes test job | <!-- CHANGED in v1.1: worker, not HTTP service -->
| A5 | Docker Compose for all services | A1, A4 | `docker compose up` starts Next.js + Python + PostgreSQL + Redis | <!-- CHANGED in v1.1: +Redis -->
| A6 | Shared types / API contracts | A1, A4 | TypeScript types + Python dataclasses for API request/response |
| A7 | Seed database with 5–10 tracks | A3 | Tracks with corner definitions for Laguna Seca, Watkins Glen, etc. |
| A8 | Set up object storage client (S3-compatible) | A1, A4 | Shared storage module for both Next.js and Python; MinIO for local dev | <!-- ADDED in v1.1 -->
| A9 | Set up Redis + BullMQ | A1 | BullMQ queue configured in Next.js; Python worker reads from same Redis | <!-- ADDED in v1.1 -->

### Group B: Session Management API + UI (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| B1 | Session CRUD API routes | A3 | `POST/GET /api/sessions`, `GET /api/sessions/:id` |
| B2 | Track list API route | A3, A7 | `GET /api/tracks` with corner count, location |
| B3 | Session creation page | B1, B2 | Form: name, date, track selector, car info, conditions |
| B4 | Session list page | B1 | Card grid of sessions with status, track, date, best lap |
| B5 | Session detail page (shell) | B1 | Header with session info, tabs for upload/results |
| B6 | Track CRUD API routes | A3 | `POST /api/tracks`, `POST /api/tracks/:id/corners` | <!-- ADDED in v1.1: Track Builder -->

### Group C: Data Upload Pipeline (Estimated: 2–3 days) <!-- CHANGED in v1.1: saves to object storage -->

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| C1 | File upload API route (sensor data) | A3, A8 | `POST /api/sessions/:id/upload/sensors`, saves to object storage, updates session | <!-- CHANGED in v1.1 -->
| C2 | Sensor data parser + validator | C1 | Parses JSON and CSV formats, validates required fields, reports quality |
| C3 | Upload UI component | B5, C1 | Drag-and-drop with progress bar, format validation, quality preview |
| C4 | Video upload API route | A3, A8 | `POST /api/sessions/:id/upload/video`, saves to object storage | <!-- CHANGED in v1.1 -->
| C5 | Video upload UI component | B5, C4 | File picker with size limit warning, basic preview |

### Group D: Lap Detection (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| D1 | Lap detector module (Python) | A4 | `lap_detector.py` — GPS trace + S/F line → lap boundaries |
| D2 | Line segment intersection algorithm | D1 | Haversine-based GPS line crossing with interpolation |
| D3 | Lap validation + filtering | D1 | Filter pit laps, too-slow laps, wrong-direction crossings |
| D4 | Unit tests with synthetic GPS data | D1 | Tests for: clean crossings, noisy GPS, pit lane, edge cases |
| D5 | Integration test with real track data | D1, A7 | Test with actual sensor exports from Laguna Seca or similar |

### Group E: Corner Segmentation (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| E1 | Corner segmenter module (Python) | A4, D1 | `corner_segmenter.py` — GPS trace + corner defs → segments |
| E2 | Pre-defined corner matching | E1, A7 | Map GPS samples to nearest corner zone using track definitions |
| E3 | Auto-detect fallback (curvature-based) | E1 | Curvature analysis for tracks without pre-defined corners |
| E4 | Segment merging + cleanup | E1 | Merge tiny segments, handle transitions between corners |
| E5 | Unit tests for segmentation | E1 | Tests for: clean track, noisy GPS, different track types |

### Group F: Behavior Analysis (Estimated: 3–4 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| F1 | Behavior analyzer module (Python) | A4, E1 | `behavior_analyzer.py` — sensor data + segments → per-corner metrics |
| F2 | Speed calculation from GPS | F1 | Doppler-preferred speed with fallback to position-derived |
| F3 | Braking zone detection | F1 | Longitudinal decel threshold → braking onset + distance |
| F4 | Apex timing analysis | F1 | Min-speed point vs geometric apex comparison |
| F5 | Corner exit quality scoring | F1 | Speed gain rate + lateral G decay pattern |
| F6 | Cross-lap comparison | F1, D1 | Delta calculation: each corner vs driver's best |
| F7 | Confidence scoring | F1 | Per-metric confidence based on data quality + sensor agreement |
| F8 | Kalman filter for GPS/IMU fusion | F1 | Optional: improve position + speed estimates by fusing sensors |
| F9 | Unit tests for analysis | F1 | Tests for each metric calculation with known-good data |

### Group G: Coaching + Audio Generation (Estimated: 3–4 days) <!-- CHANGED in v1.1: added TTS, clarified Claude boundary, updated estimate -->

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| G1 | Structured findings builder (Python) | F1 | Build per-corner structured JSON findings from raw analysis metrics — Claude receives this, NOT raw telemetry | <!-- CHANGED in v1.1 -->
| G2 | Claude API prompt engineering | G1 | Coaching prompt template; Claude converts structured findings → natural language | <!-- CHANGED in v1.1 -->
| G3 | Corner-by-corner coaching output | G2 | Per-corner text with measured vs inferred labels + confidence |
| G4 | Top 3 improvements ranking | G1 | Rank corners by time lost, generate specific suggestions |
| G5 | Audio script generation | G3, G4 | Concise script suitable for TTS |
| G6 | Server-side TTS audio generation | G5, A8 | Call TTS API (OpenAI/ElevenLabs), save MP3 to object storage, store URL in DB | <!-- ADDED in v1.1 -->
| G7 | Coaching result storage | G3, G6 | Save coaching text + audio storage key to PostgreSQL |
| G8 | Prompt tuning with real data | G2 | Iterate prompt with actual analysis outputs |

### Group H: Analysis Pipeline Orchestration (Estimated: 2–3 days) <!-- CHANGED in v1.1: Redis queue, updated estimate -->

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| H1 | Full pipeline entrypoint (Python worker) | D1, E1, F1, G1 | Redis job consumer that runs all analysis stages sequentially | <!-- CHANGED in v1.1 -->
| H2 | Progress tracking via Redis | H1, A9 | Worker updates Redis hash with stage + percent; Next.js reads it | <!-- CHANGED in v1.1 -->
| H3 | Error handling + partial results + retry | H1 | Graceful failure: if coaching fails, still show raw analysis; BullMQ auto-retry on crash | <!-- CHANGED in v1.1 -->
| H4 | Analysis trigger API route | A9 | `POST /api/sessions/:id/analyze` enqueues BullMQ job, creates AnalysisJob record, returns 202 | <!-- CHANGED in v1.1 -->
| H5 | Analysis status polling API | H4 | `GET /api/sessions/:id/analysis` reads job progress from Redis + results from DB |

### Group I: Results UI (Estimated: 4–5 days) <!-- CHANGED in v1.1: added Track Builder UI, promoted lap comparison, server audio, updated estimate -->

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| I1 | Lap list component | H5 | Table of laps with times, validity, best-lap highlight |
| I2 | Track map with GPS overlay | H5 | Canvas/SVG map showing GPS trace colored by speed or lateral G |
| I3 | Corner-by-corner coaching cards | H5 | Expandable cards per corner with coaching text, metrics, confidence |
| I4 | Top 3 improvements panel | H5 | Prominent display of highest-impact suggestions |
| I5 | Session summary header | H5 | Best lap, total laps, data quality, overall coaching summary |
| I6 | Audio recap player | G6 | HTML5 audio player for server-generated MP3; play/pause/download | <!-- CHANGED in v1.1: server MP3, not browser TTS -->
| I7 | Sensor data graphs | H5 | Speed, lateral G, longitudinal G vs distance/time charts |
| I8 | Lap comparison view | I1, I7 | Compare any lap vs best: entry speed, min speed, exit accel, time delta per corner; overlay GPS traces | <!-- CHANGED in v1.1: promoted to P0, expanded scope -->
| I9 | Track Builder UI | B6, I2 | Upload GPS trace, interactive map to define S/F line and corner entry/apex/exit points, save track | <!-- ADDED in v1.1 -->
| I10 | Analysis progress indicator | H2 | Real-time progress bar showing current analysis stage (from Redis polling) | <!-- ADDED in v1.1 -->

### Group J: Testing + Polish (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| J1 | End-to-end test with real data | All | Upload a real sensor file → get coaching, verify output quality |
| J2 | Error states and loading UI | I* | Skeleton loaders, error messages, empty states |
| J3 | Mobile responsive layout | I* | All pages usable on phone screen |
| J4 | Data quality warnings | C2, H1 | Show user when GPS quality is poor, sample rate is low, etc. |
| J5 | Sample data bundle | A7 | Downloadable sample sensor file so users can try without a track day |

---

## Dependency Graph (Critical Path) <!-- CHANGED in v1.1 -->

```
A1 ──→ A2 ──→ A3 ──→ B1 ──→ B3
  │            │          ↓
  ├──→ A8     └──→ A7 ──→ B4 ──→ B5
  │                              ↓
  └──→ A9 ──→ H4            B6 ──→ I9 (Track Builder)

A4 ──→ D1 ──→ E1 ──→ F1 ──→ G1 ──→ G6 ──→ H1 ──→ H2 ──→ I*
       ↓       ↓       ↓       ↓      ↓
       D4     E5      F9      G8     (TTS)
                                    ↑
                     A8 ──→ C1 ──→ C3
```

**Critical path:** A1 → A3 → A7 → (parallel: B-series + C-series + D→E→F→G→H pipeline) → I-series → J-series

**Parallelism opportunities:**
- Group A (Next.js setup) and A4 (Python setup) can run in parallel
- A8 (object storage) and A9 (Redis) can run in parallel with A2/A3
- Group B (session UI) and Group D–E–F (analysis modules) can run in parallel
- Group C (upload) can start as soon as A3 + A8 are done
- Track Builder (B6 + I9) can be developed in parallel with analysis pipeline
- Group I (results UI) starts when H is done, but can be scaffolded earlier with mock data

---

## Estimated Total Effort <!-- CHANGED in v1.1: updated estimates for new infrastructure -->

| Group | Days | Can Parallelize With |
|-------|------|---------------------|
| A: Project Setup | 2–3 | — (A8, A9 can run in parallel with A2/A3) | <!-- CHANGED in v1.1 -->
| B: Session Management | 2–3 | D, E, F (Python work) |
| C: Data Upload | 2–3 | D, E, F (Python work) |
| D: Lap Detection | 2–3 | B, C (Next.js work) |
| E: Corner Segmentation | 2–3 | B, C (Next.js work) |
| F: Behavior Analysis | 3–4 | B, C (Next.js work) |
| G: Coaching + Audio | 3–4 | — (needs F) | <!-- CHANGED in v1.1: +1 day for TTS -->
| H: Pipeline Orchestration | 2–3 | — (needs D, E, F, G) | <!-- CHANGED in v1.1: +1 day for Redis -->
| I: Results UI + Track Builder | 4–5 | — (needs H, can scaffold earlier) | <!-- CHANGED in v1.1: +Track Builder, +lap comparison -->
| J: Testing + Polish | 2–3 | — (needs I) |

**Sequential estimate:** ~25–34 days (one developer)
**With parallelism (2 devs: one TS, one Python):** ~16–21 days

---

## Phase 2 Exit Criteria <!-- CHANGED in v1.1 -->

Phase 2 is done when:

1. A user can create a session and select a track
2. A user can upload a sensor data file (JSON or CSV) to object storage
3. The system detects laps from the GPS trace
4. The system segments corners using track definitions
5. The system analyzes each corner (speeds, braking, apex timing)
6. The system generates corner-by-corner coaching text via Claude API (from structured findings, not raw telemetry) <!-- CHANGED in v1.1 -->
7. The system displays a top 3 improvements list
8. The system generates a server-side MP3 audio recap and plays it in the browser <!-- CHANGED in v1.1 -->
9. All coaching clearly labels measured vs. inferred insights
10. The pipeline works end-to-end with at least one real-world sensor data file
11. A user can compare any lap vs their best lap (entry speed, min speed, exit accel, time delta per corner) <!-- ADDED in v1.1 -->
12. An admin/power user can create a new track via the Track Builder (upload GPS trace, define corners) <!-- ADDED in v1.1 -->
13. Analysis jobs run via Redis queue with progress tracking visible in the UI <!-- ADDED in v1.1 -->

**Not required for Phase 2 exit:**
- User accounts / auth
- Video upload or playback
- Live sensor recording
- More than 10 pre-seeded tracks (but Track Builder allows adding more)
- Production deployment
- Mobile-optimized UI (functional on mobile, not polished)
