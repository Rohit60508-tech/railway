"""
schedule_generator.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for block-optimizer/schedule_generator.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "block-optimizer"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "schedule_generator.py"
_spec = importlib.util.spec_from_file_location("block_optimizer.schedule_generator", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    ScheduleGenerator = _mod.ScheduleGenerator
    __all__ = ["ScheduleGenerator"]
else:
    class ScheduleGenerator:  # type: ignore
        pass
    __all__ = ["ScheduleGenerator"]
