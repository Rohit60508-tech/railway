"""
test_integration.py
─────────────────────────────────────────────────────────────────────────────
Integration tests for Indian Railways AI models:
  - Test end-to-end defect prioritization
  - Test traffic analysis with real/sample data
  - Test full optimization workflow (Priority -> Bundling -> Slots -> CP-SAT)
  - Test API endpoints
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import pytest

from priority_engine.defect_prioritizer import DefectPrioritizer
from priority_engine.model_loader import model_loader
from traffic_predictor.traffic_analyzer import TrafficAnalyzer
from block_optimizer.schedule_generator import ScheduleGenerator
from inference.health_api import get_overall_health, get_model_health
from inference.priority_api import prioritize_defect, DefectPrioritizeRequest
from inference.traffic_api import get_section_occupancy
from inference.optimizer_api import optimize_schedule, OptimizeScheduleRequest


def test_end_to_end_defect_prioritization(sample_defects):
    """
    Tests full pipeline from raw defect input through feature extraction,
    ML / heuristic inference, priority scoring, P1-P4 categorization, and explainability.
    """
    prioritizer = DefectPrioritizer()
    ranked_batch = prioritizer.prioritize_batch(sample_defects, sort_by_priority=True)

    assert len(ranked_batch) == len(sample_defects)

    # Top defect should be the critical one
    top = ranked_batch[0]
    assert top["priority_category"] in ("P1", "P2")
    assert top["priority_score"] >= 70.0
    assert "explanation" in top
    assert len(top["explanation"]["top_drivers"]) > 0

    # Also test via singleton model_loader
    ml_result = model_loader.predict_priority(sample_defects[0])
    assert "priority_score" in ml_result
    assert "priority_category" in ml_result


def test_traffic_analysis_with_data(sample_traffic_df):
    """
    Tests traffic analysis workflow using actual timetable records:
    calculates occupancy, identifies conflicts, and scores candidate slots.
    """
    analyzer = TrafficAnalyzer()

    # Convert sample timetable records to dict format
    timetable_records = sample_traffic_df.to_dict(orient="records")
    for rec in timetable_records:
        rec["entry_time"] = rec["scheduled_entry"]
        rec["exit_time"] = rec["scheduled_exit"]

    # Block between 08:00 and 10:00 (overlaps with RAJDHANI_EXP at 08:30)
    start_dt = datetime(2026, 9, 6, 8, 0, tzinfo=timezone.utc)
    end_dt = datetime(2026, 9, 6, 10, 0, tzinfo=timezone.utc)

    conflicts = analyzer.identify_train_conflicts(
        section_id="NDLS-CNB-UP",
        proposed_start=start_dt,
        proposed_end=end_dt,
        timetable=timetable_records,
    )

    assert len(conflicts) >= 1
    rajdhani_conflicts = [c for c in conflicts if c.get("train_number") == "12424" or "RAJDHANI" in str(c.get("train_name"))]
    assert len(rajdhani_conflicts) > 0

    # Evaluate slot scoring
    slot = {
        "slot_start": start_dt,
        "slot_end": end_dt,
        "leading_slack_minutes": 15,
        "trailing_slack_minutes": 15,
    }
    scored = analyzer.score_slot("NDLS-CNB-UP", slot, duration_minutes=120, timetable=timetable_records)
    assert scored["conflicts_count"] == len(conflicts)
    assert scored["disruption_score"] > 0.0


def test_full_optimization_workflow(sample_defects, sample_slots):
    """
    Tests the complete end-to-end multi-department optimization pipeline:
    1. Defects are prioritized.
    2. High-priority defects are converted into maintenance work tasks.
    3. Tasks in same section are bundled across departments.
    4. Bundled tasks are scheduled against candidate corridor slots via CP-SAT.
    """
    # 1. Prioritize defects
    prioritizer = DefectPrioritizer()
    prioritized = prioritizer.prioritize_batch(sample_defects)

    # 2. Convert defects to work tasks
    tasks = []
    for d in prioritized:
        tasks.append({
            "task_id": f"TSK-{d['defect_id']}",
            "section_id": d["section_id"],
            "department": d["department"],
            "duration_minutes": 60,
            "priority_score": d["priority_score"],
            "priority_category": d["priority_category"],
        })

    # 3 & 4. Run schedule generator with bundling and constraint solver
    generator = ScheduleGenerator()
    schedule_result = generator.generate_optimized_schedule(
        tasks=tasks,
        available_slots=sample_slots,
        auto_bundle=True,
    )

    assert schedule_result["status"] in ("OPTIMAL", "FEASIBLE")
    assert "blocks" in schedule_result
    assert schedule_result["total_blocks_scheduled"] >= 1
    assert schedule_result["tasks_scheduled"] >= 1


def test_api_endpoints_integration(sample_defects, sample_tasks, sample_slots):
    """
    Verifies that the API endpoints function correctly end-to-end:
    - GET /api/v1/health
    - POST /api/v1/prioritize/defect
    - GET /api/v1/traffic/occupancy/NDLS-CNB-UP
    - POST /api/v1/optimize/schedule
    """
    import asyncio

    async def _run_endpoints():
        # 1. Health
        health = await get_overall_health()
        assert health["status"] in ("HEALTHY", "DEGRADED")

        # 2. Prioritize Defect Endpoint
        single_req = DefectPrioritizeRequest(**sample_defects[0])
        prio_resp = await prioritize_defect(single_req)
        assert prio_resp["status"] == "SUCCESS"
        assert "priority_score" in prio_resp["data"]

        # 3. Traffic Occupancy Endpoint
        occ_resp = await get_section_occupancy("NDLS-CNB-UP")
        assert occ_resp["status"] == "SUCCESS"
        assert "occupancy_percentage" in occ_resp["occupancy_data"]

        # 4. Optimizer Schedule Endpoint
        opt_req = OptimizeScheduleRequest(
            tasks=sample_tasks,
            slots=sample_slots,
            auto_bundle=True,
        )
        opt_resp = await optimize_schedule(opt_req)
        assert opt_resp["status"] == "SUCCESS"
        assert "optimization_result" in opt_resp

    asyncio.run(_run_endpoints())
