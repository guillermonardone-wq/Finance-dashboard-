# Racing Coach MVP — System Architecture

**Version:** 1.0
**Date:** 2026-03-14

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser/PWA)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ Session  │  │  Upload  │  │  Results  │  │  Video Playback   │  │
│  │ Manager  │  │  UI      │  │  Viewer   │  │  + Data Overlay   │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Sensor Recording (Phase 2b)                     │   │
│  │         Web Sensor API / DeviceMotion + Geolocation          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / REST
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API LAYER (Node.js)                    │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Session  │  │  Upload  │  │  Track    │  │  Analysis Job    │  │
│  │ CRUD API │  │  Handler │  │  API      │  │  Manager         │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Prisma ORM Layer                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────────────────┬────────────────────┘
       │              │                          │
       ▼              ▼                          ▼
┌────────────┐ ┌─────────────┐          ┌──────────────────┐
│ PostgreSQL │ │ File Store  │          │  Python Analysis │
│            │ │ (local/S3)  │          │  Service         │
│ - Sessions │ │             │          │                  │
│ - Tracks   │ │ - Raw sensor│          │  ┌────────────┐  │
│ - Laps     │ │   data files│          │  │ Lap        │  │
│ - Corners  │ │ - Video     │          │  │ Detector   │  │
│ - Analysis │ │   files     │          │  ├────────────┤  │
│   results  │ │ - Audio     │          │  │ Corner     │  │
│ - Tracks   │ │   recaps    │          │  │ Segmenter  │  │
│   (geo)    │ │             │          │  ├────────────┤  │
└────────────┘ └─────────────┘          │  │ Behavior   │  │
                                        │  │ Analyzer   │  │
                                        │  ├────────────┤  │
                                        │  │ Coaching   │  │
                                        │  │ Generator  │  │
                                        │  ├────────────┤  │
                                        │  │ Audio      │  │
                                        │  │ Generator  │  │
                                        │  └────────────┘  │
                                        │                  │
                                        │  ┌────────────┐  │
                                        │  │ Claude API │  │
                                        │  │ (coaching  │  │
                                        │  │  text gen) │  │
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
| Video Playback | HTML5 video player with synchronized data overlay (time-aligned graphs) |
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
| Analysis | `POST /api/sessions/:id/analyze` | Trigger analysis job |
| Analysis | `GET /api/sessions/:id/analysis` | Get analysis results |
| Laps | `GET /api/sessions/:id/laps` | Get detected laps for a session |
| Coaching | `GET /api/sessions/:id/coaching` | Get coaching summary |
| Audio | `GET /api/sessions/:id/audio` | Get/generate audio recap |

**Key decisions:**
- File uploads go directly to filesystem (or S3 in production) — not stored in DB
- Analysis is triggered explicitly by the user, not automatic on upload
- Analysis runs asynchronously — the API returns a job ID, client polls for completion

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

#### Module: Coaching Generator (`coaching_generator.py`)

**Input:** Per-corner analysis for all corners in a lap, historical comparison data

**Process:**
1. For each corner, compare current metrics to driver's best performance
2. Identify the pattern of mistakes (late braking → slow entry → slow exit, or early turn-in → missed apex → scrubbed exit, etc.)
3. Rank corners by time lost (biggest improvement opportunities)
4. Build structured coaching data object
5. Send to Claude API with a coaching prompt template
6. Claude generates natural language coaching per corner + overall summary + top 3 improvements

**Claude API prompt structure:**
```
You are a professional racing driving coach analyzing telemetry data.
The driver is an amateur on {track_name}.

For each corner, you have:
- Entry/min/exit speeds and how they compare to the driver's best
- Braking point relative to best
- Apex timing relative to geometric apex
- Lateral G profile

Important rules:
- Be specific and actionable ("brake 10m later" not "brake later")
- Distinguish between MEASURED data and INFERRED behavior
- Include confidence level for each insight
- Use encouraging but honest tone
- Focus on the 1 most impactful change per corner

Corner data:
{structured_json}
```

**Output:** `{corners: [{corner_number, coaching_text, confidence}], summary, top_3_improvements, audio_script}`

#### Module: Audio Generator (`audio_generator.py`)

**Input:** Audio script from coaching generator

**Process:**
1. Take the `audio_script` text
2. Call TTS API (or browser TTS for MVP)
3. Save as MP3/WAV file
4. Return file path

**MVP approach:** Generate the script server-side, do TTS client-side using browser `SpeechSynthesis` API. Simpler, no TTS API cost.

### 2.4 Data Storage

#### PostgreSQL (via Prisma)

Stores structured metadata, relationships, and analysis results. See DATABASE_SCHEMA.md for full schema.

**What goes in PostgreSQL:**
- User accounts (future, but schema-ready)
- Session metadata
- Track definitions and corner definitions
- Lap boundaries (start/end times, lap times)
- Per-corner analysis results (structured JSON + key metrics as columns)
- Coaching text outputs

**What does NOT go in PostgreSQL:**
- Raw sensor data (too large, wrong shape for relational DB)
- Video files
- Audio files

#### File Storage

**MVP:** Local filesystem under `/data/uploads/` and `/data/generated/`
**Production:** S3-compatible object storage

```
/data/
  uploads/
    sessions/
      {session_id}/
        sensors.json        # Raw uploaded sensor data
        video.mp4           # Uploaded video file
  generated/
    sessions/
      {session_id}/
        analysis.json       # Full analysis output
        audio_recap.mp3     # Generated audio file
```

---

## 3. Data Flow

### 3.1 Session Creation and Upload Flow

```
User creates session (name, track, car info)
  → POST /api/sessions → Prisma → PostgreSQL
  → Returns session_id

User uploads sensor file
  → POST /api/sessions/:id/upload/sensors
  → File saved to /data/uploads/sessions/{id}/sensors.json
  → Basic validation (required fields, timestamp format, sample count)
  → Session status updated to "data_uploaded"

User uploads video (optional)
  → POST /api/sessions/:id/upload/video
  → File saved to /data/uploads/sessions/{id}/video.mp4
  → Session status updated to include "video_uploaded"
```

### 3.2 Analysis Flow

```
User triggers analysis
  → POST /api/sessions/:id/analyze
  → Next.js API creates an analysis job (status: "processing")
  → Calls Python service: POST /analyze

Python service:
  1. Reads sensor data from file store
  2. Loads track definition from PostgreSQL (via API or direct DB read)
  3. Runs lap detection → saves laps to DB
  4. For each lap:
     a. Runs corner segmentation → saves segments to DB
     b. Runs behavior analysis → saves per-corner metrics to DB
  5. Runs coaching generation (calls Claude API)
     → Saves coaching text to DB
  6. Generates audio script
     → Returns to Next.js API

Next.js API:
  → Updates analysis job status to "completed"
  → Stores coaching results

User polls for completion
  → GET /api/sessions/:id/analysis
  → Returns status + results when ready
```

### 3.3 Results Viewing Flow

```
User opens session results
  → GET /api/sessions/:id/analysis
  → Returns: laps, per-corner analysis, coaching text, top improvements

User views specific lap
  → GET /api/sessions/:id/laps/:lap_number
  → Returns: corner-by-corner detail, GPS trace, sensor graphs

User plays audio recap
  → Audio script loaded from DB
  → Browser TTS reads it aloud (MVP)
  → OR: GET /api/sessions/:id/audio returns pre-generated MP3 (future)
```

---

## 4. Communication Between Services

### Next.js ↔ Python Analysis Service

**Protocol:** HTTP/REST
**MVP:** Direct HTTP calls from Next.js API routes to Python FastAPI service
**Future:** Redis/BullMQ job queue for async processing at scale

**Python service endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | Run full analysis pipeline |
| GET | `/health` | Health check |

**Request to `/analyze`:**
```json
{
  "session_id": "uuid",
  "sensor_data_path": "/data/uploads/sessions/{id}/sensors.json",
  "track_id": "uuid",
  "options": {
    "min_lap_time_seconds": 30,
    "max_lap_time_seconds": 600,
    "braking_g_threshold": 0.3,
    "corner_curvature_threshold": 0.01
  }
}
```

**Response from `/analyze`:**
```json
{
  "status": "completed",
  "laps": [...],
  "corners_per_lap": {...},
  "coaching": {
    "corners": [...],
    "summary": "...",
    "top_3_improvements": [...],
    "audio_script": "..."
  },
  "data_quality": {
    "gps_sample_rate_hz": 10,
    "imu_sample_rate_hz": 100,
    "gps_quality": "good",
    "dropped_samples_percent": 0.2
  }
}
```

---

## 5. Deployment Architecture (MVP)

```
┌─────────────────────────────────┐
│         Single Server           │
│         (e.g. Railway,          │
│          Render, VPS)           │
│                                 │
│  ┌───────────────────────────┐  │
│  │   Next.js (Port 3000)    │  │
│  │   - Frontend SSR         │  │
│  │   - API routes           │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │   Python (Port 8000)     │  │
│  │   - FastAPI              │  │
│  │   - Analysis pipeline    │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │   PostgreSQL (Port 5432) │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │   /data/ (local disk)    │  │
│  │   - uploads              │  │
│  │   - generated files      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**MVP deployment:** Docker Compose with 3 containers (Next.js, Python, PostgreSQL) + a shared volume for `/data/`.

**Why this is fine for MVP:**
- Single server is simpler to debug
- No network latency between services
- Shared filesystem eliminates S3 setup
- Can handle 10–100 users easily
- Upgrade path is clear: split into separate services, add S3, add queue

---

## 6. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo vs multi-repo | Monorepo | Simpler for a small team; shared types between TS and Python (via JSON schema) |
| SSR framework | Next.js App Router | Best DX for full-stack TypeScript; built-in API routes eliminate need for separate Node server |
| Analysis language | Python | NumPy/SciPy ecosystem is unmatched for signal processing; Claude SDK has excellent Python support |
| Database | PostgreSQL | Battle-tested, Prisma support, JSON columns for flexible analysis storage, PostGIS extension available for future geo queries |
| ORM | Prisma | Best TypeScript ORM; schema-as-code; migrations built in |
| File storage | Local filesystem (MVP) | Simplest; upgrade to S3 later by swapping one module |
| Inter-service communication | Direct HTTP (MVP) | Simplest; upgrade to job queue later |
| Authentication | None (MVP) | Not needed for single-user validation; add NextAuth.js in Phase 3 |
| Coaching text generation | Claude API | Natural language output from structured data; prompt engineering is faster than building custom NLG |
| Audio generation | Browser TTS (MVP) | Zero cost, zero infrastructure; upgrade to API TTS later |
| Containerization | Docker Compose | Standard, portable, easy local dev |

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
