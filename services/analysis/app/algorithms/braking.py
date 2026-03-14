"""
Braking Inference Algorithm

Estimates braking events from phone IMU data. Because consumer phones have
no brake-pressure sensor, all braking detection is INFERRED from longitudinal
deceleration patterns.

Algorithm overview:
  1. Scan smoothed longitudinal acceleration for sustained deceleration
  2. Mark brake-on when decel exceeds onset threshold for minimum duration
  3. Mark brake-off when decel drops below release threshold
  4. Identify peak braking region (maximum deceleration magnitude)
  5. Cross-reference with GPS speed for speed-loss validation
  6. Compute confidence based on IMU/GPS agreement

Inputs:
  - preprocessed samples for a corner window (approach through apex)
  - corner segment boundaries

Outputs:
  - BrakingEvent with start/end times, peak decel, speed context, confidence

Failure modes:
  - Downhill sections produce sustained decel without braking → false positive
  - Engine braking (no pedal input) looks similar to light braking
  - Phone orientation changes mid-session corrupt the lon_accel_g axis
  - Very late braking with < 2 samples may be missed
"""

from __future__ import annotations

from app.core.constants import (
    BRAKING_ONSET_G,
    BRAKING_HARD_G,
    BRAKING_RELEASE_G,
    BRAKING_MIN_DURATION_S,
    GPS_SPEED_UNIT_FACTOR,
    CONFIDENCE_BASE,
)
from app.core.schemas import ProcessedSample, BrakingEvent, CornerSegment


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_braking(
    samples: list[ProcessedSample],
    segment: CornerSegment,
    onset_g: float = BRAKING_ONSET_G,
    release_g: float = BRAKING_RELEASE_G,
    min_duration_s: float = BRAKING_MIN_DURATION_S,
) -> BrakingEvent | None:
    """
    Detect the primary braking event for a corner.

    Searches the approach + entry window (3s before entry through apex)
    for the strongest sustained deceleration event.

    Returns None if no significant braking is detected (e.g., flat-out corner).
    """
    # Search window: approach through apex
    t_start = segment.entry_time - 3.0
    t_end = segment.apex_time
    window = [s for s in samples if t_start <= s.t <= t_end]

    if not window:
        return None

    # Find all braking events in the window
    events = _find_braking_events(window, onset_g, release_g, min_duration_s)

    if not events:
        return None

    # Return the strongest event (highest peak decel)
    best = max(events, key=lambda e: e.peak_decel_g)

    # Enhance with GPS speed context
    _add_speed_context(best, samples)

    # Compute confidence
    best.confidence = _compute_braking_confidence(best, window)

    return best


def detect_all_braking_events(
    samples: list[ProcessedSample],
    onset_g: float = BRAKING_ONSET_G,
    release_g: float = BRAKING_RELEASE_G,
    min_duration_s: float = BRAKING_MIN_DURATION_S,
) -> list[BrakingEvent]:
    """
    Detect ALL braking events in a full sequence of samples.
    Useful for analyzing an entire lap.
    """
    return _find_braking_events(samples, onset_g, release_g, min_duration_s)


# ---------------------------------------------------------------------------
# Core detection
# ---------------------------------------------------------------------------

def _find_braking_events(
    samples: list[ProcessedSample],
    onset_g: float,
    release_g: float,
    min_duration_s: float,
) -> list[BrakingEvent]:
    """
    Scan for braking events using a state machine:
      IDLE → BRAKING (when lon_accel_g < -onset_g)
      BRAKING → IDLE (when lon_accel_g > -release_g)

    Events shorter than min_duration_s are discarded as noise.
    """
    events: list[BrakingEvent] = []

    in_braking = False
    brake_start_time: float = 0.0
    brake_samples: list[ProcessedSample] = []

    for s in samples:
        if s.lon_accel_g is None:
            continue

        decel = -s.lon_accel_g  # positive value = deceleration

        if not in_braking:
            if decel >= onset_g:
                # Braking onset detected
                in_braking = True
                brake_start_time = s.t
                brake_samples = [s]
        else:
            brake_samples.append(s)

            if decel < release_g:
                # Braking released
                in_braking = False
                event = _build_event(brake_start_time, s.t, brake_samples)
                if event is not None and event.duration_s >= min_duration_s:
                    events.append(event)
                brake_samples = []

    # Handle braking that extends to the end of the window
    if in_braking and brake_samples:
        event = _build_event(brake_start_time, brake_samples[-1].t, brake_samples)
        if event is not None and event.duration_s >= min_duration_s:
            events.append(event)

    return events


def _build_event(
    start_time: float,
    end_time: float,
    samples: list[ProcessedSample],
) -> BrakingEvent | None:
    """Construct a BrakingEvent from the collected braking samples."""
    if not samples:
        return None

    # Deceleration values (positive = decelerating)
    decels = [
        -s.lon_accel_g for s in samples
        if s.lon_accel_g is not None
    ]

    if not decels:
        return None

    peak_decel = max(decels)
    peak_idx = decels.index(peak_decel)
    peak_time = samples[peak_idx].t if peak_idx < len(samples) else start_time
    avg_decel = sum(decels) / len(decels)

    return BrakingEvent(
        start_time=start_time,
        end_time=end_time,
        duration_s=round(end_time - start_time, 3),
        peak_decel_g=round(peak_decel, 3),
        peak_time=peak_time,
        avg_decel_g=round(avg_decel, 3),
    )


# ---------------------------------------------------------------------------
# Speed context from GPS
# ---------------------------------------------------------------------------

def _add_speed_context(event: BrakingEvent, all_samples: list[ProcessedSample]) -> None:
    """
    Find GPS speed at braking start and end to validate the event.
    If GPS shows no speed reduction, the "braking" may be a false positive.
    """
    speed_at_start = _nearest_speed(all_samples, event.start_time)
    speed_at_end = _nearest_speed(all_samples, event.end_time)

    if speed_at_start is not None:
        event.speed_at_start_kmh = round(speed_at_start * GPS_SPEED_UNIT_FACTOR, 1)
    if speed_at_end is not None:
        event.speed_at_end_kmh = round(speed_at_end * GPS_SPEED_UNIT_FACTOR, 1)
    if speed_at_start is not None and speed_at_end is not None:
        event.speed_reduction_kmh = round(
            (speed_at_start - speed_at_end) * GPS_SPEED_UNIT_FACTOR, 1
        )


def _nearest_speed(
    samples: list[ProcessedSample], target_time: float
) -> float | None:
    """Find the GPS speed of the sample closest in time to target_time."""
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
# Confidence scoring
# ---------------------------------------------------------------------------

def _compute_braking_confidence(
    event: BrakingEvent,
    window_samples: list[ProcessedSample],
) -> float:
    """
    Score confidence in the braking detection.

    Factors:
      +0.2  if peak decel ≥ BRAKING_HARD_G (clearly braking, not engine braking)
      +0.2  if GPS confirms speed reduction ≥ 10 km/h
      +0.1  if event duration ≥ 1.0s (sustained, not a bump)
      -0.2  if no GPS speed data available for validation
    """
    confidence = CONFIDENCE_BASE

    # Strong deceleration → more likely real braking
    if event.peak_decel_g >= BRAKING_HARD_G:
        confidence += 0.2

    # GPS speed reduction validates the IMU reading
    if event.speed_reduction_kmh is not None:
        if event.speed_reduction_kmh >= 10.0:
            confidence += 0.2
        elif event.speed_reduction_kmh < 0:
            # Speed INCREASED during "braking" → suspicious
            confidence -= 0.2
    else:
        # No GPS validation available
        confidence -= 0.2

    # Sustained braking is more credible
    if event.duration_s >= 1.0:
        confidence += 0.1

    return round(max(0.1, min(1.0, confidence)), 2)
