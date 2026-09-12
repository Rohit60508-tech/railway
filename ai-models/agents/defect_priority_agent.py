"""
defect_priority_agent.py
─────────────────────────────────────────────────────────────────────────────
Agent 1: Defect Priority Agent
Need: Defect priority P1–P4
AI/ML Method: XGBoost / LightGBM / Random Forest / Ordinal Regression
Why Practical: Tabular, explainable, fast inference (<10ms)
─────────────────────────────────────────────────────────────────────────────
"""

import math
import sys
from pathlib import Path
from typing import Any, Dict, List

AGENTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = AGENTS_DIR.parent
PRIORITY_ENGINE_DIR = AI_MODELS_DIR / "priority-engine"

if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))
if str(PRIORITY_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(PRIORITY_ENGINE_DIR))

from agents.base_agent import BaseRailwayAgent
from priority_engine.xgboost_policy_learner import xgboost_learner


class DefectPriorityAgent(BaseRailwayAgent):
    def __init__(self):
        super().__init__(
            agent_id="defect_priority_agent",
            name="Track & Asset Defect Priority Classifier",
            need="Defect priority P1–P4",
            method="XGBoost 3.4 + Statutory Policy RAG (Self-Learning)",
            practical_rationale="Fast tabular self-learning fitted to Indian Railways safety rules without LLM hallucination"
        )

    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates defect priority P1 (Emergency), P2 (Urgent), P3 (Routine), P4 (Monitored)
        using self-learning XGBoost trained on user-defined priority rules and user training data,
        paired with Statutory Policy RAG retrieval (IRPWM Para 268/522/523, IRSEM, ACTM).
        """
        res = xgboost_learner.classify_with_policy_rag(payload)
        return res
