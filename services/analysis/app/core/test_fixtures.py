"""
Shared test fixtures: sample track definitions and sensor data.

These are minimal but realistic enough to exercise all algorithm paths.
GPS coordinates are based on a simplified ~90s lap around Laguna Seca.
"""

from app.models.schemas import SensorSample, GpsSample, AccelSample, GyroSample


# ---------------------------------------------------------------------------
# Sample track definition
# ---------------------------------------------------------------------------

SAMPLE_TRACK = {
    "id": "test-laguna-seca",
    "name": "Laguna Seca Test",
    "sf_line": {
        "lat1": 36.5849,
        "lng1": -121.7536,
        "lat2": 36.5847,
        "lng2": -121.7532,
    },
}

SAMPLE_CORNERS = [
    {
        "number": 1,
        "name": "Turn 1 (Andretti Hairpin)",
        "direction": "right",
        "type": "hairpin",
        "entry_lat": 36.5843,
        "entry_lng": -121.7525,
        "apex_lat": 36.5841,
        "apex_lng": -121.7523,
        "exit_lat": 36.5838,
        "exit_lng": -121.7521,
        "tolerance_meters": 20,
    },
    {
        "number": 2,
        "name": "Turn 2",
        "direction": "left",
        "type": "sweeper",
        "entry_lat": 36.5828,
        "entry_lng": -121.7505,
        "apex_lat": 36.5818,
        "apex_lng": -121.7488,
        "exit_lat": 36.5800,
        "exit_lng": -121.7445,
        "tolerance_meters": 25,
    },
]


# ---------------------------------------------------------------------------
# Sample sensor data — two laps worth
# ---------------------------------------------------------------------------

def make_sample(
    t: float,
    lat: float,
    lng: float,
    speed: float = 0.0,
    ax: float = 0.0,
    ay: float = 0.0,
    az: float = -9.81,
) -> SensorSample:
    """Helper to build a SensorSample with defaults."""
    return SensorSample(
        t=t,
        gps=GpsSample(lat=lat, lng=lng, speed=speed, accuracy=3.0),
        accel=AccelSample(x=ax, y=ay, z=az),
        gyro=GyroSample(x=0.0, y=0.0, z=0.0),
    )


def build_two_lap_dataset() -> list[SensorSample]:
    """
    Build a minimal dataset that crosses the S/F line 3 times (= 2 laps).

    Lap 1: t=0 → t=90  (90s)
    Lap 2: t=90 → t=180 (90s)

    Includes braking events near corner 1 and acceleration after corners.
    """
    samples = [
        # === Lap 1 start — crossing S/F ===
        make_sample(0.0, 36.5848, -121.7534, speed=0, ax=0.0),
        make_sample(1.0, 36.5847, -121.7533, speed=5, ax=2.0),
        make_sample(2.0, 36.5846, -121.7531, speed=15, ax=3.0, ay=0.1),
        make_sample(3.0, 36.5845, -121.7528, speed=25, ax=2.5, ay=0.3),

        # Approaching corner 1 — braking zone
        make_sample(4.0, 36.5844, -121.7526, speed=30, ax=-3.0, ay=0.5),
        make_sample(5.0, 36.5843, -121.7525, speed=22, ax=-4.0, ay=5.0),

        # Corner 1 apex
        make_sample(6.0, 36.5841, -121.7523, speed=18, ax=-1.0, ay=7.0),
        make_sample(7.0, 36.5838, -121.7521, speed=15, ax=0.0, ay=8.0),

        # Corner 1 exit — acceleration
        make_sample(8.0, 36.5836, -121.7519, speed=20, ax=2.0, ay=6.0),
        make_sample(9.0, 36.5835, -121.7518, speed=25, ax=3.0, ay=3.0),
        make_sample(10.0, 36.5833, -121.7515, speed=30, ax=2.5, ay=1.0),

        # Mid-lap — approaching corner 2
        make_sample(15.0, 36.5828, -121.7505, speed=35, ax=1.0, ay=-4.0),
        make_sample(20.0, 36.5818, -121.7488, speed=40, ax=0.5, ay=3.0),

        # Through mid-course
        make_sample(30.0, 36.5800, -121.7445, speed=50, ax=1.0, ay=2.0),
        make_sample(40.0, 36.5790, -121.7530, speed=35, ax=-4.0, ay=6.0),
        make_sample(50.0, 36.5780, -121.7540, speed=20, ax=-2.0, ay=9.0),
        make_sample(60.0, 36.5783, -121.7555, speed=30, ax=2.0, ay=-5.0),
        make_sample(70.0, 36.5808, -121.7562, speed=40, ax=1.5, ay=3.0),
        make_sample(80.0, 36.5830, -121.7545, speed=45, ax=1.0, ay=-2.0),
        make_sample(85.0, 36.5843, -121.7536, speed=50, ax=1.0, ay=1.0),

        # === Lap 1 end / Lap 2 start — crossing S/F ===
        make_sample(90.0, 36.5849, -121.7534, speed=55, ax=0.5, ay=0.0),
        make_sample(91.0, 36.5847, -121.7533, speed=50, ax=-1.0, ay=0.0),

        # Lap 2 — braking for corner 1
        make_sample(95.0, 36.5843, -121.7525, speed=30, ax=-4.0, ay=6.0),
        make_sample(100.0, 36.5838, -121.7521, speed=20, ax=-1.5, ay=8.5),

        # Lap 2 mid-course
        make_sample(110.0, 36.5828, -121.7505, speed=37, ax=1.0, ay=-3.5),
        make_sample(120.0, 36.5818, -121.7488, speed=42, ax=0.5, ay=4.0),
        make_sample(130.0, 36.5800, -121.7445, speed=52, ax=1.5, ay=2.5),
        make_sample(140.0, 36.5790, -121.7530, speed=33, ax=-4.5, ay=7.0),
        make_sample(150.0, 36.5780, -121.7540, speed=18, ax=-2.5, ay=9.5),
        make_sample(160.0, 36.5783, -121.7555, speed=32, ax=2.5, ay=-4.5),
        make_sample(170.0, 36.5808, -121.7562, speed=42, ax=2.0, ay=3.5),
        make_sample(178.0, 36.5843, -121.7536, speed=52, ax=1.0, ay=0.5),

        # === Lap 2 end — crossing S/F ===
        make_sample(180.0, 36.5849, -121.7534, speed=55, ax=0.5, ay=0.0),
    ]
    return samples


def build_single_corner_dataset() -> list[SensorSample]:
    """
    Minimal dataset for testing corner-level algorithms.
    Simulates approach → braking → apex → exit for a single right-hander.
    """
    return [
        # Approach at speed
        make_sample(0.0, 36.5846, -121.7531, speed=30, ax=0.5),
        make_sample(0.5, 36.5845, -121.7529, speed=30, ax=0.2),

        # Braking zone: strong deceleration for 1.5s
        make_sample(1.0, 36.5844, -121.7527, speed=28, ax=-3.0, ay=0.5),
        make_sample(1.5, 36.5844, -121.7526, speed=24, ax=-4.5, ay=1.0),
        make_sample(2.0, 36.5843, -121.7525, speed=20, ax=-3.5, ay=3.0),

        # Turn-in
        make_sample(2.5, 36.5842, -121.7524, speed=18, ax=-1.0, ay=5.0),

        # Apex — minimum speed
        make_sample(3.0, 36.5841, -121.7523, speed=15, ax=0.0, ay=7.0),
        make_sample(3.5, 36.5840, -121.7522, speed=14, ax=0.0, ay=7.5),

        # Exit — acceleration
        make_sample(4.0, 36.5839, -121.7521, speed=16, ax=1.5, ay=6.0),
        make_sample(4.5, 36.5838, -121.7521, speed=18, ax=2.5, ay=5.0),
        make_sample(5.0, 36.5837, -121.7520, speed=22, ax=3.0, ay=3.0),
        make_sample(5.5, 36.5836, -121.7519, speed=26, ax=2.5, ay=2.0),
        make_sample(6.0, 36.5835, -121.7518, speed=30, ax=2.0, ay=1.0),
    ]
