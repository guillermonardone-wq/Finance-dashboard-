"""Pydantic models for the analysis pipeline — mirrors @racing-coach/types."""

from pydantic import BaseModel


class GpsSample(BaseModel):
    lat: float
    lng: float
    alt: float | None = None
    speed: float | None = None
    accuracy: float | None = None


class AccelSample(BaseModel):
    x: float
    y: float
    z: float


class GyroSample(BaseModel):
    x: float
    y: float
    z: float


class SensorSample(BaseModel):
    t: float  # seconds since session start
    gps: GpsSample | None = None
    accel: AccelSample | None = None
    gyro: GyroSample | None = None


class SensorMetadata(BaseModel):
    device: str | None = None
    app: str | None = None
    export_version: str | None = None
    session_start_utc: str | None = None


class SensorDataFile(BaseModel):
    metadata: SensorMetadata = SensorMetadata()
    samples: list[SensorSample]


class LapResult(BaseModel):
    lap_number: int
    start_time: float
    end_time: float
    lap_time_seconds: float
    is_valid: bool = True
    invalid_reason: str | None = None
    max_speed_kmh: float | None = None
    avg_speed_kmh: float | None = None
    max_lateral_g: float | None = None
    max_braking_g: float | None = None


class CornerSegment(BaseModel):
    corner_number: int
    entry_time: float
    apex_time: float
    exit_time: float
    corner_time_seconds: float


class CornerMetrics(BaseModel):
    corner_number: int
    entry_speed_kmh: float
    min_speed_kmh: float
    exit_speed_kmh: float
    peak_lateral_g: float
    peak_braking_g: float
    exit_accel_g: float | None = None
    braking_onset_time: float | None = None
    braking_distance_meters: float | None = None
    apex_offset_meters: float | None = None
    apex_timing_offset: float | None = None
    corner_time_seconds: float
    confidence: float = 0.5


class CornerFinding(BaseModel):
    corner_number: int
    corner_name: str
    corner_type: str
    direction: str
    findings: dict
    data_source: dict


class StructuredFindings(BaseModel):
    track_name: str
    lap_number: int
    corners: list[CornerFinding]


class AnalysisJobPayload(BaseModel):
    session_id: str
    sensor_data_key: str
    track_id: str
    analysis_job_id: str
    options: dict


class AnalysisResult(BaseModel):
    laps: list[LapResult]
    corners_per_lap: dict[int, list[CornerMetrics]]
    findings: StructuredFindings | None = None
    coaching: dict | None = None
