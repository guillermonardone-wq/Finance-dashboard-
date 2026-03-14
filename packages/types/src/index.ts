// ─────────────────────────────────────────────
// API Request/Response Types
// Shared between Next.js frontend and API routes
// ─────────────────────────────────────────────

// Session
export interface CreateSessionRequest {
  name: string;
  trackId: string;
  date: string; // ISO 8601
  carName?: string;
  carNotes?: string;
  conditions?: "dry" | "wet" | "mixed";
}

export interface SessionResponse {
  id: string;
  name: string;
  trackId: string;
  trackName: string;
  date: string;
  carName: string | null;
  carNotes: string | null;
  conditions: string | null;
  status: SessionStatusType;
  dataQuality: string | null;
  totalSamples: number | null;
  durationSeconds: number | null;
  createdAt: string;
}

export type SessionStatusType =
  | "CREATED"
  | "DATA_UPLOADED"
  | "ANALYZING"
  | "ANALYSIS_COMPLETE"
  | "ANALYSIS_FAILED";

// Track
export interface TrackResponse {
  id: string;
  name: string;
  location: string;
  country: string;
  lengthMeters: number | null;
  cornerCount: number;
  source: string;
}

export interface TrackCornerResponse {
  id: string;
  number: number;
  name: string | null;
  type: string | null;
  direction: string | null;
  entryLat: number;
  entryLng: number;
  apexLat: number;
  apexLng: number;
  exitLat: number;
  exitLng: number;
}

// Upload
export interface SensorUploadResponse {
  id: string;
  sessionId: string;
  storageKey: string;
  fileName: string;
  fileSize: number;
  format: string;
  sampleCount: number | null;
}

export interface VideoUploadResponse {
  id: string;
  sessionId: string;
  storageKey: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number | null;
}

// Analysis
export interface AnalysisJobResponse {
  id: string;
  sessionId: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: string | null;
  progressPercent: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface StartAnalysisResponse {
  jobId: string;
  status: "queued";
}

// Lap
export interface LapResponse {
  id: string;
  lapNumber: number;
  lapTimeSeconds: number;
  isValid: boolean;
  invalidReason: string | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  maxLateralG: number | null;
  maxBrakingG: number | null;
}

// Corner Analysis
export interface CornerAnalysisResponse {
  cornerNumber: number;
  cornerName: string | null;
  entrySpeedKmh: number;
  minSpeedKmh: number;
  exitSpeedKmh: number;
  peakLateralG: number;
  peakBrakingG: number;
  cornerTimeSeconds: number;
  brakingDistanceMeters: number | null;
  apexTimingOffset: number | null;
  deltaVsBestSeconds: number | null;
  confidence: number;
}

// Coaching
export interface CoachingResponse {
  summaryText: string;
  top3Improvements: TopImprovement[];
  cornerCoaching: CornerCoaching[];
  audioStorageKey: string | null;
}

export interface TopImprovement {
  cornerNumber: number;
  suggestion: string;
  estimatedTimeSave: number;
}

export interface CornerCoaching {
  cornerNumber: number;
  coachingText: string;
  confidence: number;
  measuredInsights: string[];
  inferredInsights: string[];
}

// Session Analysis (combined view)
export interface SessionAnalysisResponse {
  session: SessionResponse;
  analysis: {
    totalLaps: number;
    validLaps: number;
    bestLapNumber: number | null;
    bestLapTime: number | null;
    medianLapTime: number | null;
    consistency: number | null;
    status: string;
  } | null;
  laps: LapResponse[];
  coaching: CoachingResponse | null;
  job: AnalysisJobResponse | null;
}

// ─────────────────────────────────────────────
// Sensor Data Format (upload schema)
// ─────────────────────────────────────────────

export interface SensorDataFile {
  metadata: {
    device?: string;
    app?: string;
    export_version?: string;
    session_start_utc?: string;
  };
  samples: SensorSample[];
}

export interface SensorSample {
  t: number; // seconds since session start
  gps?: {
    lat: number;
    lng: number;
    alt?: number;
    speed?: number;
    accuracy?: number;
  };
  accel?: {
    x: number;
    y: number;
    z: number;
  };
  gyro?: {
    x: number;
    y: number;
    z: number;
  };
}

// ─────────────────────────────────────────────
// Analysis Worker Job Payload
// ─────────────────────────────────────────────

export interface AnalysisJobPayload {
  sessionId: string;
  sensorDataKey: string;
  trackId: string;
  analysisJobId: string;
  options: {
    minLapTimeSeconds: number;
    maxLapTimeSeconds: number;
    brakingGThreshold: number;
    cornerCurvatureThreshold: number;
  };
}

// ─────────────────────────────────────────────
// Structured Findings (Python → Claude API)
// ─────────────────────────────────────────────

export interface StructuredFindings {
  track_name: string;
  lap_number: number;
  corners: CornerFinding[];
}

export interface CornerFinding {
  corner_number: number;
  corner_name: string;
  corner_type: string;
  direction: string;
  findings: {
    entry_speed_kmh: number;
    best_entry_speed_kmh: number;
    entry_speed_delta: number;
    min_speed_kmh: number;
    best_min_speed_kmh: number;
    exit_speed_kmh: number;
    best_exit_speed_kmh: number;
    brake_distance_meters: number;
    best_brake_distance_meters: number;
    brake_distance_delta_meters: number;
    apex_timing_offset_seconds: number;
    exit_acceleration_delay_seconds: number;
    corner_time_seconds: number;
    best_corner_time_seconds: number;
    time_delta_seconds: number;
    peak_lateral_g: number;
    confidence: number;
  };
  data_source: {
    measured: string[];
    inferred: string[];
  };
}
