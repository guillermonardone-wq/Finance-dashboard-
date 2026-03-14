"""
Exit Acceleration Algorithm

Analyzes post-apex acceleration behavior to assess how well the driver
picks up throttle after the corner's minimum-speed point.

Algorithm overview:
  1. Identify the speed minimum (apex) within the corner
  2. Scan forward from apex for the first sustained positive longitudinal accel
  3. That point = "throttle pickup" (INFERRED — no throttle sensor)
  4. Measure acceleration profile from pickup to corner exit
  5. Compute exit quality score based on throttle delay, accel magnitude,
     and smoothness of application

Inputs:
  - preprocessed samples for a corner window (apex through exit + buffer)
  - corner segment boundaries

Outputs:
  - ExitAcceleration with timing, accel metrics, quality score, confidence

Failure modes:
  - Uphill sections produce positive lon_accel_g without throttle → false early pickup
  - Partial throttle application may be below detection threshold
  - AWD vs RWD cars have different accel signatures (not modeled here)
  - Wheelspin at exit produces high accel spikes that aren't real forward acceleration

Key assumption:
  "Throttle pickup" = first sustained positive longitudinal acceleration after
  the minimum-speed point. This is a simplification — the driver may trail-brake
  into the apex and overlap braking/throttle. We accept this limitation for MVP.
"""

from __future__ import annotations

from app.core.constants import (
    THROTTLE_PICKUP_ACCEL_G,
    EXIT_ACCEL_MIN_DURATION_S,
    EXIT_QUALITY_IDEAL_DELAY_S,
    GPS_SPEED_UNIT_FACTOR,
    CONFIDENCE_BASE,
    CONFIDENCE_GPS_BONUS,
    CONFIDENCE_IMU_BONUS,
)
from app.core.schemas import ProcessedSample, ExitAcceleration, CornerSegment


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_exit_acceleration(
    samples: list[ProcessedSample],
    segment: CornerSegment,
    pickup_threshold_g: float = THROTTLE_PICKUP_ACCEL_G,
    min_sustained_s: float = EXIT_ACCEL_MIN_DURATION_S,
) -> ExitAcceleration | None:
    """
    Analyze the exit acceleration for a single corner.

    Searches from apex to exit (+ 2s buffer) for the throttle pickup point,
    then characterizes the acceleration profile.

    Returns None if no meaningful acceleration is detected (e.g., the corner
    exits onto a straight that the driver doesn't accelerate on, which would
    be unusual but possible at slow corners or in traffic).
    """
    # Define the analysis window: apex to exit + buffer
    t_start = segment.apex_time
    t_end = segment.exit_time + 2.0
    window = [s for s in samples if t_start <= s.t <= t_end]

    if len(window) < 3:
        return None

    # Step 1: Find the minimum-speed point (true dynamic apex)
    apex_time, apex_speed = _find_speed_minimum(window, segment.apex_time)

    # Step 2: Find throttle pickup — first sustained positive lon accel after apex
    post_apex = [s for s in window if s.t >= apex_time]
    if len(post_apex) < 2:
        return None

    pickup_time = _find_throttle_pickup(
        post_apex, pickup_threshold_g, min_sustained_s
    )

    if pickup_time is None:
        # No throttle pickup detected — driver may be still braking or coasting
        return None

    throttle_delay = pickup_time - apex_time

    # Step 3: Analyze acceleration from pickup to exit
    accel_window = [s for s in post_apex if s.t >= pickup_time]
    if not accel_window:
        return None

    accel_metrics = _compute_accel_metrics(accel_window)

    # Step 4: Speed context
    speed_at_apex = _speed_at_time(window, apex_time)
    speed_at_exit = _speed_at_time(window, segment.exit_time)

    speed_gain = None
    if speed_at_apex is not None and speed_at_exit is not None:
        speed_gain = round(
            (speed_at_exit - speed_at_apex) * GPS_SPEED_UNIT_FACTOR, 1
        )

    # Step 5: Quality score
    quality = _compute_exit_quality(
        throttle_delay, accel_metrics, speed_gain
    )

    # Step 6: Confidence
    confidence = _compute_confidence(window, accel_window)

    return ExitAcceleration(
        corner_number=segment.corner_number,
        apex_time=apex_time,
        throttle_pickup_time=pickup_time,
        throttle_delay_s=round(throttle_delay, 3),
        peak_accel_g=accel_metrics["peak_g"],
        avg_accel_g=accel_metrics["avg_g"],
        time_to_peak_s=accel_metrics["time_to_peak_s"],
        speed_at_apex_kmh=(
            round(speed_at_apex * GPS_SPEED_UNIT_FACTOR, 1)
            if speed_at_apex is not None else None
        ),
        speed_at_exit_kmh=(
            round(speed_at_exit * GPS_SPEED_UNIT_FACTOR, 1)
            if speed_at_exit is not None else None
        ),
        speed_gain_kmh=speed_gain,
        exit_quality_score=quality,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Speed minimum detection
# ---------------------------------------------------------------------------

def _find_speed_minimum(
    samples: list[ProcessedSample],
    geometric_apex_time: float,
) -> tuple[float, float | None]:
    """
    Find the dynamic apex = point of minimum speed in the window.
    Falls back to the geometric apex time if no GPS speed is available.
    """
    min_speed: float | None = None
    min_time = geometric_apex_time

    for s in samples:
        if s.gps_speed_ms is None:
            continue
        if min_speed is None or s.gps_speed_ms < min_speed:
            min_speed = s.gps_speed_ms
            min_time = s.t

    return min_time, min_speed


# ---------------------------------------------------------------------------
# Throttle pickup detection
# ---------------------------------------------------------------------------

def _find_throttle_pickup(
    post_apex: list[ProcessedSample],
    threshold_g: float,
    min_sustained_s: float,
) -> float | None:
    """
    Find the first point where longitudinal acceleration exceeds the
    threshold for at least min_sustained_s.

    This filters out momentary bumps or sensor noise that might look
    like brief throttle application.
    """
    candidate_start: float | None = None

    for s in post_apex:
        if s.lon_accel_g is None:
            continue

        if s.lon_accel_g >= threshold_g:
            if candidate_start is None:
                candidate_start = s.t
            elif s.t - candidate_start >= min_sustained_s:
                # Sustained acceleration confirmed
                return candidate_start
        else:
            # Acceleration dropped below threshold — reset
            candidate_start = None

    return None


# ---------------------------------------------------------------------------
# Acceleration metrics
# ---------------------------------------------------------------------------

def _compute_accel_metrics(samples: list[ProcessedSample]) -> dict:
    """Compute peak, average, and time-to-peak for the acceleration phase."""
    accels = [
        (s.t, s.lon_accel_g)
        for s in samples
        if s.lon_accel_g is not None
    ]

    if not accels:
        return {"peak_g": 0.0, "avg_g": 0.0, "time_to_peak_s": 0.0}

    peak_g = max(a for _, a in accels)
    avg_g = sum(a for _, a in accels) / len(accels)

    # Time from first sample to peak
    t_first = accels[0][0]
    peak_time = next(t for t, a in accels if a == peak_g)
    time_to_peak = peak_time - t_first

    return {
        "peak_g": round(max(0, peak_g), 3),
        "avg_g": round(max(0, avg_g), 3),
        "time_to_peak_s": round(max(0, time_to_peak), 3),
    }


# ---------------------------------------------------------------------------
# Speed helpers
# ---------------------------------------------------------------------------

def _speed_at_time(
    samples: list[ProcessedSample], target_time: float
) -> float | None:
    """Find GPS speed of the sample closest to the target time."""
    best_dt = float("inf")
    best_speed: float | None = None

    for s in samples:
        if s.gps_speed_ms is None:
            continue
        dt = abs(s.t - target_time)
        if dt < best_dt:
            best_dt = dt
            best_speed = s.gps_speed_ms

    return best_speed


# ---------------------------------------------------------------------------
# Exit quality score
# ---------------------------------------------------------------------------

def _compute_exit_quality(
    throttle_delay_s: float,
    accel_metrics: dict,
    speed_gain_kmh: float | None,
) -> float:
    """
    Compute a 0-1 quality score for the corner exit.

    Factors (equal weight):
      1. Throttle delay: 0s = perfect (1.0), ≥3s = poor (0.0)
      2. Peak acceleration: higher = better (capped at 0.5G)
      3. Speed recovery: more speed gained = better (capped at 40 km/h)

    All factors are normalized to 0-1 and averaged.
    """
    # Factor 1: Throttle delay (lower is better)
    # 0s → 1.0, 3s → 0.0, linear
    delay_score = max(0.0, 1.0 - throttle_delay_s / 3.0)

    # Factor 2: Peak acceleration magnitude
    # 0G → 0.0, 0.5G → 1.0, linear
    peak_g = accel_metrics.get("peak_g", 0)
    accel_score = min(1.0, peak_g / 0.5)

    # Factor 3: Speed recovery
    if speed_gain_kmh is not None and speed_gain_kmh > 0:
        speed_score = min(1.0, speed_gain_kmh / 40.0)
    else:
        speed_score = 0.0

    # Weighted average
    quality = (delay_score * 0.4 + accel_score * 0.3 + speed_score * 0.3)
    return round(max(0.0, min(1.0, quality)), 2)


# ---------------------------------------------------------------------------
# Confidence
# ---------------------------------------------------------------------------

def _compute_confidence(
    full_window: list[ProcessedSample],
    accel_window: list[ProcessedSample],
) -> float:
    """
    Score confidence in the exit acceleration analysis.

    Higher confidence when:
      - Many GPS samples with speed data (validates accel reading)
      - Many IMU samples (smooth acceleration curve)
    """
    confidence = CONFIDENCE_BASE

    gps_count = sum(1 for s in full_window if s.gps_speed_ms is not None)
    imu_count = sum(1 for s in accel_window if s.lon_accel_g is not None)

    if gps_count >= 5:
        confidence += CONFIDENCE_GPS_BONUS
    if imu_count >= 5:
        confidence += CONFIDENCE_IMU_BONUS

    return round(max(0.1, min(1.0, confidence)), 2)
