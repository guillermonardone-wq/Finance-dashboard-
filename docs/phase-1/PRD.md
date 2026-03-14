# Racing Coach MVP — Product Requirements Document

**Version:** 1.1
**Date:** 2026-03-14
**Status:** Phase 1 — Planning (Revised)

---

## 1. Product Vision

A phone-first, post-session racing coach that helps amateur drivers improve lap times using only consumer hardware. No professional telemetry rigs, no CAN bus, no $5,000 data systems — just a phone in a mount, an optional camera, and a single earbud.

The product records phone sensor data during a track session, detects laps and corners, infers driving behavior from that data, and delivers corner-by-corner coaching feedback after each session.

---

## 2. Target User

### Primary Persona: "Weekend Track Driver"

- **Who:** Amateur motorsport enthusiast who does HPDE (High Performance Driving Education) days, autocross, or weekend track days
- **Age range:** 25–50
- **Experience level:** Beginner to intermediate — 2–30 track days under their belt
- **Current tools:** Maybe a GoPro, maybe a lap timer app, maybe nothing
- **Pain point:** They know they're slow, but they don't know *why*. Professional coaching is $300–$800/day. Telemetry systems cost $2,000+ and require installation
- **Budget:** Willing to pay $10–30/month for something that actually helps them improve
- **Hardware:** iPhone or Android (last 3 years), a phone mount (suction cup or clamp), possibly a GoPro or phone as secondary camera
- **Technical sophistication:** Can install an app and mount a phone. Cannot wire a CAN bus logger

### Secondary Persona: "Sim-to-Real Crossover"

- Sim racers transitioning to real track driving
- Familiar with telemetry concepts (racing lines, braking zones) from iRacing/Assetto Corsa
- Want to see how their real driving compares to what they learned in sim

### Non-Target Users (for MVP)

- Professional racing drivers (they have full telemetry)
- Karting-only drivers (different dynamics, GPS less useful)
- Street drivers wanting a "spirited driving" coach (liability, not the product)

---

## 3. User Stories

### Session Management

| ID | Story | Priority |
|----|-------|----------|
| US-01 | As a driver, I want to create a new driving session so I can start recording data for a track day | P0 |
| US-02 | As a driver, I want to select the track I'm driving at so the app knows the layout | P0 |
| US-03 | As a driver, I want to see a list of my past sessions so I can review previous coaching | P1 |
| US-04 | As a driver, I want to upload sensor data from an external source (CSV/JSON) so I can analyze sessions recorded with other apps | P1 |

### Data Capture

| ID | Story | Priority |
|----|-------|----------|
| US-05 | As a driver, I want the app to record GPS, accelerometer, and gyroscope data during my session so I can get analyzed later | P0 |
| US-06 | As a driver, I want the app to record at sufficient frequency (10–50 Hz for GPS, 50–100 Hz for IMU) so the data is useful | P0 |
| US-07 | As a driver, I want to record or upload video of my session so I can review it alongside the coaching | P1 |
| US-08 | As a driver, I want sensor data and video to be time-synchronized so coaching maps to what I see on screen | P1 |

### Track and Lap Detection

| ID | Story | Priority |
|----|-------|----------|
| US-09 | As a driver, I want the app to automatically detect when I cross the start/finish line so I get lap times | P0 |
| US-10 | As a driver, I want to see a list of all laps with their times so I can pick which ones to analyze | P0 |
| US-11 | As a driver, I want to manually set the start/finish line if automatic detection fails | P1 |

### Track Management

| ID | Story | Priority |
|----|-------|----------|
| US-19 | As an admin/power user, I want to upload a GPS trace from a track and define corner boundaries so I can add new tracks to the system | P0 | <!-- ADDED in v1.1: Track Builder -->
| US-20 | As an admin/power user, I want to name corners, set entry/apex/exit points, and classify corner type so the coaching is track-aware | P0 | <!-- ADDED in v1.1: Track Builder -->
| US-21 | As a driver, I want to see the track I'm driving visualized with labeled corners so I understand the analysis context | P1 | <!-- ADDED in v1.1: Track Builder -->

### Analysis

| ID | Story | Priority |
|----|-------|----------|
| US-12 | As a driver, I want the app to segment each lap into individual corners so I can see corner-by-corner performance | P0 |
| US-13 | As a driver, I want the app to infer my braking zones, turn-in points, apex timing, and corner exit quality | P0 |
| US-14 | As a driver, I want to compare any lap against my best lap to see where I gained or lost time per corner | P0 | <!-- CHANGED in v1.1: promoted to P0, clarified scope -->

### Coaching

| ID | Story | Priority |
|----|-------|----------|
| US-15 | As a driver, I want a corner-by-corner coaching summary telling me what I did well and what to improve | P0 |
| US-16 | As a driver, I want the top 3 improvement opportunities for my next session | P0 |
| US-17 | As a driver, I want a short audio recap (server-generated MP3) I can listen to before my next session via earbud | P0 | <!-- CHANGED in v1.1: server-side TTS -->
| US-18 | As a driver, I want coaching language to be clear about what is directly measured vs. inferred | P0 |

---

## 4. MVP Scope

### In Scope (v1)

1. **Session creation** — create, name, associate with a track
2. **Sensor data capture/upload** — record from phone or upload CSV/JSON with timestamps, GPS (lat/lng/alt), accelerometer (x/y/z), gyroscope (x/y/z)
3. **Track selection** — pick from a curated list of tracks with known layouts (start with 20–50 popular tracks)
3b. **Track Builder tool** — admin/power-user tool to upload a GPS trace, define start/finish line, and set corner boundaries (entry/apex/exit points, name, type) so new tracks can be added without code changes <!-- ADDED in v1.1 -->
4. **Video upload** — upload a video file, store reference, basic playback
5. **Lap detection** — detect start/finish line crossings from GPS trace
6. **Corner segmentation** — divide each lap into corners using GPS trace + track map
7. **Driving behavior inference** — infer braking zones, turn-in, apex, exit from sensor fusion (GPS speed changes + lateral G + yaw rate)
8. **Corner-by-corner coaching** — text-based summary per corner with assessments
9. **Top 3 improvements** — ranked list of where the driver loses the most time
9b. **Lap comparison** — compare any lap vs best lap: entry speed, corner minimum speed, exit acceleration, and time delta per corner <!-- ADDED in v1.1 -->
10. **Audio recap** — server-generated MP3 audio summary of coaching feedback (via TTS API), downloadable and replayable <!-- CHANGED in v1.1: server-side TTS -->

### Out of Scope (v1 Non-Goals)

- **Real-time coaching** — no live audio during driving (Phase 3+)
- **Video analysis / computer vision** — no ML on video content (Phase 3+)
- **CAN bus / OBD-II integration** — consumer hardware only
- **Social features** — no leaderboards, sharing, or multiplayer
- **Tire/fuel/weather modeling** — too complex for MVP
- **Sim racing integration** — future phase
- **iOS/Android native app** — start as responsive web app (PWA), native later
- **Paid subscriptions / billing** — free during MVP validation
- **Multi-car comparison** — single user, single car focus
- **Professional coaching marketplace** — future phase

---

## 5. Measured vs. Inferred Data

This distinction is critical. We must be honest with users about what we actually know vs. what we're estimating.

### Directly Measured (from phone sensors)

| Data Point | Source | Typical Accuracy | Sample Rate |
|-----------|--------|-----------------|-------------|
| Position (lat/lng) | Phone GPS | 3–5m CEP (open sky), 5–15m (trees/buildings) | 1–10 Hz (OS-dependent) |
| Speed | GPS-derived (Doppler) | ±1–2 km/h at speed | 1–10 Hz |
| Lateral acceleration | Accelerometer | ±0.05g (after calibration) | 50–100 Hz |
| Longitudinal acceleration | Accelerometer | ±0.05g (after calibration) | 50–100 Hz |
| Yaw rate | Gyroscope | ±1°/s | 50–100 Hz |
| Timestamps | System clock | <1ms | Matches sensor rate |
| Altitude | GPS/barometer | ±5–15m (GPS), ±1m (barometer) | 1–10 Hz |

### Inferred (calculated from measured data)

| Data Point | Method | Confidence | Caveat |
|-----------|--------|------------|--------|
| Lap boundaries | GPS crossing a defined start/finish line | High | Depends on GPS accuracy; may need ±10m gate width |
| Corner entry/exit points | Curvature analysis of GPS trace + lateral G onset | Medium-High | GPS noise can create phantom corners at low speed |
| Braking zone start | Longitudinal deceleration onset (>0.3g sustained) | Medium | Cannot distinguish engine braking vs. brake pedal; grades affect reading |
| Braking zone end | Deceleration drops below threshold | Medium | Trail braking makes this fuzzy by design |
| Turn-in point | First significant lateral acceleration + yaw rate change | Medium | Transition zones are gradual, not binary |
| Apex timing | Point of minimum radius (max lateral G) relative to geometric apex | Medium | Geometric apex from track map may not match racing apex |
| Corner exit quality | Speed gain rate + lateral G reduction pattern | Medium | Affected by car power, traction, driver throttle style |
| Time lost/gained per corner | Delta to driver's own best corner performance | Medium-High | Requires multiple laps; early laps have no baseline |
| Racing line | GPS trace smoothed and mapped to track | Medium | GPS scatter means ±3–5m uncertainty in line position |

### What We Cannot Measure (and should not pretend to)

- Brake pressure or pedal position
- Throttle position or percentage
- Steering angle
- Tire grip / slip angle
- Engine RPM or gear selection
- Weight transfer (directly — we infer from accel data)

**Product rule:** Every coaching insight must label itself as "measured" or "inferred" and include a confidence indicator.

---

## 6. Technical Risks and Mitigations

### Risk 1: Phone GPS Accuracy Is Insufficient

**Impact:** High — GPS is the backbone of lap detection, corner mapping, and speed calculation
**Likelihood:** Medium — modern phones are 3–5m in open sky, but racetracks can have tree lines, buildings, grandstands

**Mitigations:**
- Use GPS Doppler speed (more accurate than position-derived speed)
- Apply Kalman filtering to fuse GPS with accelerometer/gyroscope (IMU-aided positioning)
- Use wider start/finish gate (±10–15m) for lap detection
- Allow user to manually correct lap boundaries
- Test on 3+ tracks with 3+ phone models before shipping

### Risk 2: Phone Sensor Sample Rates Vary by Device/OS

**Impact:** Medium — inconsistent data quality across devices
**Likelihood:** High — Android and iOS expose sensors differently; background apps compete for resources

**Mitigations:**
- Set minimum supported sample rates (GPS: 1 Hz, IMU: 50 Hz)
- Interpolate/resample to a canonical rate in the analysis pipeline
- Show data quality indicator to user ("Good", "Fair", "Poor")
- Document supported devices and known issues
- Consider using the Web Sensor API initially, with native fallback later

### Risk 3: Corner Segmentation Fails on Unfamiliar Tracks

**Impact:** Medium — bad segmentation means bad coaching
**Likelihood:** Medium — works well on tracks with distinct corners, poorly on flowing circuits

**Mitigations:**
- Start with curated track database with pre-defined corner segments
- Allow users to manually adjust corner boundaries
- Use a hybrid approach: pre-defined corners as baseline, GPS trace to refine
- Treat "corner" detection as a tunable parameter per track

### Risk 4: Coaching Quality Is Too Generic to Be Useful

**Impact:** High — if coaching says "brake later" for every corner, users won't come back
**Likelihood:** Medium — limited sensor data constrains specificity

**Mitigations:**
- Focus on *relative* coaching (compare driver's laps to each other, not to an ideal)
- Use corner-specific context ("In Turn 3, you're braking 15m earlier than your best lap")
- Include confidence levels so users calibrate trust
- Use LLM (Claude API) for natural language generation with structured data input
- Plan for user feedback loop: "Was this coaching helpful?" per corner

### Risk 5: Video-Sensor Synchronization Is Difficult

**Impact:** Low-Medium — video is P1, not P0; nice-to-have for MVP
**Likelihood:** High — phone clock vs. camera clock drift, different start times

**Mitigations:**
- For MVP, approximate sync using session start time + manual offset
- Show video alongside data graphs; let user drag to align
- Future: use audio spike detection (engine note) or visual marker for auto-sync

### Risk 6: Data Storage and Processing Costs

**Impact:** Medium — sensor data at 100 Hz for a 30-minute session = ~18M data points
**Likelihood:** Medium — depends on user volume

**Mitigations:**
- Store raw sensor data as compressed binary (not row-per-sample in PostgreSQL)
- Use PostgreSQL for metadata, session info, lap summaries
- Store raw sensor data as compressed JSON/binary files in object storage (S3/local filesystem for MVP)
- Process analysis jobs asynchronously (queue-based)
- MVP: process locally, add cloud scaling later

---

## 7. Simplest Path to Working v1

### Guiding Principle: "Fake it till you sense it"

The fastest way to a working v1 is to **decouple data capture from analysis**, build a minimal pipeline, and test with real data as early as possible.

### Recommended Approach

1. **Start with uploaded data, not live capture**
   - Build the upload + analysis pipeline first
   - Use existing apps (PhyPhox, Sensor Logger, Harry's Lap Timer exports) to capture test data
   - This lets us validate the analysis engine before building our own recorder
   - Add live recording as a second step once the pipeline works

2. **Use a curated track database, not auto-detection**
   - Seed with 20–50 popular tracks (GPS coordinates, corner definitions)
   - Skip track auto-detection entirely for v1
   - Let users request tracks to be added

3. **Build the analysis in Python, everything else in Next.js**
   - Python has the best libraries for signal processing (scipy, numpy)
   - Next.js handles UI, session management, data upload
   - Communicate via REST API or job queue
   - Keep the boundary clean: Next.js sends raw data, Python returns structured analysis

4. **Use Claude API for coaching text generation — from structured data only** <!-- CHANGED in v1.1: clarified data boundary -->
   - **Claude does NOT receive raw telemetry data.** The Python analysis engine processes raw sensor data and produces structured per-corner findings first
   - Claude receives a structured JSON object per corner (e.g., `{entry_speed, best_entry_speed, brake_distance, optimal_brake_distance, exit_delay, confidence}`)
   - Claude converts these structured findings into natural language coaching insights
   - Prompt engineering for racing-coach tone and honesty about confidence
   - Generates both text summaries and audio script

5. **Use server-side TTS API for audio** <!-- CHANGED in v1.1: replaced browser TTS -->
   - Server generates MP3 files via TTS API (OpenAI TTS / ElevenLabs / similar)
   - Consistent voice quality across all devices and browsers
   - Audio files are cacheable and replayable (download for offline listening before next session)
   - Reliable playback via single earbud — no browser TTS inconsistencies
   - Audio stored in object storage alongside other generated files

6. **Ship as a responsive web app**
   - No app store review process
   - Works on any phone
   - PWA for offline-capable future
   - Native app can come in Phase 3+

### Critical Path (shortest sequence to "it works")

```
Upload sensor CSV → Parse & validate → Detect laps → Segment corners →
Calculate per-corner metrics → Generate coaching text → Display results
```

Everything else (video, live recording, audio recap, lap comparison) layers on top of this core loop.
