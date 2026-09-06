"""
corridor_availability.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for traffic-predictor/corridor_availability.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "traffic-predictor"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "corridor_availability.py"
_spec = importlib.util.spec_from_file_location("traffic_predictor.corridor_availability", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    CorridorAvailabilityCalculator = _mod.CorridorAvailabilityCalculator
    __all__ = ["CorridorAvailabilityCalculator"]
else:
    class CorridorAvailabilityCalculator:  # type: ignore
        pass
    __all__ = ["CorridorAvailabilityCalculator"]
