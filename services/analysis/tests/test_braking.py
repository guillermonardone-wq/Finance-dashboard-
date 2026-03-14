"""Tests for the braking inference algorithm."""

from app.core.preprocessing import preprocess
from app.core.test_fixtures import (
    build_single_corner_dataset,
    make_sample,
    SAMPLE_CORNERS,
)
from app.algorithms.corner_segmentation import segment_corners
from app.algorithms.braking import detect_braking, detect_all_braking_events
from app.core.schemas import ProcessedSample, CornerSegment


def _get_corner_and_samples():
    """Get a preprocessed corner segment and its samples."""
    raw = build_single_corner_dataset()
    processed = preprocess(raw)
    segments = segment_corners(processed, [SAMPLE_CORNERS[0]])
    assert len(segments) > 0
    return processed, segments[0]


def test_braking_detected_in_corner():
    samples, segment = _get_corner_and_samples()
    event = detect_braking(samples, segment)
    assert event is not None
    assert event.peak_decel_g > 0
    assert event.duration_s > 0


def test_braking_timing_before_apex():
    samples, segment = _get_corner_and_samples()
    event = detect_braking(samples, segment)
    assert event is not None
    # Braking should start before apex
    assert event.start_time <= segment.apex_time


def test_braking_confidence_reasonable():
    samples, segment = _get_corner_and_samples()
    event = detect_braking(samples, segment)
    assert event is not None
    assert 0.1 <= event.confidence <= 1.0


def test_no_braking_when_no_decel():
    """Constant speed → no braking detected."""
    raw = [
        make_sample(float(i), 36.5843 - i * 0.0002, -121.7525 + i * 0.0002,
                     speed=30, ax=0.0, ay=0.0)
        for i in range(20)
    ]
    processed = preprocess(raw)
    segments = segment_corners(processed, [SAMPLE_CORNERS[0]])
    if segments:
        event = detect_braking(processed, segments[0])
        assert event is None


def test_speed_context_populated():
    samples, segment = _get_corner_and_samples()
    event = detect_braking(samples, segment)
    if event is not None:
        # Speed at start should be higher than speed at end (slowing down)
        if event.speed_at_start_kmh is not None and event.speed_at_end_kmh is not None:
            assert event.speed_at_start_kmh >= event.speed_at_end_kmh


def test_detect_all_braking_events():
    raw = build_single_corner_dataset()
    processed = preprocess(raw)
    events = detect_all_braking_events(processed)
    # Should find at least one braking event in the dataset
    assert len(events) >= 1


def test_braking_event_has_data_sources():
    samples, segment = _get_corner_and_samples()
    event = detect_braking(samples, segment)
    if event is not None:
        assert "start_time" in event.data_sources
        assert event.data_sources["start_time"] == "inferred"
        assert event.data_sources["peak_decel_g"] == "measured"
