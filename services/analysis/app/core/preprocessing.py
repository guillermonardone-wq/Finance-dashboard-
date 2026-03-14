"""
Shared Preprocessing Pipeline

Transforms raw SensorSample data into ProcessedSample records with:
  1. Validation — drop malformed samples, require GPS
  2. Timestamp normalization — ensure monotonic, zero-based
  3. Signal smoothing — moving-average filter for noisy IMU channels
  4. Derived metrics — heading, heading change rate, lon/lat G, cumulative distance

This module is pure computation. It does not touch the network, database, or disk.
"""

from __future__ import annotations

import math
from typing import Sequence

from app.core.constants import (
    EARTH_RADIUS_M,
    GRAVITY_MS2,
    MIN_GPS_MOVEMENT_M,
    SMOOTHING_WINDOW_SIZE,
    HEADING_CHANGE_MIN_DISTANCE_M,
)
from app.core.schemas import ProcessedSample
from app.models.schemas import SensorSample


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preprocess(
    raw_samples: list[SensorSample],
    smoothing_window: int = SMOOTHING_WINDOW_SIZE,
) -> list[ProcessedSample]:
    """
    Full preprocessing pipeline.

    Steps:
      1. validate & convert raw samples
      2. normalize timestamps (monotonic, zero-based)
      3. compute heading from GPS positions
      4. compute cumulative distance
      5. smooth IMU signals
      6. derive longitudinal/lateral G in body frame
      7. compute heading change rate
    """
    # Step 1: validate
    valid = _validate_and_convert(raw_samples)
    if not valid:
        return []

    # Step 2: normalize timestamps
    _normalize_timestamps(valid)

    # Step 3: heading from successive GPS positions
    _compute_headings(valid)

    # Step 4: cumulative distance
    _compute_cumulative_distance(valid)

    # Step 5: smooth IMU
    _smooth_imu(valid, smoothing_window)

    # Step 6: longitudinal / lateral G (smoothed)
    _compute_body_frame_g(valid)

    # Step 7: heading change rate
    _compute_heading_change_rate(valid)

    return valid


# ---------------------------------------------------------------------------
# Step 1 — Validation
# ---------------------------------------------------------------------------

def _validate_and_convert(raw: list[SensorSample]) -> list[ProcessedSample]:
    """
    Convert raw samples to ProcessedSample, dropping entries without GPS.
    Samples are sorted by timestamp.
    """
    out: list[ProcessedSample] = []
    for s in raw:
        if s.gps is None:
            continue  # GPS is mandatory for spatial analysis
        ps = ProcessedSample(
            t=s.t,
            lat=s.gps.lat,
            lng=s.gps.lng,
            gps_speed_ms=s.gps.speed if s.gps.speed is not None else None,
            gps_accuracy_m=s.gps.accuracy,
            accel_x=s.accel.x if s.accel else None,
            accel_y=s.accel.y if s.accel else None,
            accel_z=s.accel.z if s.accel else None,
            gyro_x=s.gyro.x if s.gyro else None,
            gyro_y=s.gyro.y if s.gyro else None,
            gyro_z=s.gyro.z if s.gyro else None,
        )
        out.append(ps)

    # Ensure chronological order
    out.sort(key=lambda p: p.t)
    return out


# ---------------------------------------------------------------------------
# Step 2 — Timestamp normalization
# ---------------------------------------------------------------------------

def _normalize_timestamps(samples: list[ProcessedSample]) -> None:
    """
    Shift timestamps so the first sample starts at t=0.
    Remove any duplicate timestamps (keep first occurrence).
    """
    if not samples:
        return

    t0 = samples[0].t
    seen: set[float] = set()
    to_remove: list[int] = []

    for i, s in enumerate(samples):
        s.t = round(s.t - t0, 6)
        if s.t in seen:
            to_remove.append(i)
        else:
            seen.add(s.t)

    # Remove duplicates in reverse order to preserve indices
    for idx in reversed(to_remove):
        samples.pop(idx)


# ---------------------------------------------------------------------------
# Step 3 — Heading from GPS positions
# ---------------------------------------------------------------------------

def _compute_headings(samples: list[ProcessedSample]) -> None:
    """
    Compute course heading (0-360°) from successive GPS positions.
    Only updates heading when the car has moved enough to reduce GPS noise.
    """
    last_valid_heading: float | None = None

    for i in range(len(samples)):
        if i == 0:
            samples[i].heading_deg = None
            continue

        prev = samples[i - 1]
        curr = samples[i]
        if prev.lat is None or curr.lat is None:
            continue

        dist = haversine_meters(prev.lat, prev.lng, curr.lat, curr.lng)  # type: ignore

        if dist >= HEADING_CHANGE_MIN_DISTANCE_M:
            heading = _bearing(prev.lat, prev.lng, curr.lat, curr.lng)  # type: ignore
            samples[i].heading_deg = heading
            last_valid_heading = heading
        else:
            # Not enough movement — carry forward last known heading
            samples[i].heading_deg = last_valid_heading


# ---------------------------------------------------------------------------
# Step 4 — Cumulative distance
# ---------------------------------------------------------------------------

def _compute_cumulative_distance(samples: list[ProcessedSample]) -> None:
    """Running total distance in meters from successive GPS points."""
    total = 0.0
    for i in range(len(samples)):
        if i == 0:
            samples[i].cumulative_distance_m = 0.0
            continue
        prev = samples[i - 1]
        curr = samples[i]
        if prev.lat is not None and curr.lat is not None:
            d = haversine_meters(prev.lat, prev.lng, curr.lat, curr.lng)  # type: ignore
            if d >= MIN_GPS_MOVEMENT_M:
                total += d
        samples[i].cumulative_distance_m = total


# ---------------------------------------------------------------------------
# Step 5 — Smooth IMU signals
# ---------------------------------------------------------------------------

def _smooth_imu(samples: list[ProcessedSample], window: int) -> None:
    """
    Apply a centered moving-average to accelerometer channels.
    Overwrites accel_x/y/z with smoothed values but preserves originals
    via the smoothed speed field.
    """
    if window < 2:
        return

    # Also smooth GPS speed
    raw_speeds = [s.gps_speed_ms for s in samples]
    smoothed_speeds = _moving_average([v if v is not None else 0.0 for v in raw_speeds], window)
    for i, s in enumerate(samples):
        s.speed_ms_smoothed = smoothed_speeds[i] if raw_speeds[i] is not None else None

    # Smooth accel channels
    for attr in ("accel_x", "accel_y", "accel_z"):
        raw = [getattr(s, attr) for s in samples]
        if all(v is None for v in raw):
            continue
        filled = [v if v is not None else 0.0 for v in raw]
        smoothed = _moving_average(filled, window)
        for i, s in enumerate(samples):
            if raw[i] is not None:
                setattr(s, attr, smoothed[i])


def _moving_average(values: list[float], window: int) -> list[float]:
    """Centered moving average. Edges use smaller windows."""
    n = len(values)
    out = [0.0] * n
    half = window // 2
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        out[i] = sum(values[lo:hi]) / (hi - lo)
    return out


# ---------------------------------------------------------------------------
# Step 6 — Body-frame G forces
# ---------------------------------------------------------------------------

def _compute_body_frame_g(samples: list[ProcessedSample]) -> None:
    """
    Convert smoothed accelerometer readings to G-force values.

    Phone orientation assumption: phone is mounted roughly upright.
      accel_x → longitudinal (forward positive)
      accel_y → lateral (left positive)
      accel_z → vertical (gravity)

    We divide by GRAVITY_MS2 to get G values and subtract gravity from Z.
    """
    for s in samples:
        if s.accel_x is not None:
            s.lon_accel_g = s.accel_x / GRAVITY_MS2
        if s.accel_y is not None:
            s.lat_accel_g = s.accel_y / GRAVITY_MS2


# ---------------------------------------------------------------------------
# Step 7 — Heading change rate
# ---------------------------------------------------------------------------

def _compute_heading_change_rate(samples: list[ProcessedSample]) -> None:
    """
    Heading change in degrees per second. Useful for detecting turn-in.
    Uses shortest-arc difference to handle 0/360 wrap-around.
    """
    for i in range(len(samples)):
        if i == 0 or samples[i].heading_deg is None or samples[i - 1].heading_deg is None:
            samples[i].heading_change_deg_s = None
            continue

        dt = samples[i].t - samples[i - 1].t
        if dt <= 0:
            samples[i].heading_change_deg_s = None
            continue

        dh = samples[i].heading_deg - samples[i - 1].heading_deg  # type: ignore
        # Shortest arc
        if dh > 180:
            dh -= 360
        elif dh < -180:
            dh += 360

        samples[i].heading_change_deg_s = dh / dt


# ---------------------------------------------------------------------------
# Geo utilities (shared across modules)
# ---------------------------------------------------------------------------

def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two GPS coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial bearing from point 1 to point 2, in degrees 0-360."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dl = math.radians(lng2 - lng1)

    x = math.sin(dl) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dl)

    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360
