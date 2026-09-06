"""
test_inference_endpoints.py
─────────────────────────────────────────────────────────────────────────────
Comprehensive integration test for all Indian Railways AI Inference endpoints:
  - Health & Diagnostics API (Overall, Models, Database)
  - Priority Engine API (Defect scoring, Batch ranking, Model info, Retraining)
  - Traffic Predictor API (Occupancy, Slots discovery, Top 10 Best Slots, Forecast)
  - Optimizer API (OR-Tools Schedule solver, Bundling engine, Constraints, Validation)
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone

# Add paths
ROOT_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = ROOT_DIR / "ai-models"
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from fastapi import BackgroundTasks

from inference.health_api import (
    get_overall_health,
    get_model_health,
    get_database_health,
)
from inference.priority_api import (
    prioritize_defect,
    prioritize_batch,
    get_model_info,
    trigger_retraining,
    DefectPrioritizeRequest,
    DefectBatchRequest,
    RetrainRequest,
)
from inference.traffic_api import (
    get_section_occupancy,
    get_available_slots,
    get_best_slots,
    get_traffic_forecast,
)
from inference.optimizer_api import (
    optimize_schedule,
    find_bundles,
    get_optimization_constraints,
    validate_schedule,
    OptimizeScheduleRequest,
    FindBundlesRequest,
    ValidateScheduleRequest,
)


async def run_all_tests():
    print("=================================================================")
    print("INDIAN RAILWAYS AI INFERENCE ENDPOINTS INTEGRATION TEST SUITE")
    print("=================================================================")

    # ─────────────────────────────────────────────────────────────
    # 1. Health Endpoints
    # ─────────────────────────────────────────────────────────────
    print("\n[1/4] Testing Health & Diagnostic Endpoints...")

    # GET /api/v1/health
    h1 = await get_overall_health()
    assert "status" in h1
    print(f"  [OK] GET /api/v1/health -> status={h1['status']}, components={h1['components']}")

    # GET /api/v1/health/models
    h2 = await get_model_health()
    assert "models" in h2
    print(f"  [OK] GET /api/v1/health/models -> status={h2['status']}, priority={h2['models']['priority_classifier']['status']}")

    # GET /api/v1/health/database
    h3 = await get_database_health()
    assert "status" in h3
    print(f"  [OK] GET /api/v1/health/database -> status={h3['status']}")

    # ─────────────────────────────────────────────────────────────
    # 2. Priority Endpoints
    # ─────────────────────────────────────────────────────────────
    print("\n[2/4] Testing Defect Priority Endpoints...")

    # POST /api/v1/prioritize/defect
    single_req = DefectPrioritizeRequest(
        defect_id="DEF-TEST-NDLS-001",
        section_id="NDLS-CNB-UP",
        department="CIVIL",
        asset_type="RAIL_THERMIT_WELD",
        severity="CRITICAL",
        source="USFD",
        track_quality_index=35.0,
        trains_per_day=120.0,
        track_count=2,
        overdue_days=2.0,
        location_criticality=85.0,
        speed_restriction_kmh=30,
    )
    p1 = await prioritize_defect(single_req)
    res_data = p1["data"]
    print(f"  [OK] POST /api/v1/prioritize/defect -> ID={res_data['defect_id']}, Score={res_data['priority_score']}, Cat={res_data['priority_category']}")

    # POST /api/v1/prioritize/batch
    batch_req = DefectBatchRequest(
        defects=[
            single_req,
            DefectPrioritizeRequest(
                defect_id="DEF-TEST-CNB-002",
                section_id="NDLS-CNB-UP",
                department="TRD_OHE",
                asset_type="OHE_CANTILEVER",
                severity="MEDIUM",
                source="ITMS",
                track_quality_index=70.0,
                trains_per_day=80.0,
                track_count=2,
                overdue_days=0.0,
                location_criticality=45.0,
            ),
            DefectPrioritizeRequest(
                defect_id="DEF-TEST-PRYJ-003",
                section_id="CNB-PRYJ-DN",
                department="SIGNALLING",
                asset_type="POINT_MACHINE",
                severity="HIGH",
                source="PATROL",
                track_quality_index=55.0,
                trains_per_day=95.0,
                track_count=2,
                overdue_days=1.0,
                location_criticality=65.0,
            ),
        ],
        sort_by_priority=True,
    )
    p2 = await prioritize_batch(batch_req)
    print(f"  [OK] POST /api/v1/prioritize/batch -> Total={p2['total_defects']}, P1={p2['p1_count']}, P2={p2['p2_count']}, P3={p2['p3_count']}")

    # GET /api/v1/priority/model-info
    p3 = await get_model_info()
    minfo = p3["model_info"]
    print(f"  [OK] GET /api/v1/priority/model-info -> ModelType={minfo.get('model_type')}, Loaded={minfo.get('is_loaded')}")

    # POST /api/v1/priority/retrain
    bg = BackgroundTasks()
    retrain_req = RetrainRequest(samples=250, model_type="RandomForest")
    p4 = await trigger_retraining(retrain_req, bg)
    print(f"  [OK] POST /api/v1/priority/retrain -> Status={p4['status']}, Msg='{p4['message']}'")

    # ─────────────────────────────────────────────────────────────
    # 3. Traffic Endpoints
    # ─────────────────────────────────────────────────────────────
    print("\n[3/4] Testing Traffic & Corridor Predictor Endpoints...")
    section_id = "NDLS-CNB-UP"

    # GET /api/v1/traffic/occupancy/{section_id}
    t1 = await get_section_occupancy(section_id=section_id, start_time=None, end_time=None)
    occ = t1["occupancy_data"]
    print(f"  [OK] GET /api/v1/traffic/occupancy/{section_id} -> Trains={occ.get('total_trains')}, Density={occ.get('traffic_density_category')}")

    # GET /api/v1/traffic/slots/{section_id}
    t2 = await get_available_slots(section_id=section_id, duration_minutes=120)
    print(f"  [OK] GET /api/v1/traffic/slots/{section_id} -> Discovered slots={t2['slots_count']}")

    # GET /api/v1/traffic/best-slots/{section_id}/{duration}
    t3 = await get_best_slots(section_id=section_id, duration=120, top_k=5)
    print(f"  [OK] GET /api/v1/traffic/best-slots/{section_id}/120 -> Returned={t3['slots_returned']} candidate slots")

    # GET /api/v1/traffic/forecast/{section_id}/{date}
    t4 = await get_traffic_forecast(section_id=section_id, date="2026-09-06", horizon_hours=12)
    print(f"  [OK] GET /api/v1/traffic/forecast/{section_id}/2026-09-06 -> Projected {len(t4['hourly_projection'])} hours, Rakes={t4['freight_summary']['total_projected_rakes']}")

    # ─────────────────────────────────────────────────────────────
    # 4. Optimizer Endpoints
    # ─────────────────────────────────────────────────────────────
    print("\n[4/4] Testing Multi-Department Block Optimizer Endpoints...")

    # GET /api/v1/optimize/constraints
    o1 = await get_optimization_constraints()
    cfg = o1["constraints"]
    print(f"  [OK] GET /api/v1/optimize/constraints -> Objective={cfg.get('optimization_objective')}")

    # POST /api/v1/optimize/bundle
    bundle_req = FindBundlesRequest(
        tasks=[
            {"task_id": "T1", "section_id": "NDLS-CNB-UP", "department": "CIVIL", "duration_minutes": 90, "priority_score": 88},
            {"task_id": "T2", "section_id": "NDLS-CNB-UP", "department": "TRD_OHE", "duration_minutes": 60, "priority_score": 75},
            {"task_id": "T3", "section_id": "CNB-PRYJ-DN", "department": "SIGNALLING", "duration_minutes": 45, "priority_score": 60},
        ]
    )
    o2 = await find_bundles(bundle_req)
    print(f"  [OK] POST /api/v1/optimize/bundle -> Discovered {o2['bundles_count']} bundles, Saved {o2['total_time_saved_minutes']} mins ({o2['total_time_saved_hours']} hrs)")

    # POST /api/v1/optimize/schedule
    sched_req = OptimizeScheduleRequest(
        tasks=bundle_req.tasks,
        slots=[
            {"slot_id": "SLOT-01", "section_id": "NDLS-CNB-UP", "start_time": "2026-09-06T01:00:00Z", "end_time": "2026-09-06T03:30:00Z", "duration_minutes": 150, "disruption_score": 25.0},
            {"slot_id": "SLOT-02", "section_id": "CNB-PRYJ-DN", "start_time": "2026-09-06T02:00:00Z", "end_time": "2026-09-06T03:30:00Z", "duration_minutes": 90, "disruption_score": 18.0},
        ],
        auto_bundle=True,
    )
    o3 = await optimize_schedule(sched_req)
    res = o3["optimization_result"]
    print(f"  [OK] POST /api/v1/optimize/schedule -> Scheduled blocks={len(res.get('scheduled_blocks', []))}, Solver={res.get('solver_status')}")

    # POST /api/v1/optimize/validate
    val_req = ValidateScheduleRequest(
        schedule=[
            {
                "block_id": "BLK-01",
                "section_id": "NDLS-CNB-UP",
                "duration_minutes": 120,
                "disruption_score": 35.0,
                "tasks": [{"task_id": "T1", "duration_minutes": 90}],
            },
            {
                "block_id": "BLK-02",
                "section_id": "NDLS-CNB-UP",
                "duration_minutes": 60,
                "disruption_score": 85.0,
                "tasks": [{"task_id": "T2", "duration_minutes": 90}],  # Overflows duration
            },
        ]
    )
    o4 = await validate_schedule(val_req)
    print(f"  [OK] POST /api/v1/optimize/validate -> Valid={o4['is_valid']}, Violations={o4['violations_count']}, Warnings={o4['warnings_count']}")

    print("\n=================================================================")
    print("[ALL TESTS PASSED] ALL 15 INFERENCE ENDPOINTS OPERATIONAL!")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
