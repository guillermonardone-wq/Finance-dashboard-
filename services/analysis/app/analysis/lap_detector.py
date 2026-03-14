"""
Lap Detection Module

Detects lap boundaries by finding GPS trace crossings of the start/finish line.

Input: GPS trace + S/F line definition
Output: List of lap boundaries with timestamps
"""

import math
from app.models.schemas import SensorSample, LapResult


def detect_laps(
    samples: list[SensorSample],
    sf_line: dict,
    min_lap_time: float = 30.0,
    max_lap_time: float = 600.0,
) -> list[LapResult]:
    """
    Detect laps by finding crossings of the start/finish line.

    sf_line format: {
        lat1, lng1, lat2, lng2: S/F line endpoints,
        heading: expected crossing direction (degrees, optional)
    }
    """
    gps_samples = [s for s in samples if s.gps is not None]

    if len(gps_samples) < 10:
        return []

    crossings: list[float] = []

    for i in range(1, len(gps_samples)):
        prev = gps_samples[i - 1]
        curr = gps_samples[i]

        if _segments_intersect(
            prev.gps.lat, prev.gps.lng,  # type: ignore
            curr.gps.lat, curr.gps.lng,  # type: ignore
            sf_line["lat1"], sf_line["lng1"],
            sf_line["lat2"], sf_line["lng2"],
        ):
            # Interpolate crossing time
            t_cross = (prev.t + curr.t) / 2.0
            crossings.append(t_cross)

    # Filter crossings into valid laps
    laps: list[LapResult] = []
    lap_num = 1

    for i in range(1, len(crossings)):
        lap_time = crossings[i] - crossings[i - 1]

        is_valid = min_lap_time <= lap_time <= max_lap_time
        invalid_reason = None
        if lap_time < min_lap_time:
            invalid_reason = "too_short"
        elif lap_time > max_lap_time:
            invalid_reason = "too_slow"

        # Calculate lap summary metrics from GPS data
        lap_samples = [
            s for s in gps_samples
            if crossings[i - 1] <= s.t <= crossings[i] and s.gps
        ]

        speeds = [
            s.gps.speed * 3.6 for s in lap_samples  # type: ignore
            if s.gps and s.gps.speed is not None
        ]

        laps.append(LapResult(
            lap_number=lap_num,
            start_time=crossings[i - 1],
            end_time=crossings[i],
            lap_time_seconds=round(lap_time, 3),
            is_valid=is_valid,
            invalid_reason=invalid_reason,
            max_speed_kmh=round(max(speeds), 1) if speeds else None,
            avg_speed_kmh=round(sum(speeds) / len(speeds), 1) if speeds else None,
        ))
        lap_num += 1

    return laps


def _segments_intersect(
    ax1: float, ay1: float, ax2: float, ay2: float,
    bx1: float, by1: float, bx2: float, by2: float,
) -> bool:
    """Check if two line segments intersect using cross product method."""
    def cross(ox: float, oy: float, ax: float, ay: float, bx: float, by: float) -> float:
        return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)

    d1 = cross(bx1, by1, bx2, by2, ax1, ay1)
    d2 = cross(bx1, by1, bx2, by2, ax2, ay2)
    d3 = cross(ax1, ay1, ax2, ay2, bx1, by1)
    d4 = cross(ax1, ay1, ax2, ay2, bx2, by2)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True

    # Check collinear cases
    if d1 == 0 and _on_segment(bx1, by1, bx2, by2, ax1, ay1):
        return True
    if d2 == 0 and _on_segment(bx1, by1, bx2, by2, ax2, ay2):
        return True

    return False


def _on_segment(
    px: float, py: float, qx: float, qy: float, rx: float, ry: float
) -> bool:
    """Check if point r lies on segment pq."""
    return (
        min(px, qx) <= rx <= max(px, qx)
        and min(py, qy) <= ry <= max(py, qy)
    )
