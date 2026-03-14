"""Tests for the exit acceleration algorithm."""

from app.core.preprocessing import preprocess
from app.core.test_fixtures import (
    build_single_corner_dataset,
    make_sample,
    SAMPLE_CORNERS,
)
from app.algorithms.corner_segmentation import segment_corners
from app.algorithms.exit_acceleration import analyze_exit_acceleration


def _get_corner_and_samples():
    """Get a preprocessed corner segment and its samples."""
    raw = build_single_corner_dataset()
    processed = preprocess(raw)
    segments = segment_corners(processed, [SAMPLE_CORNERS[0]])
    assert len(segments) > 0
    return processed, segments[0]


def test_exit_accel_detected():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    assert result is not None
    assert result.corner_number == segment.corner_number


def test_throttle_pickup_after_apex():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    assert result is not None
    assert result.throttle_pickup_time >= result.apex_time


def test_throttle_delay_positive():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    assert result is not None
    assert result.throttle_delay_s >= 0


def test_exit_quality_score_bounded():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    assert result is not None
    assert 0.0 <= result.exit_quality_score <= 1.0


def test_confidence_bounded():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    assert result is not None
    assert 0.1 <= result.confidence <= 1.0


def test_speed_gain_positive():
    """In the test dataset, speed should increase from apex to exit."""
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    if result is not None and result.speed_gain_kmh is not None:
        assert result.speed_gain_kmh >= 0


def test_data_sources_labeled():
    samples, segment = _get_corner_and_samples()
    result = analyze_exit_acceleration(samples, segment)
    if result is not None:
        assert result.data_sources["throttle_pickup_time"] == "inferred"
        assert result.data_sources["peak_accel_g"] == "measured"
        assert result.data_sources["exit_quality_score"] == "inferred"


def test_no_exit_accel_when_decelerating():
    """If the car is still braking through the exit, no accel event."""
    raw = [
        make_sample(float(i), 36.5843 - i * 0.0002, -121.7525 + i * 0.0002,
                     speed=max(5, 30 - i * 2), ax=-3.0, ay=0.0)
        for i in range(15)
    ]
    processed = preprocess(raw)
    segments = segment_corners(processed, [SAMPLE_CORNERS[0]])
    if segments:
        result = analyze_exit_acceleration(processed, segments[0])
        # Should be None since car never accelerates
        assert result is None
