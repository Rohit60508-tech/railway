"""
orchestrator.py
─────────────────────────────────────────────────────────────────────────────
Indian Railways Multi-Agent AI Swarm Orchestrator
Coordinates all 10 specialized agents and end-to-end triage pipelines.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

AGENTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = AGENTS_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from agents.base_agent import BaseRailwayAgent
from agents.defect_priority_agent import DefectPriorityAgent
from agents.time_to_event_risk_agent import TimeToEventRiskAgent
from agents.traffic_forecast_agent import TrafficForecastAgent
from agents.vision_defect_alert_agent import VisionDefectAlertAgent
from agents.text_extraction_agent import TextExtractionAgent
from agents.planner_qa_agent import PlannerQAAgent
from agents.explanation_agent import ExplanationAgent
from agents.anomaly_detection_agent import AnomalyDetectionAgent
from agents.scheduling_agent import SchedulingAgent
from agents.federated_learning_agent import FederatedLearningAgent


class RailwayAgentOrchestrator:
    """
    Central controller for the Indian Railways 10-Agent Swarm.
    Manages registry, execution routing, and multi-agent collaborative workflows.
    """

    def __init__(self):
        self._agents: Dict[str, BaseRailwayAgent] = {}
        self._register_all_agents()

    def _register_all_agents(self):
        agents_list = [
            DefectPriorityAgent(),
            TimeToEventRiskAgent(),
            TrafficForecastAgent(),
            VisionDefectAlertAgent(),
            TextExtractionAgent(),
            PlannerQAAgent(),
            ExplanationAgent(),
            AnomalyDetectionAgent(),
            SchedulingAgent(),
            FederatedLearningAgent()
        ]
        for ag in agents_list:
            self._agents[ag.agent_id] = ag

    def list_agents(self) -> List[Dict[str, Any]]:
        """Returns catalog of all 10 registered agents with descriptions and AI methods."""
        return [ag.get_info() for ag in self._agents.values()]

    def get_agent(self, agent_id: str) -> Optional[BaseRailwayAgent]:
        return self._agents.get(agent_id)

    def run_agent(self, agent_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        agent = self.get_agent(agent_id)
        if not agent:
            raise KeyError(f"Unknown agent '{agent_id}'. Registered agents: {list(self._agents.keys())}")
        return agent.run(payload or {})

    def run_triage_pipeline(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an end-to-end multi-agent cooperative triage pipeline:
        1. Ingestion / Extraction (Vision or Ollama Text Extraction)
        2. Sensor Anomaly Check (AnomalyDetectionAgent)
        3. Priority Classification (DefectPriorityAgent)
        4. Time-to-Event Degradation (TimeToEventRiskAgent)
        5. Traffic Forecasting & Slot Identification (TrafficForecastAgent)
        6. Shadow Block Scheduling (SchedulingAgent)
        7. Ollama Explainability Justification (ExplanationAgent)
        """
        t0 = time.perf_counter()
        pipeline_log: List[Dict[str, Any]] = []

        # Step 1: Ingestion / Extraction
        if "image_uri" in payload or "image_path" in payload:
            step1_out = self.run_agent("vision_defect_alert_agent", payload)
            pipeline_log.append({"step": 1, "agent": "vision_defect_alert_agent", "output": step1_out})
            extracted_defect = step1_out.get("result", {}).get("primary_defect", "UNKNOWN_DEFECT")
        else:
            raw_text = payload.get("text", payload.get("raw_text", "IMR rail defect observed at KM 124/6 on UP main line."))
            step1_out = self.run_agent("text_extraction_agent", {"text": raw_text})
            pipeline_log.append({"step": 1, "agent": "text_extraction_agent", "output": step1_out})
            extracted_defect = step1_out.get("result", {}).get("defect_description", "RAIL_DEFECT")

        # Step 2: Telemetry Anomaly Sentinel
        telemetry = payload.get("telemetry", {
            "oms_vertical_accel_g": float(payload.get("oms_peak_g", 0.38)),
            "oms_lateral_accel_g": 0.12,
            "rail_temperature_c": float(payload.get("rail_temperature_c", 44.0)),
            "sensor_voltage_v": 12.1
        })
        step2_out = self.run_agent("anomaly_detection_agent", {"telemetry": telemetry})
        pipeline_log.append({"step": 2, "agent": "anomaly_detection_agent", "output": step2_out})

        # Step 3: Priority Scoring
        priority_payload = {
            "defect_type": extracted_defect,
            "severity_score": payload.get("severity_score", 88.0),
            "line_speed_kmh": payload.get("line_speed_kmh", 130.0),
            "annual_gmt": payload.get("annual_gmt", 42.0),
            "track_category": payload.get("track_category", "Group A (Main trunk)"),
            "oms_peak_g": telemetry.get("oms_vertical_accel_g", 0.38)
        }
        step3_out = self.run_agent("defect_priority_agent", priority_payload)
        pipeline_log.append({"step": 3, "agent": "defect_priority_agent", "output": step3_out})
        priority_res = step3_out.get("result", {})

        # Step 4: Survival / Time-to-Event Analysis
        survival_payload = {
            "asset_type": extracted_defect,
            "wear_depth_mm": payload.get("wear_depth_mm", 6.5),
            "cumulative_gmt": payload.get("cumulative_gmt", 390.0)
        }
        step4_out = self.run_agent("time_to_event_risk_agent", survival_payload)
        pipeline_log.append({"step": 4, "agent": "time_to_event_risk_agent", "output": step4_out})
        survival_res = step4_out.get("result", {})

        # Step 5: Traffic Forecasting
        step5_out = self.run_agent("traffic_forecast_agent", {"section_id": payload.get("section_id", "NDLS-CNB-01")})
        pipeline_log.append({"step": 5, "agent": "traffic_forecast_agent", "output": step5_out})

        # Step 6: Constraint Block Scheduling
        schedule_payload = {
            "corridor": payload.get("section_id", "NDLS-CNB-01"),
            "tasks": [
                {
                    "id": "EMERGENCY-BLK-01",
                    "type": "DEFECT_RECTIFICATION",
                    "dept": "CIVIL",
                    "duration_min": 90,
                    "priority": priority_res.get("priority", "P1")
                }
            ]
        }
        step6_out = self.run_agent("scheduling_agent", schedule_payload)
        pipeline_log.append({"step": 6, "agent": "scheduling_agent", "output": step6_out})

        # Step 7: Ollama Explainability Audit Justification
        explanation_payload = {
            "decision_type": "EMERGENCY_DEFECT_TRIAGE_AND_CORRIDOR_BLOCK",
            "target_id": payload.get("defect_id", "DEF-SWARM-2026-001"),
            "outcome": f"{priority_res.get('priority')} - {priority_res.get('priority_label')}",
            "features": priority_payload,
            "feature_importance": priority_res.get("feature_importance", [])
        }
        step7_out = self.run_agent("explanation_agent", explanation_payload)
        pipeline_log.append({"step": 7, "agent": "explanation_agent", "output": step7_out})

        total_elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            "pipeline": "Full-Swarm-Multi-Agent-Triage",
            "status": "COMPLETED",
            "total_execution_time_ms": total_elapsed_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "extracted_defect": extracted_defect,
                "assigned_priority": priority_res.get("priority"),
                "priority_label": priority_res.get("priority_label"),
                "estimated_rul_days": survival_res.get("estimated_rul_days"),
                "recommended_tsr_kmh": priority_res.get("recommended_tsr_kmh"),
                "allocated_block_window": step6_out.get("result", {}).get("scheduled_blocks", [{}])[0].get("assigned_window", "WIN-01"),
                "ai_justification": step7_out.get("result", {}).get("justification_text")
            },
            "steps_executed": pipeline_log
        }


# Global singleton orchestrator
orchestrator = RailwayAgentOrchestrator()
