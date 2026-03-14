"""Direct PostgreSQL access for the Python analysis worker.

Uses psycopg2 for simple queries — no ORM needed on the Python side.
The worker writes results directly to the database.
"""

import psycopg2
import psycopg2.extras
import json
from app.config import settings


def get_connection():
    return psycopg2.connect(settings.database_url)


def get_track(track_id: str) -> dict | None:
    """Fetch track definition including S/F line."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT id, name, location, country,
                          "sfLineLat1", "sfLineLng1", "sfLineLat2", "sfLineLng2",
                          "sfLineHeading"
                   FROM "Track" WHERE id = %s""",
                (track_id,),
            )
            return cur.fetchone()


def get_track_corners(track_id: str) -> list[dict]:
    """Fetch corner definitions for a track."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT id, number, name,
                          "entryLat", "entryLng", "apexLat", "apexLng",
                          "exitLat", "exitLng", "toleranceMeters",
                          type, direction, notes
                   FROM "TrackCorner"
                   WHERE "trackId" = %s
                   ORDER BY number""",
                (track_id,),
            )
            return cur.fetchall()


def save_laps(session_id: str, laps: list[dict]):
    """Save detected laps to the database."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Clear existing laps for this session
            cur.execute('DELETE FROM "Lap" WHERE "sessionId" = %s', (session_id,))

            for lap in laps:
                cur.execute(
                    """INSERT INTO "Lap" (id, "sessionId", "lapNumber", "startTime",
                       "endTime", "lapTimeSeconds", "isValid", "invalidReason",
                       "maxSpeedKmh", "avgSpeedKmh", "createdAt")
                       VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
                    (
                        session_id,
                        lap["lap_number"],
                        lap["start_time"],
                        lap["end_time"],
                        lap["lap_time_seconds"],
                        lap.get("is_valid", True),
                        lap.get("invalid_reason"),
                        lap.get("max_speed_kmh"),
                        lap.get("avg_speed_kmh"),
                    ),
                )
        conn.commit()


def save_session_analysis(session_id: str, analysis: dict):
    """Save session-level analysis summary."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM "SessionAnalysis" WHERE "sessionId" = %s',
                (session_id,),
            )
            cur.execute(
                """INSERT INTO "SessionAnalysis"
                   (id, "sessionId", "totalLaps", "validLaps", "bestLapNumber",
                    "bestLapTime", "medianLapTime", "consistency",
                    "analysisVersion", "processingTimeMs", status, "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())""",
                (
                    session_id,
                    analysis["total_laps"],
                    analysis["valid_laps"],
                    analysis.get("best_lap_number"),
                    analysis.get("best_lap_time"),
                    analysis.get("median_lap_time"),
                    analysis.get("consistency"),
                    analysis["analysis_version"],
                    analysis["processing_time_ms"],
                    "completed",
                ),
            )
        conn.commit()


def save_coaching_result(session_id: str, coaching: dict):
    """Save coaching results."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM "CoachingResult" WHERE "sessionId" = %s',
                (session_id,),
            )
            cur.execute(
                """INSERT INTO "CoachingResult"
                   (id, "sessionId", "cornerCoaching", "summaryText",
                    "top3Improvements", "audioScript", "audioStorageKey",
                    "modelUsed", "promptVersion", "generatedAt", "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())""",
                (
                    session_id,
                    json.dumps(coaching.get("corners", [])),
                    coaching.get("summary", ""),
                    json.dumps(coaching.get("top_3_improvements", [])),
                    coaching.get("audio_script"),
                    coaching.get("audio_storage_key"),
                    coaching.get("model_used"),
                    "v0.1",
                ),
            )
        conn.commit()


def update_session_status(session_id: str, status: str):
    """Update session status."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "Session" SET status = %s, "updatedAt" = NOW() WHERE id = %s',
                (status, session_id),
            )
        conn.commit()


def update_analysis_job(job_id: str, **kwargs):
    """Update analysis job progress."""
    set_clauses = []
    values = []
    for key, value in kwargs.items():
        col = {
            "status": "status",
            "stage": "stage",
            "progress_percent": '"progressPercent"',
            "error_message": '"errorMessage"',
            "started_at": '"startedAt"',
            "completed_at": '"completedAt"',
        }.get(key, key)
        set_clauses.append(f"{col} = %s")
        values.append(value)

    set_clauses.append('"updatedAt" = NOW()')
    values.append(job_id)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'UPDATE "AnalysisJob" SET {", ".join(set_clauses)} WHERE id = %s',
                values,
            )
        conn.commit()
