"""
priority_engine package
─────────────────────────────────────────────────────────────────────────────
Package alias and forwarding exports for priority-engine.
Enables standard static analysis (Pyright/Pylance/MyPy) and direct module imports.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path

_SRC_DIR = Path(__file__).resolve().parent.parent / "priority-engine"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from .model_loader import ModelLoader, model_loader
from .defect_prioritizer import DefectPrioritizer
from .urgency_scorer import UrgencyScorer

__all__ = [
    "ModelLoader",
    "model_loader",
    "DefectPrioritizer",
    "UrgencyScorer",
]
