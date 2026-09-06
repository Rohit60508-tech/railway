"""
test_block_optimizer.py
─────────────────────────────────────────────────────────────────────────────
Unit tests for BlockConstraintSolver and BundlingEngine in /ai-models/block-optimizer/:
  - Test constraint solving (OR-Tools CP-SAT)
  - Test department compatibility checking
  - Test bundle creation
  - Test bundling score calculation
  - Test schedule generation
─────────────────────────────────────────────────────────────────────────────
"""

import pytest

from block_optimizer.bundling_engine import BundlingEngine
from block_optimizer.constraint_solver import BlockConstraintSolver
from block_optimizer.schedule_generator import ScheduleGenerator


def test_department_compatibility_checking(bundling_engine):
    """Verifies pairwise departmental compatibility coefficients (0.0 to 1.0)."""
    # Same department is always 1.0
    assert bundling_engine.check_department_compatibility("CIVIL", "CIVIL") == 1.0
    assert bundling_engine.check_department_compatibility("TRD_OHE", "TRD_OHE") == 1.0

    # Cross-department compatibility
    civil_ohe = bundling_engine.check_department_compatibility("CIVIL", "TRD_OHE")
    assert 0.7 <= civil_ohe <= 1.0, f"Civil and OHE should be highly compatible, got {civil_ohe}"

    ohe_civil = bundling_engine.check_department_compatibility("TRD_OHE", "CIVIL")
    assert civil_ohe == ohe_civil, "Compatibility should be symmetric"

    # S&T compatibility
    civil_st = bundling_engine.check_department_compatibility("CIVIL", "SIGNALLING")
    assert 0.6 <= civil_st <= 1.0


def test_bundle_creation(bundling_engine, sample_tasks):
    """Verifies that maintenance tasks in the same section are consolidated into bundles."""
    bundles = bundling_engine.create_bundles(sample_tasks)

    assert isinstance(bundles, list)
    assert len(bundles) >= 1

    # In sample_tasks, TSK-001, TSK-002, TSK-003 are on NDLS-CNB-UP, TSK-004 is on CNB-PRYJ-DN
    ndls_bundles = [b for b in bundles if b.get("section_id") == "NDLS-CNB-UP"]
    assert len(ndls_bundles) >= 1

    # The NDLS bundle should contain bundled tasks
    main_bundle = ndls_bundles[0]
    assert len(main_bundle["tasks"]) >= 2
    assert "benefits" in main_bundle
    assert main_bundle["benefits"]["time_saved_minutes"] > 0


def test_bundling_score_calculation(bundling_engine, sample_tasks):
    """Verifies calculation of composite bundling quality scores (0 to 100)."""
    # High score for tasks in same section with compatible departments
    ndls_tasks = [t for t in sample_tasks if t.get("section_id") == "NDLS-CNB-UP"]
    score = bundling_engine.calculate_bundling_score(ndls_tasks)

    assert 0.0 <= score <= 100.0
    assert score >= 70.0, f"Compatible same-section tasks should have high score, got {score}"

    # Single task default
    single_score = bundling_engine.calculate_bundling_score([sample_tasks[0]])
    assert single_score == 50.0

    # Empty list
    assert bundling_engine.calculate_bundling_score([]) == 0.0


def test_constraint_solving(constraint_solver, sample_tasks, sample_slots):
    """Verifies constraint solving using OR-Tools CP-SAT."""
    result = constraint_solver.solve(
        tasks=sample_tasks,
        slots=sample_slots,
    )

    assert "status" in result
    assert result["status"] in ("OPTIMAL", "FEASIBLE")
    assert "schedule" in result
    assert result["assigned_tasks_count"] > 0
    assert len(result["schedule"]) > 0

    # Verify that scheduled tasks are matched with slots
    for sched_slot in result["schedule"]:
        assert "tasks_assigned" in sched_slot
        assert len(sched_slot["tasks_assigned"]) > 0


def test_schedule_generation(sample_tasks, sample_slots):
    """Verifies end-to-end schedule generation including bundling and CP-SAT solving."""
    generator = ScheduleGenerator()
    schedule_result = generator.generate_optimized_schedule(
        tasks=sample_tasks,
        available_slots=sample_slots,
        auto_bundle=True,
    )

    assert schedule_result["status"] in ("OPTIMAL", "FEASIBLE")
    assert "blocks" in schedule_result
    assert schedule_result["total_blocks_scheduled"] >= 1
    assert schedule_result["tasks_scheduled"] >= 1
    assert schedule_result["total_possession_minutes_saved"] >= 0
