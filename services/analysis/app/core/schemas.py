"""
Output schemas for the analysis engine.

Every schema clearly separates MEASURED fields (directly from sensors)
from INFERRED fields (derived by algorithms). Downstream consumers
(coaching generator, UI) must respect this distinction.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class DataSource(str, Enum):
    MEASURED = "measured"
    INFERRED = "inferred"


class CornerPhase(str, Enum):
    APPROACH = "approach"
    BRAKING = "braking"
    TURN_IN = "turn_in"
    APEX = "apex"
    EXIT = "exit"


class LapValidity(str, Enum):
    VALID = "valid"
    TOO_SHORT = "too_short"
    TOO_LONG = "too_long"
    PARTIAL = "partial"


# ---------------------------------------------------------------------------
# Preprocessed sample — enriched with derived metrics
# ---------------------------------------------------------------------------
@dataclass
class ProcessedSample:
    """A single timestamped sample after preprocessing."""
    t: float  # normalized timestamp (seconds from session start)

    # GPS (measured)
    lat: float | None = None
    lng: float | None = None
    gps_speed_ms: float | None = None  # m/s from GPS chip
    gps_accuracy_m: float | None = None

    # IMU (measured)
    accel_x: float | None = None  # longitudinal (forward +)
    accel_y: float | None = None  # lateral (left +)
    accel_z: float | None = None  # vertical
    gyro_x: float | None = None
    gyro_y: float | None = None
    gyro_z: float | None = None

    # Derived / smoothed (inferred)
    speed_ms_smoothed: float | None = None  # smoothed speed estimate
    heading_deg: float | None = None  # course heading 0-360
    heading_change_deg_s: float | None = None  # rate of heading change
    lon_accel_g: float | None = None  # smoothed longitudinal G
    lat_accel_g: float | None = None  # smoothed lateral G
    cumulative_distance_m: float = 0.0  # running distance from start


# ---------------------------------------------------------------------------
# Lap detection output
# ---------------------------------------------------------------------------
@dataclass
class LapBoundary:
    lap_number: int
    start_time: float
    end_time: float
    lap_time_s: float
    validity: LapValidity = LapValidity.VALID
    invalid_reason: str | None = None

    # Summary stats (measured from GPS)
    max_speed_kmh: float | None = None
    avg_speed_kmh: float | None = None
    distance_m: float | None = None

    # Summary stats (measured from IMU)
    max_lateral_g: float | None = None
    max_braking_g: float | None = None


# ---------------------------------------------------------------------------
# Corner segmentation output
# ---------------------------------------------------------------------------
@dataclass
class CornerPhaseWindow:
    """Time window for a single phase of a corner."""
    phase: CornerPhase
    start_time: float
    end_time: float


@dataclass
class CornerSegment:
    corner_number: int
    corner_name: str
    entry_time: float
    apex_time: float
    exit_time: float
    corner_time_s: float
    phases: list[CornerPhaseWindow] = field(default_factory=list)

    # Track definition metadata
    direction: str = "unknown"  # "left" / "right"
    corner_type: str = "unknown"  # "hairpin", "sweeper", etc.


# ---------------------------------------------------------------------------
# Braking inference output
# ---------------------------------------------------------------------------
@dataclass
class BrakingEvent:
    """A single braking event detected within a corner or straight."""
    start_time: float  # inferred brake application
    end_time: float  # inferred brake release
    duration_s: float
    peak_decel_g: float  # maximum deceleration magnitude (positive value)
    peak_time: float  # timestamp of peak deceleration
    avg_decel_g: float  # average deceleration during event

    # Speed context (measured if GPS available)
    speed_at_start_kmh: float | None = None
    speed_at_end_kmh: float | None = None
    speed_reduction_kmh: float | None = None

    # Confidence: higher when IMU data is clean and GPS confirms speed loss
    confidence: float = 0.5
    data_sources: dict[str, str] = field(default_factory=lambda: {
        "start_time": "inferred",
        "end_time": "inferred",
        "peak_decel_g": "measured",
        "speed_at_start_kmh": "measured",
    })


# ---------------------------------------------------------------------------
# Exit acceleration output
# ---------------------------------------------------------------------------
@dataclass
class ExitAcceleration:
    """Post-apex acceleration analysis for a single corner."""
    corner_number: int
    apex_time: float
    throttle_pickup_time: float  # inferred: when driver begins accelerating
    throttle_delay_s: float  # time from apex to throttle pickup (lower = better)

    # Acceleration metrics
    peak_accel_g: float  # peak longitudinal acceleration after apex
    avg_accel_g: float  # average longitudinal acceleration in exit phase
    time_to_peak_s: float  # time from throttle pickup to peak accel

    # Speed recovery (measured)
    speed_at_apex_kmh: float | None = None
    speed_at_exit_kmh: float | None = None
    speed_gain_kmh: float | None = None

    # Quality score: 0-1, combines throttle delay and acceleration consistency
    exit_quality_score: float = 0.5
    confidence: float = 0.5
    data_sources: dict[str, str] = field(default_factory=lambda: {
        "throttle_pickup_time": "inferred",
        "throttle_delay_s": "inferred",
        "peak_accel_g": "measured",
        "speed_at_apex_kmh": "measured",
        "exit_quality_score": "inferred",
    })


# ---------------------------------------------------------------------------
# Per-corner combined analysis
# ---------------------------------------------------------------------------
@dataclass
class CornerAnalysisResult:
    """Full analysis for a single corner in a single lap."""
    corner_number: int
    corner_name: str
    segment: CornerSegment
    braking: BrakingEvent | None = None
    exit_accel: ExitAcceleration | None = None

    # Measured speeds
    entry_speed_kmh: float | None = None
    min_speed_kmh: float | None = None
    exit_speed_kmh: float | None = None
    peak_lateral_g: float | None = None

    confidence: float = 0.5


# ---------------------------------------------------------------------------
# Session-level output
# ---------------------------------------------------------------------------
@dataclass
class SessionAnalysisOutput:
    """Top-level output structure from the analysis engine."""
    laps: list[LapBoundary]
    corners: list[list[CornerAnalysisResult]]  # corners[lap_idx][corner_idx]
    session_summary: SessionSummary | None = None


@dataclass
class SessionSummary:
    total_laps: int
    valid_laps: int
    best_lap_number: int | None = None
    best_lap_time_s: float | None = None
    median_lap_time_s: float | None = None
    consistency_std_s: float | None = None
    total_distance_m: float | None = None
    analysis_version: str = ""
