"""
Lap Detection Algorithm

Detects lap boundaries by finding where the GPS trace crosses the
start/finish line defined by two GPS endpoints.

Algorithm overview:
  1. Iterate consecutive GPS sample pairs
  2. Test each pair against the S/F line using line-segment intersection
  3. Interpolate exact crossing time via linear interpolation
  4. Debounce rapid re-crossings (e.g., weaving near the line)
  5. Classify each lap as valid, too_short, too_long, or partial

Inputs:
  - preprocessed samples (list[ProcessedSample])
  - start/finish line definition (two GPS endpoints)

Outputs:
  - list[LapBoundary] with timing, validity, and summary stats

Failure modes:
  - GPS dropout across the S/F line → missed crossing
  - Low sample rate → segment between two points may skip over the line
  - False crossings from pit lane or track cuts
"""

from __future__ import annotations

from app.core.constants import (
    LAP_MIN_TIME_S,
    LAP_MAX_TIME_S,
    CROSSING_DEBOUNCE_S,
    GPS_SPEED_UNIT_FACTOR,
    GRAVITY_MS2,
)
from app.core.schemas import LapBoundary, LapValidity, ProcessedSample


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_laps(
    samples: list[ProcessedSample],
    sf_line: dict,
    min_lap_time: float = LAP_MIN_TIME_S,
    max_lap_time: float = LAP_MAX_TIME_S,
    debounce_s: float = CROSSING_DEBOUNCE_S,
) -> list[LapBoundary]:
    """
    Detect laps from preprocessed samples.

    sf_line format:
        {"lat1": float, "lng1": float, "lat2": float, "lng2": float}

    Returns a list of LapBoundary objects. The first crossing establishes
    lap 1 start; each subsequent valid crossing closes the current lap
    and opens the next.
    """
    if len(samples) < 10:
        return []

    # Find all S/F crossings
    crossings = _find_crossings(samples, sf_line)

    # Debounce: remove crossings too close together
    crossings = _debounce_crossings(crossings, debounce_s)

    if len(crossings) < 2:
        return []

    # Build laps from crossing pairs
    laps: list[LapBoundary] = []
    for i in range(1, len(crossings)):
        lap_time = crossings[i] - crossings[i - 1]

        # Classify validity
        if lap_time < min_lap_time:
            validity = LapValidity.TOO_SHORT
            reason = f"Lap time {lap_time:.1f}s below minimum {min_lap_time}s"
        elif lap_time > max_lap_time:
            validity = LapValidity.TOO_LONG
            reason = f"Lap time {lap_time:.1f}s above maximum {max_lap_time}s"
        else:
            validity = LapValidity.VALID
            reason = None

        # Gather samples within this lap window
        lap_samples = [s for s in samples if crossings[i - 1] <= s.t <= crossings[i]]

        # Summary statistics
        stats = _compute_lap_stats(lap_samples)

        laps.append(LapBoundary(
            lap_number=i,
            start_time=crossings[i - 1],
            end_time=crossings[i],
            lap_time_s=round(lap_time, 3),
            validity=validity,
            invalid_reason=reason,
            **stats,
        ))

    return laps


def get_lap_samples(
    samples: list[ProcessedSample],
    lap: LapBoundary,
) -> list[ProcessedSample]:
    """Extract samples belonging to a specific lap."""
    return [s for s in samples if lap.start_time <= s.t <= lap.end_time]


# ---------------------------------------------------------------------------
# Crossing detection
# ---------------------------------------------------------------------------

def _find_crossings(
    samples: list[ProcessedSample],
    sf_line: dict,
) -> list[float]:
    """
    Find all timestamps where the GPS trace crosses the S/F line.

    Uses line-segment intersection between consecutive GPS points and
    the S/F line segment. Crossing time is linearly interpolated.
    """
    crossings: list[float] = []

    lat1 = sf_line["lat1"]
    lng1 = sf_line["lng1"]
    lat2 = sf_line["lat2"]
    lng2 = sf_line["lng2"]

    for i in range(1, len(samples)):
        prev = samples[i - 1]
        curr = samples[i]

        if prev.lat is None or curr.lat is None:
            continue

        if _segments_intersect(
            prev.lat, prev.lng,  # type: ignore
            curr.lat, curr.lng,  # type: ignore
            lat1, lng1, lat2, lng2,
        ):
            # Interpolate crossing time based on distance to line
            t_cross = _interpolate_crossing_time(
                prev, curr, lat1, lng1, lat2, lng2
            )
            crossings.append(t_cross)

    return crossings


def _interpolate_crossing_time(
    prev: ProcessedSample,
    curr: ProcessedSample,
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    """
    Linearly interpolate the crossing time using the parametric intersection
    point of the two line segments.

    Falls back to midpoint if computation fails.
    """
    # Parametric intersection: find t where prev + t*(curr - prev) crosses the line
    dx = curr.lat - prev.lat  # type: ignore
    dy = curr.lng - prev.lng  # type: ignore
    ex = lat2 - lat1
    ey = lng2 - lng1

    denom = dx * ey - dy * ex
    if abs(denom) < 1e-15:
        # Lines are nearly parallel — use midpoint
        return (prev.t + curr.t) / 2.0

    fx = lat1 - prev.lat  # type: ignore
    fy = lng1 - prev.lng  # type: ignore
    t_param = (fx * ey - fy * ex) / denom

    # Clamp to [0, 1] for safety
    t_param = max(0.0, min(1.0, t_param))

    return prev.t + t_param * (curr.t - prev.t)


# ---------------------------------------------------------------------------
# Debounce
# ---------------------------------------------------------------------------

def _debounce_crossings(crossings: list[float], min_gap_s: float) -> list[float]:
    """
    Remove crossings that occur within min_gap_s of the previous crossing.
    This handles cases where the car weaves near the S/F line or GPS jitter
    causes multiple false crossings.
    """
    if not crossings:
        return []

    filtered = [crossings[0]]
    for t in crossings[1:]:
        if t - filtered[-1] >= min_gap_s:
            filtered.append(t)

    return filtered


# ---------------------------------------------------------------------------
# Lap statistics
# ---------------------------------------------------------------------------

def _compute_lap_stats(samples: list[ProcessedSample]) -> dict:
    """Compute summary statistics for a set of lap samples."""
    speeds_kmh = [
        s.gps_speed_ms * GPS_SPEED_UNIT_FACTOR
        for s in samples
        if s.gps_speed_ms is not None
    ]

    lat_gs = [
        abs(s.lat_accel_g) for s in samples if s.lat_accel_g is not None
    ]
    braking_gs = [
        abs(s.lon_accel_g) for s in samples
        if s.lon_accel_g is not None and s.lon_accel_g < 0
    ]

    # Distance = last cumulative distance minus first
    distance = None
    if len(samples) >= 2:
        distance = round(
            samples[-1].cumulative_distance_m - samples[0].cumulative_distance_m, 1
        )

    return {
        "max_speed_kmh": round(max(speeds_kmh), 1) if speeds_kmh else None,
        "avg_speed_kmh": round(sum(speeds_kmh) / len(speeds_kmh), 1) if speeds_kmh else None,
        "distance_m": distance,
        "max_lateral_g": round(max(lat_gs), 2) if lat_gs else None,
        "max_braking_g": round(max(braking_gs), 2) if braking_gs else None,
    }


# ---------------------------------------------------------------------------
# Geometry: line-segment intersection
# ---------------------------------------------------------------------------

def _segments_intersect(
    ax1: float, ay1: float, ax2: float, ay2: float,
    bx1: float, by1: float, bx2: float, by2: float,
) -> bool:
    """
    Test whether two 2D line segments intersect.
    Uses the cross-product orientation method.
    """
    def cross(ox: float, oy: float, ax: float, ay: float, bx: float, by: float) -> float:
        return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)

    d1 = cross(bx1, by1, bx2, by2, ax1, ay1)
    d2 = cross(bx1, by1, bx2, by2, ax2, ay2)
    d3 = cross(ax1, ay1, ax2, ay2, bx1, by1)
    d4 = cross(ax1, ay1, ax2, ay2, bx2, by2)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True

    # Collinear cases
    if d1 == 0 and _on_segment(bx1, by1, bx2, by2, ax1, ay1):
        return True
    if d2 == 0 and _on_segment(bx1, by1, bx2, by2, ax2, ay2):
        return True

    return False


def _on_segment(
    px: float, py: float, qx: float, qy: float, rx: float, ry: float,
) -> bool:
    """Check if point r lies on segment pq (assuming collinearity)."""
    return (
        min(px, qx) <= rx <= max(px, qx)
        and min(py, qy) <= ry <= max(py, qy)
    )
