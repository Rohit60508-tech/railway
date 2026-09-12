# priority-engine/__init__.py
# Defect Priority & Risk Scoring Engine
# ─────────────────────────────────────
# Ranks maintenance work orders by a composite risk score derived from:
#   - Safety severity and RDSO classification
#   - Traffic density and train loading
#   - SLA overdue days and defect age
#   - Failure probability & asset criticality
#   - Environmental & weather hazards

from .defect_prioritizer import DefectPrioritizer
from .model_trainer import ModelTrainer
from .model_loader import ModelLoader, model_loader
from .urgency_scorer import UrgencyScorer

# Aliases for backwards compatibility
PriorityEngine = DefectPrioritizer
RiskScorer = UrgencyScorer
FeatureExtractor = DefectPrioritizer

__version__ = "1.0.0"
__all__ = [
    "DefectPrioritizer",
    "ModelTrainer",
    "ModelLoader",
    "model_loader",
    "UrgencyScorer",
    "PriorityEngine",
    "RiskScorer",
    "FeatureExtractor",
]
