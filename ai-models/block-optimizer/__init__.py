# block-optimizer/__init__.py
# Multi-Department Maintenance Block Optimization Engine
# ──────────────────────────────────────────────────────────
# Uses Google OR-Tools CP-SAT constraint programming to solve
# multi-department block scheduling and bundling for Indian Railways:
#   - Bundles Civil, TRD (OHE), and S&T tasks in the same section
#   - Enforces slot duration, gang availability, and track capacity
#   - Minimizes total train traffic disruption and knock-on delay

from .constraint_solver import BlockConstraintSolver
from .bundling_engine import BundlingEngine
from .slot_scorer import SlotScorer
from .schedule_generator import ScheduleGenerator

# Aliases for backwards compatibility
CPConstraintSolver = BlockConstraintSolver
TaskBundler = BundlingEngine

__version__ = "1.0.0"
__all__ = [
    "BlockConstraintSolver",
    "BundlingEngine",
    "SlotScorer",
    "ScheduleGenerator",
    "CPConstraintSolver",
    "TaskBundler",
]
