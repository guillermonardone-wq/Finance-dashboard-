"""
Structured Findings Builder

Converts raw analysis metrics into the structured format that Claude receives.
Claude does NOT see raw telemetry — only this structured output.
"""

from app.models.schemas import CornerMetrics, StructuredFindings, CornerFinding


def build_structured_findings(
    track_name: str,
    lap_number: int,
    corners: list[CornerMetrics],
    best_corners: list[CornerMetrics] | None,
    corner_definitions: list[dict],
) -> StructuredFindings:
    """
    Build structured findings for Claude API consumption.

    Compares current lap metrics against driver's best lap per corner.
    """
    corner_def_map = {c["number"]: c for c in corner_definitions}
    best_map = {c.corner_number: c for c in best_corners} if best_corners else {}

    findings_list: list[CornerFinding] = []

    for corner in corners:
        cdef = corner_def_map.get(corner.corner_number, {})
        best = best_map.get(corner.corner_number)

        best_entry = best.entry_speed_kmh if best else corner.entry_speed_kmh
        best_min = best.min_speed_kmh if best else corner.min_speed_kmh
        best_exit = best.exit_speed_kmh if best else corner.exit_speed_kmh
        best_time = best.corner_time_seconds if best else corner.corner_time_seconds
        best_brake_dist = best.braking_distance_meters if best else None
        brake_dist = corner.braking_distance_meters

        findings_list.append(CornerFinding(
            corner_number=corner.corner_number,
            corner_name=cdef.get("name", f"Turn {corner.corner_number}"),
            corner_type=cdef.get("type", "unknown"),
            direction=cdef.get("direction", "unknown"),
            findings={
                "entry_speed_kmh": corner.entry_speed_kmh,
                "best_entry_speed_kmh": best_entry,
                "entry_speed_delta": round(corner.entry_speed_kmh - best_entry, 1),
                "min_speed_kmh": corner.min_speed_kmh,
                "best_min_speed_kmh": best_min,
                "exit_speed_kmh": corner.exit_speed_kmh,
                "best_exit_speed_kmh": best_exit,
                "brake_distance_meters": brake_dist or 0,
                "best_brake_distance_meters": best_brake_dist or 0,
                "brake_distance_delta_meters": round(
                    (brake_dist or 0) - (best_brake_dist or 0), 1
                ),
                "apex_timing_offset_seconds": corner.apex_timing_offset or 0,
                "exit_acceleration_delay_seconds": 0,  # TODO: implement
                "corner_time_seconds": corner.corner_time_seconds,
                "best_corner_time_seconds": best_time,
                "time_delta_seconds": round(
                    corner.corner_time_seconds - best_time, 3
                ),
                "peak_lateral_g": corner.peak_lateral_g,
                "confidence": corner.confidence,
            },
            data_source={
                "measured": [
                    "entry_speed_kmh", "min_speed_kmh", "exit_speed_kmh",
                    "peak_lateral_g", "corner_time_seconds",
                ],
                "inferred": [
                    "brake_distance_meters", "apex_timing_offset_seconds",
                    "exit_acceleration_delay_seconds",
                ],
            },
        ))

    return StructuredFindings(
        track_name=track_name,
        lap_number=lap_number,
        corners=findings_list,
    )
