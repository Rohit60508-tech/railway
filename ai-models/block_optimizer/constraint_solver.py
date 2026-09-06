"""
constraint_solver.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for block-optimizer/constraint_solver.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "block-optimizer"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "constraint_solver.py"
_spec = importlib.util.spec_from_file_location("block_optimizer.constraint_solver", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    BlockConstraintSolver = _mod.BlockConstraintSolver
    ORTOOLS_AVAILABLE = _mod.ORTOOLS_AVAILABLE
    __all__ = ["BlockConstraintSolver", "ORTOOLS_AVAILABLE"]
else:
    class BlockConstraintSolver:  # type: ignore
        pass
    ORTOOLS_AVAILABLE = False
    __all__ = ["BlockConstraintSolver", "ORTOOLS_AVAILABLE"]
