"""
slot_scorer.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for block-optimizer/slot_scorer.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "block-optimizer"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "slot_scorer.py"
_spec = importlib.util.spec_from_file_location("block_optimizer.slot_scorer", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    SlotScorer = _mod.SlotScorer
    __all__ = ["SlotScorer"]
else:
    class SlotScorer:  # type: ignore
        pass
    __all__ = ["SlotScorer"]
