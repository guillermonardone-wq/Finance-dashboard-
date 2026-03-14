"""
Physical constants, tuning thresholds, and default parameters.

All thresholds are intentionally conservative for consumer-grade phone sensors.
Tighten as real-world data validates accuracy.
"""

import math

# ---------------------------------------------------------------------------
# Physical constants
# ---------------------------------------------------------------------------
EARTH_RADIUS_M = 6_371_000  # meters
GRAVITY_MS2 = 9.80665  # m/s²

# ---------------------------------------------------------------------------
# GPS noise envelope
# Consumer phone GPS accuracy: ~3-8 m CEP under open sky.
# We treat any two points closer than MIN_GPS_MOVEMENT_M as stationary noise.
# ---------------------------------------------------------------------------
MIN_GPS_MOVEMENT_M = 3.0  # ignore micro-jitter below this distance
GPS_SPEED_UNIT_FACTOR = 3.6  # m/s → km/h

# ---------------------------------------------------------------------------
# Lap detection
# ---------------------------------------------------------------------------
SF_LINE_CROSSING_TOLERANCE_M = 25.0  # how wide the virtual S/F gate is
LAP_MIN_TIME_S = 30.0  # anything shorter is a false crossing / pit exit
LAP_MAX_TIME_S = 600.0  # anything longer is an incomplete lap
CROSSING_DEBOUNCE_S = 10.0  # ignore repeat crossings within this window

# ---------------------------------------------------------------------------
# Corner segmentation
# ---------------------------------------------------------------------------
CORNER_ZONE_TOLERANCE_M = 20.0  # default radius for entry/apex/exit matching
APPROACH_WINDOW_S = 3.0  # seconds before corner entry to include
EXIT_WINDOW_S = 2.0  # seconds after corner exit to include

# ---------------------------------------------------------------------------
# Braking detection thresholds
# Longitudinal deceleration in G. Phone accelerometers are noisy, so we
# require a sustained decel above the threshold, not a single spike.
# ---------------------------------------------------------------------------
BRAKING_ONSET_G = 0.20  # minimum decel to begin a braking event (post-smoothing)
BRAKING_HARD_G = 0.6  # threshold for "hard braking" region
BRAKING_RELEASE_G = 0.10  # decel must drop below this to end braking
BRAKING_MIN_DURATION_S = 0.3  # braking events shorter than this are noise
BRAKING_SMOOTHING_WINDOW = 5  # samples for moving-average filter

# ---------------------------------------------------------------------------
# Exit acceleration
# ---------------------------------------------------------------------------
THROTTLE_PICKUP_ACCEL_G = 0.10  # minimum longitudinal accel = "on throttle"
EXIT_ACCEL_MIN_DURATION_S = 0.5  # sustained accel below this is noise
EXIT_QUALITY_IDEAL_DELAY_S = 0.0  # perfect exit = throttle at apex

# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
SMOOTHING_WINDOW_SIZE = 5  # samples for moving-average smoothing
MIN_SAMPLES_FOR_ANALYSIS = 10  # need at least this many GPS points
HEADING_CHANGE_MIN_DISTANCE_M = 2.0  # minimum distance to compute heading

# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------
CONFIDENCE_GPS_BONUS = 0.20  # added when ≥ 5 GPS samples in segment
CONFIDENCE_IMU_BONUS = 0.20  # added when ≥ 10 accel samples in segment
CONFIDENCE_BASE = 0.50  # baseline confidence
CONFIDENCE_MAX = 1.0
CONFIDENCE_LOW_THRESHOLD = 0.4  # below this, flag as low confidence
