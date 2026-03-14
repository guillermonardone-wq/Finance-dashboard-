"""Tests for the lap detection algorithm."""

from app.core.preprocessing import preprocess
from app.core.test_fixtures import (
    build_two_lap_dataset,
    make_sample,
    SAMPLE_TRACK,
)
from app.algorithms.lap_detection import detect_laps, get_lap_samples
from app.core.schemas import LapValidity


def _preprocess_and_detect(raw_samples):
    """Helper: preprocess then detect laps."""
    processed = preprocess(raw_samples)
    return detect_laps(processed, SAMPLE_TRACK["sf_line"])


def test_two_laps_detected():
    raw = build_two_lap_dataset()
    laps = _preprocess_and_detect(raw)
    assert len(laps) == 2


def test_lap_times_reasonable():
    raw = build_two_lap_dataset()
    laps = _preprocess_and_detect(raw)
    for lap in laps:
        assert 30 <= lap.lap_time_s <= 600


def test_laps_are_valid():
    raw = build_two_lap_dataset()
    laps = _preprocess_and_detect(raw)
    for lap in laps:
        assert lap.validity == LapValidity.VALID


def test_lap_numbers_sequential():
    raw = build_two_lap_dataset()
    laps = _preprocess_and_detect(raw)
    for i, lap in enumerate(laps):
        assert lap.lap_number == i + 1


def test_empty_samples_returns_empty():
    processed = preprocess([])
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"])
    assert laps == []


def test_too_few_samples_returns_empty():
    raw = [make_sample(0, 36.0, -121.0), make_sample(1, 36.001, -121.0)]
    processed = preprocess(raw)
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"])
    assert laps == []


def test_no_crossing_returns_empty():
    # Samples that never cross the S/F line
    raw = [
        make_sample(float(i), 36.0 + i * 0.001, -121.0, speed=20)
        for i in range(20)
    ]
    processed = preprocess(raw)
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"])
    assert laps == []


def test_short_lap_flagged():
    raw = build_two_lap_dataset()
    processed = preprocess(raw)
    # Use a very high min_lap_time to force short classification
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"], min_lap_time=200)
    assert all(lap.validity == LapValidity.TOO_SHORT for lap in laps)


def test_get_lap_samples():
    raw = build_two_lap_dataset()
    processed = preprocess(raw)
    laps = detect_laps(processed, SAMPLE_TRACK["sf_line"])
    assert len(laps) > 0

    lap1_samples = get_lap_samples(processed, laps[0])
    assert len(lap1_samples) > 0
    # All samples should be within the lap boundaries
    for s in lap1_samples:
        assert laps[0].start_time <= s.t <= laps[0].end_time


def test_max_speed_populated():
    raw = build_two_lap_dataset()
    laps = _preprocess_and_detect(raw)
    for lap in laps:
        assert lap.max_speed_kmh is not None
        assert lap.max_speed_kmh > 0
