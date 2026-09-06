# traffic-predictor/__init__.py
# Traffic Flow, Corridor Availability & Block Impact Predictor
# ────────────────────────────────────────────────────────────
# Forecasts train traffic density, evaluates section occupancy,
# simulates knock-on cascade delays, and identifies optimal
# 15-minute maintenance block windows along Indian Railways tracks.

from .traffic_analyzer import TrafficAnalyzer
from .corridor_availability import CorridorAvailabilityCalculator
from .delay_predictor import DelayPredictor
from .forecast_engine import ForecastEngine

# Aliases for backwards compatibility
TrafficForecaster = ForecastEngine
BlockImpactEstimator = DelayPredictor
OptimalWindowFinder = TrafficAnalyzer

__version__ = "1.0.0"
__all__ = [
    "TrafficAnalyzer",
    "CorridorAvailabilityCalculator",
    "DelayPredictor",
    "ForecastEngine",
    "TrafficForecaster",
    "BlockImpactEstimator",
    "OptimalWindowFinder",
]
