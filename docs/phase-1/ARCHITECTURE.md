# Racing Coach MVP — System Architecture

**Version:** 1.1
**Date:** 2026-03-14 (Revised)

---

## 1. Architecture Overview

<!-- CHANGED in v1.1: Added Redis + BullMQ, replaced filesystem with Object Storage,
     added TTS API service, added Track Builder UI component -->

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser/PWA)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ Session  │  │  Upload  │  │  Results  │  │  Video Playback   │  │
│  │ Manager  │  │  UI      │  │  Viewer   │  │  + Data Overlay   │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────────┘  │
│                                                                     │
│  ┌──────────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Track Builder   │  │        Sensor Recording (Phase 2b)      │  │
│  │  (admin tool)    │  │   Web Sensor API / DeviceMotion + Geo   │  │
│  └──────────────────┘  └─────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / REST
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API LAYER (Node.js)                    │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Session  │  │  Upload  │  │  Track    │  │  Analysis Job    │  │
│  │ CRUD API │  │  Handler │  │  API      │  │  Enqueue + Poll  │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Prisma ORM Layer                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬───────────────┬────────────────┘
       │              │              │               │
       ▼              ▼              ▼               ▼
┌────────────┐ ┌─────────────┐ ┌──────────┐  ┌──────────────────┐
│ PostgreSQL │ │ Object      │ │  Redis   │  │  Python Analysis │
│            │ │ Storage     │ │          │  │  Worker          │
│ - Sessions │ │ (S3 /       │ │ - Job    │  │                  │
│ - Tracks   │ │  Supabase)  │ │   queue  │  │  ┌────────────┐  │
│ - Laps     │ │             │ │ - Status │  │  │ Lap        │  │
│ - Corners  │ │ - Sensor    │ │   tracking│ │  │ Detector   │  │
│ - Analysis │ │   uploads   │ │          │  │  ├────────────┤  │
│   results  │ │ - Video     │ └──────────┘  │  │ Corner     │  │
│ - Tracks   │ │   uploads   │               │  │ Segmenter  │  │
│   (geo)    │ │ - Audio     │               │  ├────────────┤  │
└────────────┘ │   recaps    │               │  │ Behavior   │  │
               │ - Analysis  │               │  │ Analyzer   │  │
               │   JSON      │               │  ├────────────┤  │
               └─────────────┘               │  │ Coaching   │  │
                                             │  │ Generator  │  │
                                             │  ├────────────┤  │
                                             │  │ TTS Audio  │  │
                                             │  │ Generator  │  │
                                             │  └────────────┘  │
                                             │                  │
                                             │  ┌────────────┐  │
                                             │  │ Claude API │  │
                                             │  │ (structured│  │
                                             │  │  data →    │  │
                                             │  │  coaching) │  │
                                             │  ├────────────┤  │
                                             │  │ TTS API    │  │
                                             │  │ (OpenAI /  │  │
                                             │  │ ElevenLabs)│  │
                                             │  └────────────┘  │
                                             └──────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Client Layer (Next.js Frontend)

**Technology:** Next.js 14+ App Router, TypeScript, Tailwind CSS

| Component | Responsibility |
|-----------|---------------|
| Session Manager | Create/list/view sessions, select track, set metadata |
| Upload UI | Drag-and-drop or file picker for sensor CSV/JSON and video files |
| Results Viewer | Display lap list, corner-by-corner analysis, coaching text, track map with GPS overlay |
| Lap Comparison | Side-by-side lap vs best lap: entry speed, min speed, exit accel, time delta per corner | <!-- ADDED in v1.1 -->
| Video Playback | HTML5 video player with synchronized data overlay (time-aligned graphs) |
| Track Builder | Admin tool: upload GPS trace, define S/F line, set corner entry/apex/exit points, classify corners | <!-- ADDED in v1.1 -->
| Sensor Recording | (Phase 2b) Use Web APIs to record GPS + IMU directly in browser |

**Key decisions:**
- Server-side rendering for session list and results pages (SEO not critical, but SSR gives faster initial load)
- Client-side for upload and interactive analysis views
- No state management library needed for MVP — React Server Components + simple client state

### 2.2 Next.js API Layer

**Technology:** Next.js API Routes (App Router), Prisma ORM

| Endpoint Group | Routes | Purpose |
|---------------|--------|---------|
| Sessions | `POST/GET/GET:id /api/sessions` | CRUD for driving sessions |
| Upload | `POST /api/sessions/:id/upload/sensors` | Upload sensor data file |
| Upload | `POST /api/sessions/:id/upload/video` | Upload video file |
| Tracks | `GET /api/tracks`, `GET /api/tracks/:id` | List and retrieve track definitions |
| Tracks | `POST /api/tracks` | Create track from GPS trace (Track Builder) | <!-- ADDED in v1.1 -->
| Tracks | `POST /api/tracks/:id/corners` | Define/update corner boundaries | <!-- ADDED in v1.1 -->
| Analysis | `POST /api/sessions/:id/analyze` | Enqueue analysis job in Redis | <!-- CHANGED in v1.1: enqueue, not direct call -->
| Analysis | `GET /api/sessions/:id/analysis` | Get analysis results |
| Laps | `GET /api/sessions/:id/laps` | Get detected laps for a session |
| Coaching | `GET /api/sessions/:id/coaching` | Get coaching summary |
| Audio | `GET /api/sessions/:id/audio` | Get/generate audio recap |

**Key decisions:**
- File uploads go directly to object storage (S3 / Supabase Storage) — not stored in DB <!-- CHANGED in v1.1 -->
- Analysis is triggered explicitly by the user, not automatic on upload
- Analysis trigger enqueues a job in Redis (BullMQ); client polls for completion <!-- CHANGED in v1.1 -->

### 2.3 Python Analysis Service

**Technology:** Python 3.11+, FastAPI, NumPy, SciPy, Anthropic SDK

This is the core intelligence of the product. It runs as a separate service, called by the Next.js backend via HTTP.

#### Module: Lap Detector (`lap_detector.py`)

**Input:** GPS trace (array of `{timestamp, lat, lng}`) + track start/finish line definition

**Algorithm:**
1. Load start/finish line as a line segment (two GPS points)
2. For each consecutive pair of GPS points, check if the path segment intersects the S/F line
3. Use interpolation to estimate exact crossing time
4. Filter out false crossings (pit lane, slow crossings, direction check)
5. Return array of lap boundaries with timestamps and lap times

**Output:** `[{lap_number, start_time, end_time, lap_time_seconds}]`

#### Module: Corner Segmenter (`corner_segmenter.py`)

**Input:** GPS trace for one lap + track corner definitions (or auto-detect)

**Algorithm (with pre-defined corners):**
1. Load corner definitions: entry point, apex point, exit point (as GPS coordinates with tolerance zones)
2. Map each GPS sample to the nearest corner zone
3. Segments between corners are "straights"
4. Output: ordered list of segments with start/end times

**Algorithm (auto-detect fallback):**
1. Calculate instantaneous curvature from GPS trace (heading change rate)
2. Apply smoothing (moving average, window = 1–2 seconds)
3. Threshold curvature to identify "turning" vs "straight" segments
4. Merge short segments (< 1 second)
5. Label corners sequentially

**Output:** `[{segment_type: "corner"|"straight", corner_number, entry_time, apex_time, exit_time, entry_point, apex_point, exit_point}]`

#### Module: Behavior Analyzer (`behavior_analyzer.py`)

**Input:** Full sensor data for one lap + corner segments

**Per-corner analysis:**

| Metric | Calculation | Source |
|--------|------------|--------|
| Entry speed | GPS speed at corner entry point | Measured |
| Minimum speed | Lowest GPS speed within corner | Measured |
| Exit speed | GPS speed at corner exit point | Measured |
| Braking onset | First point where longitudinal G < -0.3g before corner entry | Inferred |
| Braking distance | Distance from braking onset to minimum speed point | Inferred |
| Peak lateral G | Maximum lateral acceleration in corner | Measured |
| Turn-in sharpness | Rate of lateral G increase at corner entry | Inferred |
| Apex timing | Time offset between driver's min-speed point and geometric apex | Inferred |
| Exit acceleration | Rate of speed increase from apex to corner exit | Measured |
| Corner time | Time from entry to exit | Measured |
| Time delta vs best | Difference from driver's best corner time (same corner, same session) | Calculated |

**Output:** `{corner_number, metrics: {...}, confidence: float}`

#### Module: Coaching Generator (`coaching_generator.py`) <!-- CHANGED in v1.1: clarified Claude API data boundary -->

**Input:** Per-corner analysis for all corners in a lap, historical comparison data

**Critical design rule: Claude does NOT receive raw telemetry.** The Python analysis engine must fully process raw sensor data and produce structured per-corner findings *before* Claude is invoked. Claude's role is strictly natural language generation from structured data.

**Process:**
1. For each corner, compare current metrics to driver's best performance
2. Identify the pattern of mistakes (late braking → slow entry → slow exit, or early turn-in → missed apex → scrubbed exit, etc.)
3. Rank corners by time lost (biggest improvement opportunities)
4. Build a **structured findings object** per corner (see example below)
5. Send structured findings to Claude API with a coaching prompt template
6. Claude generates natural language coaching per corner + overall summary + top 3 improvements

**Structured findings format (what Claude receives):**
```json
{
  "track_name": "Laguna Seca",
  "lap_number": 5,
  "corners": [
    {
      "corner_number": 3,
      "corner_name": "Turn 3 (Rahal Straight Exit)",
      "corner_type": "sweeper",
      "direction": "left",
      "findings": {
        "entry_speed_kmh": 142,
        "best_entry_speed_kmh": 148,
        "entry_speed_delta": -6,
        "min_speed_kmh": 95,
        "best_min_speed_kmh": 98,
        "exit_speed_kmh": 138,
        "best_exit_speed_kmh": 145,
        "brake_distance_meters": 85,
        "best_brake_distance_meters": 72,
        "brake_distance_delta_meters": 13,
        "apex_timing_offset_seconds": 0.3,
        "exit_acceleration_delay_seconds": 0.4,
        "corner_time_seconds": 4.2,
        "best_corner_time_seconds": 3.8,
        "time_delta_seconds": 0.4,
        "peak_lateral_g": 1.1,
        "confidence": 0.78
      },
      "data_source": {
        "measured": ["entry_speed_kmh", "min_speed_kmh", "exit_speed_kmh", "peak_lateral_g", "corner_time_seconds"],
        "inferred": ["brake_distance_meters", "apex_timing_offset_seconds", "exit_acceleration_delay_seconds"]
      }
    }
  ]
}
```

**Claude API prompt structure:**
```
You are a professional racing driving coach reviewing structured analysis
data for an amateur driver at {track_name}.

You are receiving PRE-ANALYZED structured findings, NOT raw telemetry.
Each corner includes measured and inferred metrics with confidence scores.

Rules:
- Convert the structured data into short, specific, actionable coaching
- Be specific with numbers ("brake 13m later" not "brake later")
- Clearly distinguish MEASURED observations from INFERRED suggestions
- Include confidence level for each insight
- Use encouraging but honest tone
- Focus on the 1 most impactful change per corner
- Generate an audio_script suitable for TTS (conversational, 2 min max)

Structured findings:
{structured_json}
```

**Output:** `{corners: [{corner_number, coaching_text, confidence}], summary, top_3_improvements, audio_script}`

#### Module: Audio Generator (`audio_generator.py`) <!-- CHANGED in v1.1: server-side TTS -->

**Input:** Audio script from coaching generator

**Process:**
1. Take the `audio_script` text from coaching generator
2. Call TTS API (OpenAI TTS / ElevenLabs) to generate speech
3. Save MP3 file to object storage
4. Store object storage URL in CoachingResult record
5. Return file URL

**Why server-side TTS (changed from browser TTS in v1.0):**
- **Consistent voice quality** — browser `SpeechSynthesis` varies wildly across devices and OS versions; a server-generated MP3 sounds identical everywhere
- **Reliable earbud playback** — drivers listen via single earbud before sessions; a downloadable MP3 works offline, unlike browser TTS which requires the page to stay open
- **Cacheable and replayable** — generated audio is stored in object storage; users can re-listen without re-generating; same audio can be served from CDN
- **Cost is manageable** — a 2-minute coaching recap costs ~$0.01–0.03 via OpenAI TTS; acceptable for MVP validation

### 2.4 Data Storage <!-- CHANGED in v1.1: replaced filesystem with object storage -->

#### PostgreSQL (via Prisma)

Stores structured metadata, relationships, and analysis results. See DATABASE_SCHEMA.md for full schema.

**What goes in PostgreSQL:**
- User accounts (future, but schema-ready)
- Session metadata
- Track definitions and corner definitions
- Lap boundaries (start/end times, lap times)
- Per-corner analysis results (structured JSON + key metrics as columns)
- Coaching text outputs
- Track Builder GPS traces (as JSONB, typically <1MB per track)

**What does NOT go in PostgreSQL:**
- Raw sensor data (too large, wrong shape for relational DB)
- Video files
- Audio files

#### Object Storage (S3 / Supabase Storage)

All binary files and large data blobs are stored in S3-compatible object storage from day one. No local filesystem dependency.

**Why object storage from the start (changed from filesystem in v1.0):**
- Decouples storage from compute — services can scale independently
- Pre-signed URLs enable direct client uploads (reduces server load for large video files)
- Built-in CDN-compatible serving for audio recaps
- No shared volume needed between Docker containers
- Supabase Storage provides a simple S3-compatible API with a generous free tier for MVP

**Bucket structure:**
```
racing-coach-uploads/
  sessions/
    {session_id}/
      sensors.json          # Raw uploaded sensor data
      video.mp4             # Uploaded video file (optional)

racing-coach-generated/
  sessions/
    {session_id}/
      analysis.json         # Full analysis output
      audio_recap.mp3       # Server-generated TTS audio file

racing-coach-tracks/
  {track_id}/
    gps_trace.json          # Source GPS trace used in Track Builder
```

**Database stores object keys (paths), not full URLs.** The application layer generates pre-signed URLs at read time.

---

## 3. Data Flow

### 3.1 Session Creation and Upload Flow <!-- CHANGED in v1.1: object storage -->

```
User creates session (name, track, car info)
  → POST /api/sessions → Prisma → PostgreSQL
  → Returns session_id

User uploads sensor file
  → POST /api/sessions/:id/upload/sensors
  → File saved to object storage: sessions/{id}/sensors.json
  → Basic validation (required fields, timestamp format, sample count)
  → Session status updated to "data_uploaded"

User uploads video (optional)
  → POST /api/sessions/:id/upload/video
  → File saved to object storage: sessions/{id}/video.mp4
  → Session status updated to include "video_uploaded"
```

### 3.2 Analysis Flow <!-- CHANGED in v1.1: Redis job queue replaces direct HTTP -->

```
User triggers analysis
  → POST /api/sessions/:id/analyze
  → Next.js API enqueues job in Redis (BullMQ)
  → Session status set to "ANALYZING"
  → Returns job_id immediately (202 Accepted)

Python worker picks up job from Redis queue:
  1. Reads sensor data from object storage
  2. Loads track definition from PostgreSQL (via API or direct DB read)
  3. Runs lap detection → saves laps to DB
  4. Updates job progress in Redis: "lap_detection_complete"
  5. For each lap:
     a. Runs corner segmentation → saves segments to DB
     b. Runs behavior analysis → saves per-corner metrics to DB
  6. Updates job progress: "analysis_complete"
  7. Builds structured findings object (per-corner metrics + deltas)
  8. Sends structured findings to Claude API → receives coaching text
     → Saves coaching text to DB
  9. Sends audio script to TTS API → receives MP3
     → Saves MP3 to object storage
     → Saves audio URL to DB
  10. Updates job status in Redis: "completed"
      → Session status set to "ANALYSIS_COMPLETE"

User polls for completion
  → GET /api/sessions/:id/analysis
  → Next.js checks Redis for job status + progress stage
  → Returns status + results when ready
```

**Why Redis queue (changed from direct HTTP in v1.0):**
- Analysis takes 10–60 seconds (sensor processing + Claude API + TTS API); too long for a synchronous HTTP request
- Redis provides reliable job persistence — if the worker crashes mid-analysis, the job is retried
- Progress tracking is natural: worker updates Redis hash with current stage, frontend polls it
- Scales horizontally: add more Python workers as user volume grows
- BullMQ (Node.js) or rq/celery (Python) both work; we use BullMQ on the Next.js side for enqueuing, and the Python worker reads from Redis directly

### 3.3 Results Viewing Flow <!-- CHANGED in v1.1: audio file, lap comparison -->

```
User opens session results
  → GET /api/sessions/:id/analysis
  → Returns: laps, per-corner analysis, coaching text, top improvements

User views specific lap
  → GET /api/sessions/:id/laps/:lap_number
  → Returns: corner-by-corner detail, GPS trace, sensor graphs

User compares lap vs best lap
  → GET /api/sessions/:id/laps/:lap_number/compare?vs=best
  → Returns: per-corner deltas (entry speed, min speed, exit accel, time)

User plays audio recap
  → GET /api/sessions/:id/audio
  → Returns pre-signed URL to MP3 file in object storage
  → Frontend plays MP3 via standard HTML5 audio player
  → User can download MP3 for offline playback via earbud
```

---

## 4. Communication Between Services

### Next.js ↔ Python Analysis Worker <!-- CHANGED in v1.1: Redis-based communication -->

**Protocol:** Redis job queue (BullMQ-compatible)
**Next.js** enqueues jobs and polls status from Redis
**Python worker** consumes jobs from Redis, writes results to PostgreSQL + object storage

**Job payload (stored in Redis):**
```json
{
  "session_id": "uuid",
  "sensor_data_key": "sessions/{id}/sensors.json",
  "track_id": "uuid",
  "options": {
    "min_lap_time_seconds": 30,
    "max_lap_time_seconds": 600,
    "braking_g_threshold": 0.3,
    "corner_curvature_threshold": 0.01
  }
}
```

**Job progress (updated in Redis by worker):**
```json
{
  "status": "processing",
  "stage": "behavior_analysis",
  "progress_percent": 65,
  "laps_detected": 12,
  "current_lap": 8
}
```

**Results (stored in PostgreSQL + object storage, not in Redis):**
- Laps → `Lap` table
- Corner analysis → `CornerAnalysis` table
- Coaching text → `CoachingResult` table
- Audio MP3 → object storage, URL in `CoachingResult.audioFileUrl`
- Full analysis JSON → object storage (for debugging/export)

**Python worker also exposes a minimal HTTP API:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check + Redis connectivity |

---

## 5. Deployment Architecture (MVP) <!-- CHANGED in v1.1: added Redis, object storage, removed local disk -->

```
┌──────────────────────────────────────┐
│         Single Server                │
│         (e.g. Railway, Render, VPS)  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   Next.js (Port 3000)         │  │
│  │   - Frontend SSR              │  │
│  │   - API routes                │  │
│  │   - BullMQ job enqueue        │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   Python Worker               │  │
│  │   - Redis job consumer        │  │
│  │   - Analysis pipeline         │  │
│  │   - Claude API client         │  │
│  │   - TTS API client            │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   Redis (Port 6379)           │  │
│  │   - Job queue                 │  │
│  │   - Job status/progress       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │   PostgreSQL (Port 5432)      │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
              │
              ▼ (external)
┌────────────────────────────────┐
│   Object Storage               │
│   (Supabase Storage / S3)      │
│   - sensor uploads             │
│   - video uploads              │
│   - generated audio            │
│   - analysis JSON              │
└────────────────────────────────┘
```

**MVP deployment:** Docker Compose with 4 containers (Next.js, Python worker, Redis, PostgreSQL) + external object storage (Supabase Storage free tier or MinIO for local dev).

**Why this works for MVP:**
- Single server is simpler to debug
- Redis is lightweight (< 50MB memory for job queue)
- Object storage is external — no shared volumes between containers
- Can handle 10–100 users easily
- Upgrade path is clean: add more Python workers, swap to managed Redis, etc.

---

## 6. Key Technical Decisions

<!-- CHANGED in v1.1: updated File storage, Inter-service, Audio generation rows; added Claude API boundary note -->

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo vs multi-repo | Monorepo | Simpler for a small team; shared types between TS and Python (via JSON schema) |
| SSR framework | Next.js App Router | Best DX for full-stack TypeScript; built-in API routes eliminate need for separate Node server |
| Analysis language | Python | NumPy/SciPy ecosystem is unmatched for signal processing; Claude SDK has excellent Python support |
| Database | PostgreSQL | Battle-tested, Prisma support, JSON columns for flexible analysis storage, PostGIS extension available for future geo queries |
| ORM | Prisma | Best TypeScript ORM; schema-as-code; migrations built in |
| File storage | Object storage (S3 / Supabase Storage) | Decouples storage from compute; pre-signed URLs; no shared volumes; CDN-ready | <!-- CHANGED in v1.1 -->
| Job queue | Redis + BullMQ | Reliable async processing for 10–60s analysis jobs; progress tracking; horizontal scaling | <!-- CHANGED in v1.1 -->
| Authentication | None (MVP) | Not needed for single-user validation; add NextAuth.js in Phase 3 |
| Coaching text generation | Claude API (structured input only) | Claude receives pre-analyzed structured findings, NOT raw telemetry; NLG from structured data | <!-- CHANGED in v1.1 -->
| Audio generation | Server-side TTS API (OpenAI / ElevenLabs) | Consistent quality; cacheable MP3; reliable earbud playback; ~$0.01–0.03/recap | <!-- CHANGED in v1.1 -->
| Containerization | Docker Compose | Standard, portable, easy local dev; 4 containers (Next.js, Python, Redis, PostgreSQL) |

---

## 7. Sensor Data Format

### Upload Format (what users provide)

We accept a JSON file with the following structure:

```json
{
  "metadata": {
    "device": "iPhone 15 Pro",
    "app": "Sensor Logger",
    "export_version": "1.0",
    "session_start_utc": "2026-03-14T10:00:00.000Z"
  },
  "samples": [
    {
      "t": 0.000,
      "gps": {
        "lat": 36.5697,
        "lng": -121.7531,
        "alt": 56.2,
        "speed": 0.0,
        "accuracy": 3.2
      },
      "accel": {
        "x": 0.01,
        "y": -0.02,
        "z": -9.78
      },
      "gyro": {
        "x": 0.001,
        "y": -0.003,
        "z": 0.002
      }
    }
  ]
}
```

**Notes:**
- `t` is seconds since session start (monotonic)
- GPS may be absent for some samples (lower sample rate than IMU)
- Accel values in m/s², gyro values in rad/s
- We also accept CSV with equivalent columns for compatibility with common sensor logger apps
- A parser/adapter layer handles format normalization
