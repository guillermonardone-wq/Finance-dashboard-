# Racing Coach MVP — Phase 2 Engineering Task Breakdown

**Version:** 1.0
**Date:** 2026-03-14

---

## Phase 2 Goal

Build the core pipeline end-to-end: upload sensor data → detect laps → segment corners → analyze driving → generate coaching. A user should be able to upload a real sensor file, pick a track, and receive corner-by-corner coaching feedback.

---

## Task Groups

### Group A: Project Setup (Estimated: 1–2 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| A1 | Initialize Next.js 14 project with TypeScript, Tailwind, App Router | — | Working `next dev` with hello world page |
| A2 | Set up PostgreSQL + Prisma | A1 | `prisma migrate dev` runs, DB is seeded |
| A3 | Create Prisma schema from DATABASE_SCHEMA.md | A2 | All models created, initial migration |
| A4 | Set up Python analysis service with FastAPI | — | Working `uvicorn` with `/health` endpoint |
| A5 | Docker Compose for all services | A1, A4 | `docker compose up` starts Next.js + Python + PostgreSQL |
| A6 | Shared types / API contracts | A1, A4 | TypeScript types + Python dataclasses for API request/response |
| A7 | Seed database with 5–10 tracks | A3 | Tracks with corner definitions for Laguna Seca, Watkins Glen, etc. |

### Group B: Session Management API + UI (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| B1 | Session CRUD API routes | A3 | `POST/GET /api/sessions`, `GET /api/sessions/:id` |
| B2 | Track list API route | A3, A7 | `GET /api/tracks` with corner count, location |
| B3 | Session creation page | B1, B2 | Form: name, date, track selector, car info, conditions |
| B4 | Session list page | B1 | Card grid of sessions with status, track, date, best lap |
| B5 | Session detail page (shell) | B1 | Header with session info, tabs for upload/results |

### Group C: Data Upload Pipeline (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| C1 | File upload API route (sensor data) | A3 | `POST /api/sessions/:id/upload/sensors`, saves file, updates session |
| C2 | Sensor data parser + validator | C1 | Parses JSON and CSV formats, validates required fields, reports quality |
| C3 | Upload UI component | B5, C1 | Drag-and-drop with progress bar, format validation, quality preview |
| C4 | Video upload API route | A3 | `POST /api/sessions/:id/upload/video`, saves file |
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

### Group G: Coaching Generation (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| G1 | Coaching generator module (Python) | F1 | `coaching_generator.py` — metrics → structured coaching request |
| G2 | Claude API prompt engineering | G1 | Coaching prompt template with structured data input |
| G3 | Corner-by-corner coaching output | G2 | Per-corner text with measured vs inferred labels + confidence |
| G4 | Top 3 improvements ranking | G1 | Rank corners by time lost, generate specific suggestions |
| G5 | Audio script generation | G3, G4 | Concise script suitable for TTS |
| G6 | Coaching result storage | G3 | Save coaching to PostgreSQL via API |
| G7 | Prompt tuning with real data | G2 | Iterate prompt with actual analysis outputs |

### Group H: Analysis Pipeline Orchestration (Estimated: 1–2 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| H1 | Full pipeline entrypoint | D1, E1, F1, G1 | `/analyze` endpoint that runs all stages sequentially |
| H2 | Progress tracking | H1 | Status updates during analysis (stage + percent) |
| H3 | Error handling + partial results | H1 | Graceful failure: if coaching fails, still show raw analysis |
| H4 | Analysis trigger API route | H1 | `POST /api/sessions/:id/analyze`, calls Python, polls status |
| H5 | Analysis status polling API | H4 | `GET /api/sessions/:id/analysis` with status + results |

### Group I: Results UI (Estimated: 3–4 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| I1 | Lap list component | H5 | Table of laps with times, validity, best-lap highlight |
| I2 | Track map with GPS overlay | H5 | Canvas/SVG map showing GPS trace colored by speed or lateral G |
| I3 | Corner-by-corner coaching cards | H5 | Expandable cards per corner with coaching text, metrics, confidence |
| I4 | Top 3 improvements panel | H5 | Prominent display of highest-impact suggestions |
| I5 | Session summary header | H5 | Best lap, total laps, data quality, overall coaching summary |
| I6 | Audio recap player | G5 | Browser TTS playback of coaching script with play/pause |
| I7 | Sensor data graphs | H5 | Speed, lateral G, longitudinal G vs distance/time charts |
| I8 | Lap comparison view (basic) | I1, I7 | Select two laps, overlay their traces/graphs |

### Group J: Testing + Polish (Estimated: 2–3 days)

| Task | Description | Depends On | Deliverable |
|------|-------------|------------|-------------|
| J1 | End-to-end test with real data | All | Upload a real sensor file → get coaching, verify output quality |
| J2 | Error states and loading UI | I* | Skeleton loaders, error messages, empty states |
| J3 | Mobile responsive layout | I* | All pages usable on phone screen |
| J4 | Data quality warnings | C2, H1 | Show user when GPS quality is poor, sample rate is low, etc. |
| J5 | Sample data bundle | A7 | Downloadable sample sensor file so users can try without a track day |

---

## Dependency Graph (Critical Path)

```
A1 ──→ A2 ──→ A3 ──→ B1 ──→ B3
                 │          ↓
                 └──→ A7 ──→ B4 ──→ B5
                                    ↓
A4 ──→ D1 ──→ E1 ──→ F1 ──→ G1 ──→ H1 ──→ H4 ──→ I*
       ↓       ↓       ↓       ↓
       D4     E5      F9      G7
                                    ↑
                            C1 ──→ C3
```

**Critical path:** A1 → A3 → A7 → (parallel: B-series + C-series + D→E→F→G→H pipeline) → I-series → J-series

**Parallelism opportunities:**
- Group A (Next.js setup) and A4 (Python setup) can run in parallel
- Group B (session UI) and Group D–E–F (analysis modules) can run in parallel
- Group C (upload) can start as soon as A3 is done
- Group I (results UI) starts when H is done, but can be scaffolded earlier with mock data

---

## Estimated Total Effort

| Group | Days | Can Parallelize With |
|-------|------|---------------------|
| A: Project Setup | 1–2 | — |
| B: Session Management | 2–3 | D, E, F (Python work) |
| C: Data Upload | 2–3 | D, E, F (Python work) |
| D: Lap Detection | 2–3 | B, C (Next.js work) |
| E: Corner Segmentation | 2–3 | B, C (Next.js work) |
| F: Behavior Analysis | 3–4 | B, C (Next.js work) |
| G: Coaching Generation | 2–3 | — (needs F) |
| H: Pipeline Orchestration | 1–2 | — (needs D, E, F, G) |
| I: Results UI | 3–4 | — (needs H, can scaffold earlier) |
| J: Testing + Polish | 2–3 | — (needs I) |

**Sequential estimate:** ~22–30 days (one developer)
**With parallelism (2 devs: one TS, one Python):** ~14–18 days

---

## Phase 2 Exit Criteria

Phase 2 is done when:

1. A user can create a session and select a track
2. A user can upload a sensor data file (JSON or CSV)
3. The system detects laps from the GPS trace
4. The system segments corners using track definitions
5. The system analyzes each corner (speeds, braking, apex timing)
6. The system generates corner-by-corner coaching text via Claude API
7. The system displays a top 3 improvements list
8. The system generates and plays an audio recap via browser TTS
9. All coaching clearly labels measured vs. inferred insights
10. The pipeline works end-to-end with at least one real-world sensor data file

**Not required for Phase 2 exit:**
- User accounts / auth
- Video upload or playback
- Live sensor recording
- More than 10 tracks in the database
- Production deployment
- Mobile-optimized UI (functional on mobile, not polished)
