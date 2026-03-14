"""
Corner Segmentation Module

Segments a lap into individual corners using track corner definitions.

Input: GPS trace for one lap + track corner definitions
Output: List of corner segments with entry/apex/exit times
"""

import math
from app.models.schemas import SensorSample, CornerSegment


def segment_corners(
    lap_samples: list[SensorSample],
    corners: list[dict],
    tolerance_meters: float = 15.0,
) -> list[CornerSegment]:
    """
    Map GPS samples to predefined corner zones.

    corners format: [{
        number, entry_lat, entry_lng, apex_lat, apex_lng,
        exit_lat, exit_lng, tolerance_meters
    }]
    """
    if not corners or not lap_samples:
        return []

    gps_samples = [s for s in lap_samples if s.gps is not None]
    if not gps_samples:
        return []

    segments: list[CornerSegment] = []

    for corner in sorted(corners, key=lambda c: c["number"]):
        entry_time = _find_closest_time(
            gps_samples, corner["entry_lat"], corner["entry_lng"], tolerance_meters
        )
        apex_time = _find_closest_time(
            gps_samples, corner["apex_lat"], corner["apex_lng"], tolerance_meters
        )
        exit_time = _find_closest_time(
            gps_samples, corner["exit_lat"], corner["exit_lng"], tolerance_meters
        )

        if entry_time is not None and exit_time is not None:
            if apex_time is None:
                apex_time = (entry_time + exit_time) / 2.0

            segments.append(CornerSegment(
                corner_number=corner["number"],
                entry_time=entry_time,
                apex_time=apex_time,
                exit_time=exit_time,
                corner_time_seconds=round(exit_time - entry_time, 3),
            ))

    return segments


def _find_closest_time(
    samples: list[SensorSample],
    target_lat: float,
    target_lng: float,
    tolerance_m: float,
) -> float | None:
    """Find the timestamp of the GPS sample closest to a target point within tolerance."""
    best_dist = float("inf")
    best_time = None

    for s in samples:
        if s.gps is None:
            continue
        dist = _haversine_meters(s.gps.lat, s.gps.lng, target_lat, target_lng)
        if dist < best_dist and dist <= tolerance_m:
            best_dist = dist
            best_time = s.t

    return best_time


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two GPS points in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
