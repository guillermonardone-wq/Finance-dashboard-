"""
Redis Worker — consumes analysis jobs from BullMQ queue.

Flow:
1. Pick up job from Redis queue
2. Download sensor data from object storage
3. Run analysis pipeline (lap detection → corner segmentation → behavior analysis)
4. Build structured findings
5. Generate coaching via Claude API
6. Save all results to PostgreSQL
7. Update job status
"""

import json
import time
import asyncio
import redis
from datetime import datetime, timezone

from app.config import settings
from app.models.schemas import SensorDataFile, AnalysisJobPayload
from app.analysis.lap_detector import detect_laps
from app.analysis.corner_segmenter import segment_corners
from app.analysis.behavior_analyzer import analyze_lap
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
    """Process a single analysis job synchronously."""
    job = AnalysisJobPayload(**payload)
    start_time = time.time()

    print(f"[Worker] Processing analysis for session {job.session_id}")

    try:
        # Mark job as processing
        update_analysis_job(
            job.analysis_job_id,
            status="processing",
            stage="lap_detection",
            progress_percent=5,
            started_at=datetime.now(timezone.utc),
        )

        # 1. Download sensor data from object storage
        print(f"[Worker] Downloading sensor data: {job.sensor_data_key}")
        raw_data = download_json(job.sensor_data_key)
        sensor_data = SensorDataFile(**raw_data)
        print(f"[Worker] Loaded {len(sensor_data.samples)} samples")

        # 2. Get track definition
        track = get_track(job.track_id)
        if not track:
            raise ValueError(f"Track {job.track_id} not found")

        corners_defs = get_track_corners(job.track_id)
        print(f"[Worker] Track: {track['name']}, {len(corners_defs)} corners")

        # 3. Detect laps
        update_analysis_job(
            job.analysis_job_id, stage="lap_detection", progress_percent=15
        )

        sf_line = {
            "lat1": track["sfLineLat1"],
            "lng1": track["sfLineLng1"],
            "lat2": track["sfLineLat2"],
            "lng2": track["sfLineLng2"],
            "heading": track.get("sfLineHeading"),
        }

        laps = detect_laps(
            sensor_data.samples,
            sf_line,
            min_lap_time=job.options.get("minLapTimeSeconds", 30),
            max_lap_time=job.options.get("maxLapTimeSeconds", 600),
        )

        print(f"[Worker] Detected {len(laps)} laps")
        save_laps(job.session_id, [l.model_dump() for l in laps])

        # 4. Corner segmentation + behavior analysis for each lap
        update_analysis_job(
            job.analysis_job_id,
            stage="corner_segmentation",
            progress_percent=30,
        )

        valid_laps = [l for l in laps if l.is_valid]
        all_corner_metrics = {}
        corner_defs_for_segmenter = [
            {
                "number": c["number"],
                "entry_lat": c["entryLat"],
                "entry_lng": c["entryLng"],
                "apex_lat": c["apexLat"],
                "apex_lng": c["apexLng"],
                "exit_lat": c["exitLat"],
                "exit_lng": c["exitLng"],
                "tolerance_meters": c.get("toleranceMeters", 15),
            }
            for c in corners_defs
        ]

        for i, lap in enumerate(valid_laps):
            progress = 30 + int((i / max(len(valid_laps), 1)) * 40)
            update_analysis_job(
                job.analysis_job_id,
                stage="behavior_analysis",
                progress_percent=progress,
            )

            lap_samples = [
                s for s in sensor_data.samples if lap.start_time <= s.t <= lap.end_time
            ]

            corner_segments = segment_corners(
                lap_samples, corner_defs_for_segmenter
            )

            corner_metrics = analyze_lap(
                lap_samples,
                corner_segments,
                braking_g_threshold=job.options.get("brakingGThreshold", 0.3),
            )

            all_corner_metrics[lap.lap_number] = corner_metrics

        # 5. Find best lap and build structured findings
        update_analysis_job(
            job.analysis_job_id, stage="coaching", progress_percent=75
        )

        best_lap = min(valid_laps, key=lambda l: l.lap_time_seconds) if valid_laps else None
        best_corners = all_corner_metrics.get(best_lap.lap_number) if best_lap else None

        # Build findings for the best lap (or last valid lap)
        target_lap = best_lap or (valid_laps[-1] if valid_laps else None)
        coaching_result = None

        if target_lap and target_lap.lap_number in all_corner_metrics:
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
                corners=all_corner_metrics[target_lap.lap_number],
                best_corners=best_corners,
                corner_definitions=corner_defs_for_findings,
            )

            # 6. Generate coaching via Claude
            coaching_result = asyncio.run(generate_coaching(findings))

        # 7. Save results
        update_analysis_job(
            job.analysis_job_id, stage="saving_results", progress_percent=90
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Save session analysis
        lap_times = [l.lap_time_seconds for l in valid_laps]
        save_session_analysis(
            job.session_id,
            {
                "total_laps": len(laps),
                "valid_laps": len(valid_laps),
                "best_lap_number": best_lap.lap_number if best_lap else None,
                "best_lap_time": best_lap.lap_time_seconds if best_lap else None,
                "median_lap_time": sorted(lap_times)[len(lap_times) // 2] if lap_times else None,
                "consistency": _std_dev(lap_times) if len(lap_times) > 1 else None,
                "analysis_version": settings.analysis_version,
                "processing_time_ms": elapsed_ms,
            },
        )

        # Save coaching
        if coaching_result:
            save_coaching_result(job.session_id, coaching_result)

        # Save full results to object storage for debugging
        full_results = {
            "laps": [l.model_dump() for l in laps],
            "corners_per_lap": {
                str(k): [c.model_dump() for c in v]
                for k, v in all_corner_metrics.items()
            },
            "coaching": coaching_result,
            "processing_time_ms": elapsed_ms,
        }
        upload_json(f"sessions/{job.session_id}/analysis.json", full_results)

        # Mark complete
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

    # BullMQ uses a specific key format for its queues
    queue_key = "bull:analysis:wait"
    processing_key = "bull:analysis:active"

    while True:
        try:
            # BRPOPLPUSH: atomically move job from wait to active
            result = r.brpoplpush(queue_key, processing_key, timeout=5)

            if result is None:
                continue

            job_id = result.decode("utf-8") if isinstance(result, bytes) else result

            # Read job data from BullMQ's job hash
            job_data_raw = r.hget(f"bull:analysis:{job_id}", "data")

            if job_data_raw:
                job_data = json.loads(job_data_raw)
                process_analysis_job(job_data)

            # Remove from active queue
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
