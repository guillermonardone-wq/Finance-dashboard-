# Racing Coach MVP — Database Schema

**Version:** 1.0
**Date:** 2026-03-14

---

## 1. Design Principles

1. **PostgreSQL for structured data, filesystem for blobs** — sensor data files, video, and audio live on disk/S3, not in the database
2. **Schema-ready for multi-user** — we include a `User` model even though MVP is single-user, to avoid a painful migration later
3. **Analysis results stored as both structured columns and JSON** — key metrics as queryable columns, full detail as JSONB for flexibility
4. **Timestamps everywhere** — every record has `createdAt` and `updatedAt`
5. **Soft references to files** — file paths stored as strings, actual files on filesystem

---

## 2. Entity Relationship Diagram

```
User (future)
  │
  ├──< Session
  │      │
  │      ├──── Track (many sessions → one track)
  │      │
  │      ├──< SensorUpload
  │      │
  │      ├──< VideoUpload
  │      │
  │      ├──< Lap
  │      │     │
  │      │     └──< CornerAnalysis
  │      │
  │      ├──< SessionAnalysis
  │      │
  │      └──< CoachingResult
  │
  Track
    │
    └──< TrackCorner
```

---

## 3. Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// User (minimal for MVP, expand later)
// ─────────────────────────────────────────────

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions Session[]
}

// ─────────────────────────────────────────────
// Track and Corner Definitions
// ─────────────────────────────────────────────

model Track {
  id          String   @id @default(uuid())
  name        String
  location    String                         // e.g. "Monterey, CA"
  country     String
  lengthMeters Float?                        // total track length
  // Start/finish line defined as two GPS points (a gate)
  sfLineLat1  Float                          // start/finish line point 1
  sfLineLng1  Float
  sfLineLat2  Float                          // start/finish line point 2
  sfLineLng2  Float
  sfLineHeading Float?                       // expected crossing heading (degrees) to filter wrong-way crossings
  // Track outline as a simplified GPS polygon (for map display)
  outlineJson Json?                          // [{lat, lng}, ...] array
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  corners  TrackCorner[]
  sessions Session[]
}

model TrackCorner {
  id          String @id @default(uuid())
  trackId     String
  track       Track  @relation(fields: [trackId], references: [id])
  number      Int                            // corner number (sequential)
  name        String?                        // e.g. "Turn 1", "The Corkscrew"
  // Corner zones defined as GPS points with tolerance
  entryLat    Float
  entryLng    Float
  apexLat     Float
  apexLng     Float
  exitLat     Float
  exitLng     Float
  toleranceMeters Float @default(15)         // how close GPS needs to be to match
  // Corner characteristics (for coaching context)
  type        String?                        // "hairpin", "sweeper", "chicane", "kink"
  direction   String?                        // "left", "right"
  notes       String?                        // coaching-relevant notes about the corner
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  analyses CornerAnalysis[]

  @@unique([trackId, number])
}

// ─────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────

model Session {
  id          String        @id @default(uuid())
  userId      String?
  user        User?         @relation(fields: [userId], references: [id])
  trackId     String
  track       Track         @relation(fields: [trackId], references: [id])
  name        String                          // user-provided session name
  date        DateTime                        // when the session took place
  carName     String?                         // e.g. "2019 Mazda MX-5"
  carNotes    String?                         // tire type, mods, etc.
  conditions  String?                         // "dry", "wet", "mixed"
  status      SessionStatus @default(CREATED)
  // Data quality info (populated after upload)
  gpsSampleRateHz    Float?
  imuSampleRateHz    Float?
  dataQuality        String?                  // "good", "fair", "poor"
  totalSamples       Int?
  durationSeconds    Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sensorUploads  SensorUpload[]
  videoUploads   VideoUpload[]
  laps           Lap[]
  analysis       SessionAnalysis?
  coaching       CoachingResult?
}

enum SessionStatus {
  CREATED
  DATA_UPLOADED
  ANALYZING
  ANALYSIS_COMPLETE
  ANALYSIS_FAILED
}

// ─────────────────────────────────────────────
// Uploads (file references)
// ─────────────────────────────────────────────

model SensorUpload {
  id          String   @id @default(uuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filePath    String                          // path to stored file
  fileName    String                          // original filename
  fileSize    Int                             // bytes
  format      String                          // "json", "csv"
  sampleCount Int?                            // total sensor samples
  startTime   DateTime?                       // first sample timestamp
  endTime     DateTime?                       // last sample timestamp
  createdAt   DateTime @default(now())
}

model VideoUpload {
  id          String   @id @default(uuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filePath    String
  fileName    String
  fileSize    Int                             // bytes
  durationSeconds Float?
  resolution  String?                         // e.g. "1920x1080"
  // Sync offset: seconds to add to video time to align with sensor time
  syncOffsetSeconds Float @default(0)
  createdAt   DateTime @default(now())
}

// ─────────────────────────────────────────────
// Laps
// ─────────────────────────────────────────────

model Lap {
  id              String   @id @default(uuid())
  sessionId       String
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  lapNumber       Int
  startTime       Float                       // seconds since session start
  endTime         Float                       // seconds since session start
  lapTimeSeconds  Float                       // end - start
  isValid         Boolean  @default(true)     // false for in/out laps, aborted laps
  invalidReason   String?                     // "pit_in", "pit_out", "off_track", "too_slow"
  // Summary metrics (populated during analysis)
  maxSpeedKmh     Float?
  avgSpeedKmh     Float?
  maxLateralG     Float?
  maxBrakingG     Float?
  createdAt       DateTime @default(now())

  cornerAnalyses CornerAnalysis[]

  @@unique([sessionId, lapNumber])
}

// ─────────────────────────────────────────────
// Corner Analysis (per corner, per lap)
// ─────────────────────────────────────────────

model CornerAnalysis {
  id              String      @id @default(uuid())
  lapId           String
  lap             Lap         @relation(fields: [lapId], references: [id], onDelete: Cascade)
  trackCornerId   String
  trackCorner     TrackCorner @relation(fields: [trackCornerId], references: [id])
  cornerNumber    Int

  // Timing
  entryTime       Float                       // seconds since session start
  apexTime        Float
  exitTime        Float
  cornerTimeSeconds Float                     // exit - entry

  // Speeds (km/h) — MEASURED
  entrySpeedKmh   Float
  minSpeedKmh     Float
  exitSpeedKmh    Float

  // Accelerations — MEASURED
  peakLateralG    Float
  peakBrakingG    Float
  exitAccelG      Float?                      // longitudinal acceleration on exit

  // Braking — INFERRED
  brakingOnsetTime     Float?                 // when braking started (seconds since session start)
  brakingDistanceMeters Float?                // distance from braking onset to min speed point

  // Line / Apex — INFERRED
  apexOffsetMeters     Float?                 // lateral offset from geometric apex (+ = wide, - = tight)
  apexTimingOffset     Float?                 // time offset: negative = early apex, positive = late apex

  // Comparison to best
  deltaVsBestSeconds   Float?                 // time delta vs driver's best for this corner
  deltaEntrySpeed      Float?                 // speed delta at entry vs best
  deltaExitSpeed       Float?                 // speed delta at exit vs best

  // Confidence
  confidence           Float  @default(0.5)   // 0.0–1.0, how confident we are in this analysis
  dataQualityFlags     Json?                  // any warnings about data quality for this corner

  createdAt DateTime @default(now())

  @@unique([lapId, cornerNumber])
}

// ─────────────────────────────────────────────
// Session-Level Analysis
// ─────────────────────────────────────────────

model SessionAnalysis {
  id          String   @id @default(uuid())
  sessionId   String   @unique
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Overall session stats
  totalLaps        Int
  validLaps        Int
  bestLapNumber    Int?
  bestLapTime      Float?
  medianLapTime    Float?
  consistency      Float?                     // std dev of lap times (lower = more consistent)

  // Analysis metadata
  analysisVersion  String                     // version of analysis pipeline
  processingTimeMs Int                        // how long analysis took
  rawResultsPath   String?                    // path to full analysis JSON on filesystem

  // Status
  status           String  @default("completed")  // "completed", "partial", "failed"
  errorMessage     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────────
// Coaching Results
// ─────────────────────────────────────────────

model CoachingResult {
  id          String   @id @default(uuid())
  sessionId   String   @unique
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  lapNumber   Int?                            // which lap this coaching is for (null = session-wide)

  // Corner-by-corner coaching (JSON array)
  // [{cornerNumber, coachingText, confidence, measuredInsights, inferredInsights}]
  cornerCoaching    Json

  // Overall summary
  summaryText       String                    // 2-3 paragraph overall coaching summary
  top3Improvements  Json                      // [{cornerNumber, suggestion, estimatedTimeSave}]

  // Audio
  audioScript       String?                   // text for TTS
  audioFilePath     String?                   // path to generated audio file

  // Metadata
  modelUsed         String?                   // e.g. "claude-sonnet-4-6"
  promptVersion     String?                   // version of coaching prompt template
  generatedAt       DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 4. Data Size Estimates

| Entity | Rows per Session | Row Size | Notes |
|--------|-----------------|----------|-------|
| Session | 1 | ~500B | Metadata only |
| SensorUpload | 1 | ~200B | File reference only; actual data is 5–50MB on disk |
| VideoUpload | 0–1 | ~200B | File reference only; actual video is 500MB–2GB on disk |
| Lap | 5–30 | ~200B | Typical track day session |
| CornerAnalysis | 50–300 | ~500B | 10 corners × 5–30 laps |
| SessionAnalysis | 1 | ~500B | Summary stats |
| CoachingResult | 1 | ~5KB | Includes JSON coaching text |
| TrackCorner | 10–20 per track | ~300B | Static data |

**Per session total in PostgreSQL:** ~50KB–150KB (very manageable)
**Per session on filesystem:** 5–50MB (sensor data) + 0–2GB (video)

---

## 5. Indexes

Key indexes beyond primary keys and unique constraints:

```sql
-- Session queries
CREATE INDEX idx_session_user_id ON "Session" ("userId");
CREATE INDEX idx_session_track_id ON "Session" ("trackId");
CREATE INDEX idx_session_date ON "Session" ("date" DESC);
CREATE INDEX idx_session_status ON "Session" ("status");

-- Lap queries
CREATE INDEX idx_lap_session_id ON "Lap" ("sessionId");

-- Corner analysis queries
CREATE INDEX idx_corner_analysis_lap_id ON "CornerAnalysis" ("lapId");
CREATE INDEX idx_corner_analysis_track_corner ON "CornerAnalysis" ("trackCornerId");

-- Track corner queries
CREATE INDEX idx_track_corner_track_id ON "TrackCorner" ("trackId");
```

---

## 6. Migration Strategy

1. **Phase 2:** Create initial schema with Prisma migrations
2. **Phase 3:** Add User model relations when auth is added
3. **Future:** If we need time-series queries on sensor data, add TimescaleDB extension rather than storing samples in PostgreSQL
