"""
Corner Segmentation Algorithm

Maps preprocessed telemetry to predefined corner zones on the track.
Each corner is defined by entry, apex, and exit GPS coordinates with
tolerance radii. The algorithm assigns samples to corners and further
subdivides each corner into phases: approach, braking, turn-in, apex, exit.

Algorithm overview:
  1. For each track corner, find the closest GPS samples to entry/apex/exit
  2. Expand the window with approach (before entry) and exit (after exit) buffers
  3. Subdivide the corner into phases using heading change rate + braking signals
  4. Return per-corner segments with phase boundaries

Inputs:
  - preprocessed samples for one lap
  - list of corner definitions (from track database)

Outputs:
  - list[CornerSegment] with phase windows

Failure modes:
  - Corner missed entirely if GPS samples are too sparse in that region
  - Phase boundaries are approximate — heading change rate can be noisy
  - Overlapping corners (chicane sequences) may share samples
"""

from __future__ import annotations

import math

from app.core.constants import (
    CORNER_ZONE_TOLERANCE_M,
    APPROACH_WINDOW_S,
    EXIT_WINDOW_S,
    BRAKING_ONSET_G,
)
from app.core.schemas import (
    ProcessedSample,
    CornerSegment,
    CornerPhase,
    CornerPhaseWindow,
)
from app.core.preprocessing import haversine_meters


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def segment_corners(
    lap_samples: list[ProcessedSample],
    corner_definitions: list[dict],
    tolerance_m: float = CORNER_ZONE_TOLERANCE_M,
) -> list[CornerSegment]:
    """
    Segment a single lap into corner regions.

    corner_definitions format:
        [{
            "number": int,
            "name": str,
            "direction": "left" | "right",
            "type": "hairpin" | "sweeper" | "chicane" | "kink" | ...,
            "entry_lat": float, "entry_lng": float,
            "apex_lat": float, "apex_lng": float,
            "exit_lat": float, "exit_lng": float,
            "tolerance_meters": float (optional, overrides default),
        }]
    """
    if not corner_definitions or not lap_samples:
        return []

    segments: list[CornerSegment] = []

    for cdef in sorted(corner_definitions, key=lambda c: c["number"]):
        tol = cdef.get("tolerance_meters", tolerance_m)

        # Find closest sample to each reference point
        entry_idx = _find_closest_index(
            lap_samples, cdef["entry_lat"], cdef["entry_lng"], tol
        )
        apex_idx = _find_closest_index(
            lap_samples, cdef["apex_lat"], cdef["apex_lng"], tol
        )
        exit_idx = _find_closest_index(
            lap_samples, cdef["exit_lat"], cdef["exit_lng"], tol
        )

        # Must have at least entry and exit to define a corner
        if entry_idx is None or exit_idx is None:
            continue

        # Ensure correct ordering (entry before exit)
        if exit_idx <= entry_idx:
            continue

        entry_time = lap_samples[entry_idx].t
        exit_time = lap_samples[exit_idx].t

        # Apex: use found index or estimate as midpoint
        if apex_idx is not None and entry_idx <= apex_idx <= exit_idx:
            apex_time = lap_samples[apex_idx].t
        else:
            apex_time = (entry_time + exit_time) / 2.0

        # Build phase windows
        phases = _assign_phases(
            lap_samples, entry_idx, apex_idx, exit_idx, entry_time, apex_time, exit_time
        )

        segments.append(CornerSegment(
            corner_number=cdef["number"],
            corner_name=cdef.get("name", f"Turn {cdef['number']}"),
            entry_time=entry_time,
            apex_time=apex_time,
            exit_time=exit_time,
            corner_time_s=round(exit_time - entry_time, 3),
            phases=phases,
            direction=cdef.get("direction", "unknown"),
            corner_type=cdef.get("type", "unknown"),
        ))

    return segments


def get_corner_samples(
    samples: list[ProcessedSample],
    segment: CornerSegment,
    include_approach: bool = True,
    include_exit_buffer: bool = True,
) -> list[ProcessedSample]:
    """Extract samples for a corner, optionally including approach/exit buffers."""
    t_start = segment.entry_time - (APPROACH_WINDOW_S if include_approach else 0)
    t_end = segment.exit_time + (EXIT_WINDOW_S if include_exit_buffer else 0)
    return [s for s in samples if t_start <= s.t <= t_end]


# ---------------------------------------------------------------------------
# Phase assignment
# ---------------------------------------------------------------------------

def _assign_phases(
    samples: list[ProcessedSample],
    entry_idx: int | None,
    apex_idx: int | None,
    exit_idx: int | None,
    entry_time: float,
    apex_time: float,
    exit_time: float,
) -> list[CornerPhaseWindow]:
    """
    Subdivide a corner into phases based on timing and sensor signals.

    Phase heuristics:
      - APPROACH: 3s before entry → entry
      - BRAKING: from first significant deceleration to end of decel zone
      - TURN_IN: from braking end (or entry) to apex
      - APEX: small window around minimum speed / geometric apex
      - EXIT: from apex window end to exit point
    """
    phases: list[CornerPhaseWindow] = []
    approach_start = entry_time - APPROACH_WINDOW_S

    # Approach phase
    phases.append(CornerPhaseWindow(
        phase=CornerPhase.APPROACH,
        start_time=approach_start,
        end_time=entry_time,
    ))

    # Detect braking zone within approach + entry-to-apex window
    braking_start, braking_end = _detect_braking_zone(
        samples, approach_start, apex_time
    )

    if braking_start is not None and braking_end is not None:
        phases.append(CornerPhaseWindow(
            phase=CornerPhase.BRAKING,
            start_time=braking_start,
            end_time=braking_end,
        ))
        turn_in_start = braking_end
    else:
        turn_in_start = entry_time

    # Turn-in: from end of braking to near apex
    # Apex window: ±0.5s around geometric apex
    apex_half_window = 0.5
    apex_window_start = max(turn_in_start, apex_time - apex_half_window)
    apex_window_end = min(exit_time, apex_time + apex_half_window)

    if turn_in_start < apex_window_start:
        phases.append(CornerPhaseWindow(
            phase=CornerPhase.TURN_IN,
            start_time=turn_in_start,
            end_time=apex_window_start,
        ))

    # Apex phase
    phases.append(CornerPhaseWindow(
        phase=CornerPhase.APEX,
        start_time=apex_window_start,
        end_time=apex_window_end,
    ))

    # Exit phase
    if apex_window_end < exit_time:
        phases.append(CornerPhaseWindow(
            phase=CornerPhase.EXIT,
            start_time=apex_window_end,
            end_time=exit_time,
        ))

    return phases


def _detect_braking_zone(
    samples: list[ProcessedSample],
    t_start: float,
    t_end: float,
) -> tuple[float | None, float | None]:
    """
    Find the braking zone within a time window.

    Braking starts when longitudinal G drops below -BRAKING_ONSET_G
    and ends when it rises back above -BRAKING_ONSET_G * 0.5.
    """
    window = [s for s in samples if t_start <= s.t <= t_end]

    brake_start: float | None = None
    brake_end: float | None = None

    for s in window:
        if s.lon_accel_g is None:
            continue

        if brake_start is None:
            # Look for braking onset
            if s.lon_accel_g < -BRAKING_ONSET_G:
                brake_start = s.t
        else:
            # Look for braking release
            if s.lon_accel_g > -BRAKING_ONSET_G * 0.5:
                brake_end = s.t
                break

    # If braking started but never ended, end at the window boundary
    if brake_start is not None and brake_end is None:
        brake_end = t_end

    return brake_start, brake_end


# ---------------------------------------------------------------------------
# Spatial matching
# ---------------------------------------------------------------------------

def _find_closest_index(
    samples: list[ProcessedSample],
    target_lat: float,
    target_lng: float,
    tolerance_m: float,
) -> int | None:
    """
    Find the index of the sample closest to a target GPS point,
    within the given tolerance radius. Returns None if no sample
    is close enough.
    """
    best_dist = float("inf")
    best_idx: int | None = None

    for i, s in enumerate(samples):
        if s.lat is None or s.lng is None:
            continue
        dist = haversine_meters(s.lat, s.lng, target_lat, target_lng)
        if dist < best_dist and dist <= tolerance_m:
            best_dist = dist
            best_idx = i

    return best_idx
