"""
block_optimizer package
─────────────────────────────────────────────────────────────────────────────
Package alias and forwarding exports for block-optimizer.
Enables standard static analysis (Pyright/Pylance/MyPy) and direct module imports.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path

_SRC_DIR = Path(__file__).resolve().parent.parent / "block-optimizer"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from .constraint_solver import BlockConstraintSolver, ORTOOLS_AVAILABLE
from .bundling_engine import BundlingEngine
from .schedule_generator import ScheduleGenerator
from .slot_scorer import SlotScorer

__all__ = [
    "BlockConstraintSolver",
    "ORTOOLS_AVAILABLE",
    "BundlingEngine",
    "ScheduleGenerator",
    "SlotScorer",
]
