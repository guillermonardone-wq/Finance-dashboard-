"""Basic tests for lap detection."""

from app.models.schemas import SensorSample, GpsSample
from app.analysis.lap_detector import detect_laps


def test_no_samples_returns_empty():
    result = detect_laps([], {"lat1": 0, "lng1": 0, "lat2": 0, "lng2": 0})
    assert result == []


def test_too_few_samples_returns_empty():
    samples = [
        SensorSample(t=0, gps=GpsSample(lat=0, lng=0)),
        SensorSample(t=1, gps=GpsSample(lat=1, lng=1)),
    ]
    result = detect_laps(samples, {"lat1": 0, "lng1": 0, "lat2": 0, "lng2": 0})
    assert result == []


def test_segments_intersect():
    from app.analysis.lap_detector import _segments_intersect

    # Crossing segments
    assert _segments_intersect(0, 0, 1, 1, 0, 1, 1, 0) is True
    # Parallel segments
    assert _segments_intersect(0, 0, 1, 0, 0, 1, 1, 1) is False
