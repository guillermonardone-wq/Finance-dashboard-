"""
Redis Worker — consumes analysis jobs from BullMQ queue.

Flow:
1. Pick up job from Redis queue
2. Download sensor data from object storage
3. Preprocess raw sensor data
4. Run analysis pipeline:
   a. Lap detection (GPS crossing)
   b. Corner segmentation (zone matching + phase assignment)
   c. Braking inference (IMU deceleration patterns)
   d. Exit acceleration analysis (post-apex throttle pickup)
5. Build structured findings
6. Generate coaching via Claude API
7. Save all results to PostgreSQL
"""

import json
import time
import asyncio
import redis
from dataclasses import asdict
from datetime import datetime, timezone

from app.config import settings
from app.models.schemas import SensorDataFile, AnalysisJobPayload

# New algorithm pipeline
from app.core.preprocessing import preprocess
from app.core.schemas import LapValidity
from app.algorithms.lap_detection import detect_laps, get_lap_samples
from app.algorithms.corner_segmentation import segment_corners, get_corner_samples
from app.algorithms.braking import detect_braking
from app.algorithms.exit_acceleration import analyze_exit_acceleration

# Legacy modules still used for findings + coaching
from app.analysis.findings_builder import build_structured_findings
from app.analysis.coaching_generator import generate_coaching

from app.services.storage import download_json, upload_json
from app.services.database import (
    get_track,
    get_track_corners,
    save_laps,
    save_session_analysis,
    save_coaching_result,
    update_session_status,
    update_analysis_job,
)


def process_analysis_job(payload: dict):
    """Process a single analysis job using the new algorithm pipeline."""
    job = AnalysisJobPayload(**payload)
    start_time = time.time()

    print(f"[Worker] Processing analysis for session {job.session_id}")

    try:
        update_analysis_job(
            job.analysis_job_id,
            status="processing",
            stage="preprocessing",
            progress_percent=5,
            started_at=datetime.now(timezone.utc),
        )

        # 1. Download sensor data
        print(f"[Worker] Downloading sensor data: {job.sensor_data_key}")
        raw_data = download_json(job.sensor_data_key)
        sensor_data = SensorDataFile(**raw_data)
        print(f"[Worker] Loaded {len(sensor_data.samples)} raw samples")

        # 2. Preprocess: validate, normalize, smooth, derive metrics
        update_analysis_job(
            job.analysis_job_id, stage="preprocessing", progress_percent=10
        )
        processed = preprocess(sensor_data.samples)
        print(f"[Worker] Preprocessed to {len(processed)} valid samples")

        # 3. Get track definition
        track = get_track(job.track_id)
        if not track:
            raise ValueError(f"Track {job.track_id} not found")

        corners_defs = get_track_corners(job.track_id)
        print(f"[Worker] Track: {track['name']}, {len(corners_defs)} corners")

        # 4. Detect laps
        update_analysis_job(
            job.analysis_job_id, stage="lap_detection", progress_percent=20
        )

        sf_line = {
            "lat1": track["sfLineLat1"],
            "lng1": track["sfLineLng1"],
            "lat2": track["sfLineLat2"],
            "lng2": track["sfLineLng2"],
        }

        laps = detect_laps(
            processed,
            sf_line,
            min_lap_time=job.options.get("minLapTimeSeconds", 30),
            max_lap_time=job.options.get("maxLapTimeSeconds", 600),
        )

        print(f"[Worker] Detected {len(laps)} laps")

        # Save laps in legacy format for database compatibility
        laps_for_db = [
            {
                "lap_number": l.lap_number,
                "start_time": l.start_time,
                "end_time": l.end_time,
                "lap_time_seconds": l.lap_time_s,
                "is_valid": l.validity == LapValidity.VALID,
                "invalid_reason": l.invalid_reason,
                "max_speed_kmh": l.max_speed_kmh,
                "avg_speed_kmh": l.avg_speed_kmh,
                "max_lateral_g": l.max_lateral_g,
                "max_braking_g": l.max_braking_g,
            }
            for l in laps
        ]
        save_laps(job.session_id, laps_for_db)

        # 5. Corner segmentation + braking + exit accel for each lap
        update_analysis_job(
            job.analysis_job_id, stage="corner_analysis", progress_percent=30
        )

        valid_laps = [l for l in laps if l.validity == LapValidity.VALID]

        # Build corner definitions for the new segmenter
        corner_defs_for_segmenter = [
            {
                "number": c["number"],
                "name": c.get("name", f"Turn {c['number']}"),
                "direction": c.get("direction", "unknown"),
                "type": c.get("type", "unknown"),
                "entry_lat": c["entryLat"],
                "entry_lng": c["entryLng"],
                "apex_lat": c["apexLat"],
                "apex_lng": c["apexLng"],
                "exit_lat": c["exitLat"],
                "exit_lng": c["exitLng"],
                "tolerance_meters": c.get("toleranceMeters", 20),
            }
            for c in corners_defs
        ]

        # Full analysis results per lap
        all_corner_results = {}  # lap_number → list of per-corner results

        for i, lap in enumerate(valid_laps):
            progress = 30 + int((i / max(len(valid_laps), 1)) * 40)
            update_analysis_job(
                job.analysis_job_id,
                stage="corner_analysis",
                progress_percent=progress,
            )

            lap_samples = get_lap_samples(processed, lap)

            # Segment corners with phase assignment
            corner_segments = segment_corners(
                lap_samples, corner_defs_for_segmenter
            )

            # Analyze each corner: braking + exit acceleration
            lap_corner_results = []
            for seg in corner_segments:
                corner_samples = get_corner_samples(lap_samples, seg)

                braking_event = detect_braking(corner_samples, seg)
                exit_accel = analyze_exit_acceleration(corner_samples, seg)

                # Compute measured speeds from GPS within the corner
                gps_in_corner = [
                    s for s in corner_samples
                    if s.gps_speed_ms is not None
                    and seg.entry_time <= s.t <= seg.exit_time
                ]
                speeds_kmh = [s.gps_speed_ms * 3.6 for s in gps_in_corner]  # type: ignore

                entry_speed = speeds_kmh[0] if speeds_kmh else None
                min_speed = min(speeds_kmh) if speeds_kmh else None
                exit_speed = speeds_kmh[-1] if speeds_kmh else None

                lat_gs = [
                    abs(s.lat_accel_g)
                    for s in corner_samples
                    if s.lat_accel_g is not None
                    and seg.entry_time <= s.t <= seg.exit_time
                ]
                peak_lat_g = max(lat_gs) if lat_gs else None

                lap_corner_results.append({
                    "corner_number": seg.corner_number,
                    "corner_name": seg.corner_name,
                    "entry_time": seg.entry_time,
                    "apex_time": seg.apex_time,
                    "exit_time": seg.exit_time,
                    "corner_time_seconds": seg.corner_time_s,
                    "direction": seg.direction,
                    "corner_type": seg.corner_type,
                    "phases": [
                        {"phase": p.phase.value, "start": p.start_time, "end": p.end_time}
                        for p in seg.phases
                    ],
                    "entry_speed_kmh": round(entry_speed, 1) if entry_speed else None,
                    "min_speed_kmh": round(min_speed, 1) if min_speed else None,
                    "exit_speed_kmh": round(exit_speed, 1) if exit_speed else None,
                    "peak_lateral_g": round(peak_lat_g, 2) if peak_lat_g else None,
                    "braking": asdict(braking_event) if braking_event else None,
                    "exit_acceleration": asdict(exit_accel) if exit_accel else None,
                })

            all_corner_results[lap.lap_number] = lap_corner_results

        # 6. Build structured findings for coaching
        update_analysis_job(
            job.analysis_job_id, stage="coaching", progress_percent=75
        )

        best_lap = min(valid_laps, key=lambda l: l.lap_time_s) if valid_laps else None
        target_lap = best_lap or (valid_laps[-1] if valid_laps else None)
        coaching_result = None

        if target_lap and target_lap.lap_number in all_corner_results:
            # Convert new results to legacy CornerMetrics for findings builder
            from app.models.schemas import CornerMetrics
            corner_metrics = []
            for cr in all_corner_results[target_lap.lap_number]:
                corner_metrics.append(CornerMetrics(
                    corner_number=cr["corner_number"],
                    entry_speed_kmh=cr["entry_speed_kmh"] or 0,
                    min_speed_kmh=cr["min_speed_kmh"] or 0,
                    exit_speed_kmh=cr["exit_speed_kmh"] or 0,
                    peak_lateral_g=cr["peak_lateral_g"] or 0,
                    peak_braking_g=(
                        cr["braking"]["peak_decel_g"]
                        if cr["braking"] else 0
                    ),
                    exit_accel_g=(
                        cr["exit_acceleration"]["avg_accel_g"]
                        if cr["exit_acceleration"] else None
                    ),
                    braking_onset_time=(
                        cr["braking"]["start_time"]
                        if cr["braking"] else None
                    ),
                    apex_timing_offset=None,
                    corner_time_seconds=cr["corner_time_seconds"],
                    confidence=0.7,
                ))

            best_corners = corner_metrics  # compare against self for now

            corner_defs_for_findings = [
                {
                    "number": c["number"],
                    "name": c.get("name", f"Turn {c['number']}"),
                    "type": c.get("type", "unknown"),
                    "direction": c.get("direction", "unknown"),
                }
                for c in corners_defs
            ]

            findings = build_structured_findings(
                track_name=track["name"],
                lap_number=target_lap.lap_number,
                corners=corner_metrics,
                best_corners=best_corners,
                corner_definitions=corner_defs_for_findings,
            )

            coaching_result = asyncio.run(generate_coaching(findings))

        # 7. Save results
        update_analysis_job(
            job.analysis_job_id, stage="saving_results", progress_percent=90
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        lap_times = [l.lap_time_s for l in valid_laps]
        save_session_analysis(
            job.session_id,
            {
                "total_laps": len(laps),
                "valid_laps": len(valid_laps),
                "best_lap_number": best_lap.lap_number if best_lap else None,
                "best_lap_time": best_lap.lap_time_s if best_lap else None,
                "median_lap_time": sorted(lap_times)[len(lap_times) // 2] if lap_times else None,
                "consistency": _std_dev(lap_times) if len(lap_times) > 1 else None,
                "analysis_version": settings.analysis_version,
                "processing_time_ms": elapsed_ms,
            },
        )

        if coaching_result:
            save_coaching_result(job.session_id, coaching_result)

        # Save full results to object storage (includes new algorithm output)
        full_results = {
            "laps": [asdict(l) for l in laps],
            "corners_per_lap": {
                str(k): v for k, v in all_corner_results.items()
            },
            "coaching": coaching_result,
            "processing_time_ms": elapsed_ms,
        }
        upload_json(f"sessions/{job.session_id}/analysis.json", full_results)

        update_analysis_job(
            job.analysis_job_id,
            status="completed",
            stage="completed",
            progress_percent=100,
            completed_at=datetime.now(timezone.utc),
        )
        update_session_status(job.session_id, "ANALYSIS_COMPLETE")

        print(f"[Worker] Analysis complete for session {job.session_id} in {elapsed_ms}ms")

    except Exception as e:
        print(f"[Worker] Analysis failed for session {job.session_id}: {e}")
        import traceback
        traceback.print_exc()

        update_analysis_job(
            job.analysis_job_id,
            status="failed",
            error_message=str(e)[:500],
            completed_at=datetime.now(timezone.utc),
        )
        update_session_status(job.session_id, "ANALYSIS_FAILED")


def _std_dev(values: list[float]) -> float:
    mean = sum(values) / len(values)
    return (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5


def run_worker():
    """Main worker loop — polls Redis for BullMQ jobs."""
    print(f"[Worker] Starting analysis worker v{settings.analysis_version}")
    print(f"[Worker] Redis: {settings.redis_url}")

    r = redis.from_url(settings.redis_url)

    queue_key = "bull:analysis:wait"
    processing_key = "bull:analysis:active"

    while True:
        try:
            result = r.brpoplpush(queue_key, processing_key, timeout=5)

            if result is None:
                continue

            job_id = result.decode("utf-8") if isinstance(result, bytes) else result
            job_data_raw = r.hget(f"bull:analysis:{job_id}", "data")

            if job_data_raw:
                job_data = json.loads(job_data_raw)
                process_analysis_job(job_data)

            r.lrem(processing_key, 1, result)

        except redis.ConnectionError:
            print("[Worker] Redis connection lost. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"[Worker] Error processing job: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(1)


if __name__ == "__main__":
    run_worker()
