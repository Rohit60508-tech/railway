"""
urgency_scorer.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for priority-engine/urgency_scorer.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "priority-engine"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "urgency_scorer.py"
_spec = importlib.util.spec_from_file_location("priority_engine.urgency_scorer", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    UrgencyScorer = _mod.UrgencyScorer
    __all__ = ["UrgencyScorer"]
else:
    class UrgencyScorer:  # type: ignore
        pass
    __all__ = ["UrgencyScorer"]
