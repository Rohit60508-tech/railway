"""
traffic_predictor package
─────────────────────────────────────────────────────────────────────────────
Package alias and forwarding exports for traffic-predictor.
Enables standard static analysis (Pyright/Pylance/MyPy) and direct module imports.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path

_SRC_DIR = Path(__file__).resolve().parent.parent / "traffic-predictor"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from .traffic_analyzer import TrafficAnalyzer
from .forecast_engine import ForecastEngine
from .corridor_availability import CorridorAvailabilityCalculator
from .delay_predictor import CascadeDelayPredictor

__all__ = [
    "TrafficAnalyzer",
    "ForecastEngine",
    "CorridorAvailabilityCalculator",
    "CascadeDelayPredictor",
]
