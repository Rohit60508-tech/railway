"""
test_agents_swarm.py
─────────────────────────────────────────────────────────────────────────────
Unit and Integration Tests for Indian Railways 10-Agent Swarm System
─────────────────────────────────────────────────────────────────────────────
"""

import unittest
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = TESTS_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from agents.orchestrator import orchestrator


class TestRailwayAgentSwarm(unittest.TestCase):
    def setUp(self):
        self.orchestrator = orchestrator

    def test_all_ten_agents_registered(self):
        """Verify all 10 agents specified in Section 8 exist in registry."""
        agents = self.orchestrator.list_agents()
        self.assertEqual(len(agents), 10, "Swarm must contain exactly 10 registered agents")
        agent_ids = {a["agent_id"] for a in agents}
        expected_ids = {
            "defect_priority_agent",
            "time_to_event_risk_agent",
            "traffic_forecast_agent",
            "vision_defect_alert_agent",
            "text_extraction_agent",
            "planner_qa_agent",
            "explanation_agent",
            "anomaly_detection_agent",
            "scheduling_agent",
            "federated_learning_agent"
        }
        self.assertEqual(agent_ids, expected_ids)

    def test_defect_priority_agent_p1_classification(self):
        """Test DefectPriorityAgent returns P1 for IMR flaw."""
        res = self.orchestrator.run_agent("defect_priority_agent", {
            "defect_type": "IMR_RAIL_FRACTURE",
            "severity_score": 95.0,
            "line_speed_kmh": 130.0,
            "oms_peak_g": 0.42
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["result"]["priority"], "P1")
        self.assertTrue(res["result"]["is_imr_critical"])
        self.assertIsNotNone(res["result"]["recommended_tsr_kmh"])

    def test_time_to_event_risk_agent(self):
        """Test TimeToEventRiskAgent computes hazard ratio and survival curve."""
        res = self.orchestrator.run_agent("time_to_event_risk_agent", {
            "asset_type": "60KG_RAIL",
            "wear_depth_mm": 6.8,
            "cumulative_gmt": 400.0
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("estimated_rul_days", res["result"])
        self.assertIn("survival_curve", res["result"])
        self.assertGreater(len(res["result"]["survival_curve"]), 0)

    def test_traffic_forecast_agent(self):
        """Test TrafficForecastAgent provides 24h occupancy and low density block windows."""
        res = self.orchestrator.run_agent("traffic_forecast_agent", {
            "section_id": "NDLS-CNB-01"
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("hourly_forecast", res["result"])
        self.assertEqual(len(res["result"]["hourly_forecast"]), 24)
        self.assertIn("recommended_block_windows", res["result"])

    def test_vision_defect_alert_agent(self):
        """Test VisionDefectAlertAgent returns bounding boxes and defect labels."""
        res = self.orchestrator.run_agent("vision_defect_alert_agent", {
            "image_uri": "drone_test_km84.jpg"
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["result"]["defect_detected"])
        self.assertIn("bounding_boxes", res["result"])

    def test_anomaly_detection_agent(self):
        """Test AnomalyDetectionAgent flags extreme physical boundary violations."""
        res = self.orchestrator.run_agent("anomaly_detection_agent", {
            "telemetry": {
                "oms_vertical_accel_g": 1.25, # High spike violation
                "rail_temperature_c": 82.0    # Above 72 deg physical limit
            }
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["result"]["is_anomalous"])
        self.assertGreaterEqual(res["result"]["anomaly_count"], 2)

    def test_scheduling_agent(self):
        """Test SchedulingAgent allocates conflict-free shadow blocks."""
        res = self.orchestrator.run_agent("scheduling_agent", {
            "corridor": "NDLS-CNB",
            "tasks": [
                {"id": "T1", "type": "RAIL_WELD", "dept": "CIVIL", "duration_min": 60, "requires_power_block": True},
                {"id": "T2", "type": "OHE_WASH", "dept": "TRD_OHE", "duration_min": 60, "requires_power_block": True}
            ]
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("scheduled_blocks", res["result"])

    def test_federated_learning_agent(self):
        """Test FederatedLearningAgent executes FedAvg round with Differential Privacy."""
        res = self.orchestrator.run_agent("federated_learning_agent", {
            "round_number": 16,
            "epsilon": 2.5
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("differential_privacy", res["result"])
        self.assertEqual(res["result"]["total_participating_zones"], 4)

    def test_full_triage_pipeline(self):
        """Test collaborative 7-step triage pipeline."""
        res = self.orchestrator.run_triage_pipeline({
            "text": "IMR flaw located at KM 118 on UP main track",
            "severity_score": 90.0,
            "line_speed_kmh": 130.0
        })
        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(len(res["steps_executed"]), 7)
    def test_custom_data_trainer(self):
        """Test AdaptiveCustomTrainer with arbitrary user-defined schema and columns."""
        from training.custom_data_trainer import AdaptiveCustomTrainer
        trainer = AdaptiveCustomTrainer()
        custom_records = [
            {"track_segment": "ZONE_A", "flaw_mm": 5.2, "traffic_mgt": 42.0, "risk_category": "HIGH"},
            {"track_segment": "ZONE_B", "flaw_mm": 1.1, "traffic_mgt": 20.0, "risk_category": "LOW"},
            {"track_segment": "ZONE_A", "flaw_mm": 3.4, "traffic_mgt": 35.0, "risk_category": "MEDIUM"}
        ]
        res = trainer.train(custom_records, target_column="risk_category")
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["target_column"], "risk_category")
        self.assertIn("performance_metrics", res)
        self.assertGreater(len(res["top_feature_importance"]), 0)


if __name__ == "__main__":
    unittest.main()

