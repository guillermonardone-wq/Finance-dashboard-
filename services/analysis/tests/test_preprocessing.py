"""Tests for the preprocessing pipeline."""

from app.core.preprocessing import preprocess, haversine_meters
from app.core.test_fixtures import build_two_lap_dataset, make_sample
from app.models.schemas import SensorSample, GpsSample


def test_preprocess_returns_processed_samples():
    raw = build_two_lap_dataset()
    result = preprocess(raw)
    assert len(result) > 0
    assert result[0].t == 0.0  # timestamps start at 0


def test_preprocess_drops_samples_without_gps():
    raw = [
        SensorSample(t=0),  # no GPS
        make_sample(1.0, 36.0, -121.0, speed=10),
        SensorSample(t=2),  # no GPS
    ]
    result = preprocess(raw)
    assert len(result) == 1
    assert result[0].lat == 36.0


def test_timestamps_normalized_to_zero():
    raw = [
        make_sample(100.0, 36.0, -121.0),
        make_sample(101.0, 36.001, -121.001),
        make_sample(102.0, 36.002, -121.002),
    ]
    result = preprocess(raw)
    assert result[0].t == 0.0
    assert result[1].t == 1.0
    assert result[2].t == 2.0


def test_cumulative_distance_increases():
    raw = build_two_lap_dataset()
    result = preprocess(raw)
    assert result[0].cumulative_distance_m == 0.0
    # Distance should generally increase for a moving car
    assert result[-1].cumulative_distance_m > 0


def test_heading_computed():
    raw = [
        make_sample(0.0, 36.0, -121.0),
        make_sample(1.0, 36.001, -121.0),  # moving north
        make_sample(2.0, 36.002, -121.0),  # still north
    ]
    result = preprocess(raw)
    # Heading should be roughly north (0° or 360°)
    assert result[1].heading_deg is not None
    assert result[1].heading_deg < 10 or result[1].heading_deg > 350


def test_lon_accel_g_computed():
    raw = [
        make_sample(0.0, 36.0, -121.0, ax=9.81),  # 1G forward
        make_sample(1.0, 36.001, -121.0, ax=-4.905),  # 0.5G braking
    ]
    result = preprocess(raw)
    # Check that lon_accel_g is derived (may be smoothed)
    assert result[0].lon_accel_g is not None


def test_haversine_zero_distance():
    d = haversine_meters(36.0, -121.0, 36.0, -121.0)
    assert d == 0.0


def test_haversine_known_distance():
    # ~111 km per degree of latitude
    d = haversine_meters(36.0, -121.0, 37.0, -121.0)
    assert 110_000 < d < 112_000


def test_empty_input_returns_empty():
    result = preprocess([])
    assert result == []
