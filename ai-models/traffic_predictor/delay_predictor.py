"""
delay_predictor.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for traffic-predictor/delay_predictor.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "traffic-predictor"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "delay_predictor.py"
_spec = importlib.util.spec_from_file_location("traffic_predictor.delay_predictor", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    DelayPredictor = getattr(_mod, "DelayPredictor", None) or getattr(_mod, "CascadeDelayPredictor", None)
    CascadeDelayPredictor = DelayPredictor
    __all__ = ["DelayPredictor", "CascadeDelayPredictor"]
else:
    class DelayPredictor:  # type: ignore
        pass
    CascadeDelayPredictor = DelayPredictor
    __all__ = ["DelayPredictor", "CascadeDelayPredictor"]
