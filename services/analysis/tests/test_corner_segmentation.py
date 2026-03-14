"""Tests for the corner segmentation algorithm."""

from app.core.preprocessing import preprocess
from app.core.test_fixtures import (
    build_two_lap_dataset,
    build_single_corner_dataset,
    SAMPLE_TRACK,
    SAMPLE_CORNERS,
)
from app.algorithms.lap_detection import detect_laps, get_lap_samples
from app.algorithms.corner_segmentation import segment_corners, get_corner_samples
from app.core.schemas import CornerPhase


def _get_first_lap_samples():
    """Preprocess data and get samples for the first lap."""
    raw = build_two_lap_dataset()
    processed = preprocess(raw)
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"])
    assert len(laps) > 0
    return get_lap_samples(processed, laps[0])


def test_corners_detected():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, SAMPLE_CORNERS)
    assert len(segments) > 0


def test_corner_has_phases():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, SAMPLE_CORNERS)
    for seg in segments:
        assert len(seg.phases) > 0
        phase_types = [p.phase for p in seg.phases]
        # Must have at least approach and apex
        assert CornerPhase.APPROACH in phase_types
        assert CornerPhase.APEX in phase_types


def test_corner_timing_ordered():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, SAMPLE_CORNERS)
    for seg in segments:
        assert seg.entry_time <= seg.apex_time <= seg.exit_time
        assert seg.corner_time_s > 0


def test_empty_samples_returns_empty():
    segments = segment_corners([], SAMPLE_CORNERS)
    assert segments == []


def test_empty_corners_returns_empty():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, [])
    assert segments == []


def test_corner_names_preserved():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, SAMPLE_CORNERS)
    corner_names = [s.corner_name for s in segments]
    for seg in segments:
        matching_def = next(c for c in SAMPLE_CORNERS if c["number"] == seg.corner_number)
        assert seg.corner_name == matching_def["name"]


def test_get_corner_samples_returns_window():
    lap_samples = _get_first_lap_samples()
    segments = segment_corners(lap_samples, SAMPLE_CORNERS)
    if segments:
        corner_samples = get_corner_samples(lap_samples, segments[0])
        assert len(corner_samples) > 0


def test_single_corner_dataset():
    """Test with dedicated single-corner dataset."""
    raw = build_single_corner_dataset()
    processed = preprocess(raw)
    # Use only the first corner definition
    segments = segment_corners(processed, [SAMPLE_CORNERS[0]])
    assert len(segments) > 0
    seg = segments[0]
    assert seg.corner_number == 1
