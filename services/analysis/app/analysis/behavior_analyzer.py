"""
Behavior Analysis Module

Analyzes driving behavior per corner: speeds, braking, lateral G, apex timing.

Input: Full sensor data for one lap + corner segments
Output: Per-corner metrics with measured/inferred labels
"""

from app.models.schemas import SensorSample, CornerSegment, CornerMetrics


def analyze_corner(
    samples: list[SensorSample],
    segment: CornerSegment,
    braking_g_threshold: float = 0.3,
) -> CornerMetrics:
    """
    Analyze driving behavior for a single corner.

    All speeds from GPS (MEASURED).
    Braking onset and apex timing are INFERRED.
    """
    # Get samples within the corner window
    corner_samples = [
        s for s in samples if segment.entry_time <= s.t <= segment.exit_time
    ]

    # Get samples in the approach zone (2 seconds before entry)
    approach_samples = [
        s for s in samples
        if (segment.entry_time - 2.0) <= s.t < segment.entry_time
    ]

    # MEASURED: Speeds from GPS
    gps_in_corner = [s for s in corner_samples if s.gps and s.gps.speed is not None]

    if not gps_in_corner:
        # Fallback with placeholder values
        return CornerMetrics(
            corner_number=segment.corner_number,
            entry_speed_kmh=0,
            min_speed_kmh=0,
            exit_speed_kmh=0,
            peak_lateral_g=0,
            peak_braking_g=0,
            corner_time_seconds=segment.corner_time_seconds,
            confidence=0.1,
        )

    speeds_kmh = [s.gps.speed * 3.6 for s in gps_in_corner]  # type: ignore

    entry_speed = speeds_kmh[0] if speeds_kmh else 0
    exit_speed = speeds_kmh[-1] if speeds_kmh else 0
    min_speed = min(speeds_kmh) if speeds_kmh else 0

    # MEASURED: Accelerations from IMU
    accel_samples = [s for s in corner_samples if s.accel is not None]

    lateral_gs = [abs(s.accel.y / 9.81) for s in accel_samples if s.accel]  # type: ignore
    braking_gs = [abs(min(0, s.accel.x / 9.81)) for s in accel_samples if s.accel]  # type: ignore

    peak_lateral_g = max(lateral_gs) if lateral_gs else 0
    peak_braking_g = max(braking_gs) if braking_gs else 0

    # INFERRED: Braking zone detection
    braking_onset_time = None
    all_approach = approach_samples + corner_samples
    accel_approach = [s for s in all_approach if s.accel is not None]

    for s in accel_approach:
        if s.accel and (s.accel.x / 9.81) < -braking_g_threshold:
            braking_onset_time = s.t
            break

    # INFERRED: Apex timing offset (how far from geometric middle)
    geometric_apex_time = segment.apex_time
    min_speed_time = gps_in_corner[0].t
    for s in gps_in_corner:
        if s.gps and s.gps.speed is not None:
            if s.gps.speed * 3.6 <= min_speed + 0.5:
                min_speed_time = s.t

    apex_timing_offset = min_speed_time - geometric_apex_time

    # Exit acceleration
    exit_accel_g = None
    exit_samples = [s for s in corner_samples if s.t > segment.apex_time and s.accel]
    if exit_samples:
        exit_accel_g = sum(
            s.accel.x / 9.81 for s in exit_samples if s.accel  # type: ignore
        ) / len(exit_samples)

    # Confidence based on data availability
    confidence = 0.5
    if len(gps_in_corner) >= 5:
        confidence += 0.2
    if len(accel_samples) >= 10:
        confidence += 0.2
    confidence = min(confidence, 1.0)

    return CornerMetrics(
        corner_number=segment.corner_number,
        entry_speed_kmh=round(entry_speed, 1),
        min_speed_kmh=round(min_speed, 1),
        exit_speed_kmh=round(exit_speed, 1),
        peak_lateral_g=round(peak_lateral_g, 2),
        peak_braking_g=round(peak_braking_g, 2),
        exit_accel_g=round(exit_accel_g, 3) if exit_accel_g else None,
        braking_onset_time=braking_onset_time,
        apex_timing_offset=round(apex_timing_offset, 3) if apex_timing_offset else None,
        corner_time_seconds=segment.corner_time_seconds,
        confidence=round(confidence, 2),
    )


def analyze_lap(
    samples: list[SensorSample],
    segments: list[CornerSegment],
    braking_g_threshold: float = 0.3,
) -> list[CornerMetrics]:
    """Analyze all corners in a single lap."""
    return [
        analyze_corner(samples, seg, braking_g_threshold)
        for seg in segments
    ]
