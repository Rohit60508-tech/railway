"""
test_traffic_predictor.py
─────────────────────────────────────────────────────────────────────────────
Unit tests for TrafficAnalyzer in /ai-models/traffic-predictor/:
  - Test section occupancy calculation
  - Test conflict detection
  - Test traffic impact scoring
  - Test slot scoring
  - Test best slot prediction
  - Test goods forecast impact
─────────────────────────────────────────────────────────────────────────────
"""

from datetime import datetime, timezone, timedelta
import pytest

from traffic_predictor.traffic_analyzer import TrafficAnalyzer


def test_section_occupancy_calculation(traffic_analyzer):
    """Verifies calculation of sectional train volume and occupancy percentage."""
    now = datetime(2026, 9, 6, 6, 0, tzinfo=timezone.utc)
    end_time = now + timedelta(hours=4)

    occupancy = traffic_analyzer.calculate_section_occupancy(
        section_id="NDLS-CNB-UP",
        start_time=now,
        end_time=end_time,
    )

    assert "occupancy_percentage" in occupancy
    assert "trains_count" in occupancy
    assert 0.0 <= occupancy["occupancy_percentage"] <= 100.0
    assert occupancy["window_duration_minutes"] == 240
    assert occupancy["section_id"] == "NDLS-CNB-UP"


def test_conflict_detection(traffic_analyzer):
    """Verifies identification of scheduled trains that overlap with a proposed block."""
    proposed_start = datetime(2026, 9, 6, 8, 0, tzinfo=timezone.utc)
    proposed_end = datetime(2026, 9, 6, 10, 0, tzinfo=timezone.utc)

    # Test with synthetic/database timetable
    conflicts = traffic_analyzer.identify_train_conflicts(
        section_id="NDLS-CNB-UP",
        proposed_start=proposed_start,
        proposed_end=proposed_end,
    )

    assert isinstance(conflicts, list)
    for c in conflicts:
        assert "train_number" in c
        assert "overlap_minutes" in c
        assert c["overlap_minutes"] > 0


def test_traffic_impact_scoring(traffic_analyzer):
    """Verifies traffic impact scoring formula and cascade delay calculations."""
    # Zero conflicts should produce zero impact
    zero_impact = traffic_analyzer.calculate_traffic_impact_score([], block_duration_minutes=120)
    assert zero_impact["impact_score"] == 0.0
    assert zero_impact["conflicts_count"] == 0

    # Multiple conflicts should increase score
    mock_conflicts = [
        {"train_number": "12004", "train_type": "PREMIUM_PASSENGER", "overlap_minutes": 45},
        {"train_number": "12424", "train_type": "RAJDHANI_EXP", "overlap_minutes": 30},
        {"train_number": "BOXN_10", "train_type": "FREIGHT", "overlap_minutes": 60},
    ]
    high_impact = traffic_analyzer.calculate_traffic_impact_score(mock_conflicts, block_duration_minutes=120)
    assert 0.0 < high_impact["impact_score"] <= 100.0
    assert high_impact["conflicts_count"] == 3
    assert "cascade_delay" in high_impact


def test_slot_scoring(traffic_analyzer):
    """Verifies candidate slot evaluation, diurnal adjustments, and feasibility labels."""
    slot = {
        "slot_start": datetime(2026, 9, 6, 2, 0, tzinfo=timezone.utc),  # Night window
        "slot_end": datetime(2026, 9, 6, 4, 0, tzinfo=timezone.utc),
        "leading_slack_minutes": 30,
        "trailing_slack_minutes": 30,
    }

    scored = traffic_analyzer.score_slot(
        section_id="NDLS-CNB-UP",
        slot=slot,
        duration_minutes=120,
    )

    assert "disruption_score" in scored
    assert "feasibility" in scored
    assert "time_window_type" in scored
    assert 0.0 <= scored["disruption_score"] <= 100.0
    # Night slots receive night bonus
    assert scored["time_window_type"] == "NIGHT_SHADOW_CORRIDOR"


def test_best_slot_prediction(traffic_analyzer):
    """Verifies returning top recommended block slots ranked by minimum disruption."""
    search_start = datetime(2026, 9, 6, 0, 0, tzinfo=timezone.utc)
    search_end = search_start + timedelta(days=2)

    best_slots = traffic_analyzer.predict_best_slots(
        section_id="NDLS-CNB-UP",
        search_start=search_start,
        search_end=search_end,
        duration_minutes=120,
        top_k=5,
    )

    assert isinstance(best_slots, list)
    assert len(best_slots) <= 5
    if len(best_slots) >= 2:
        # Check sorted by disruption score ascending
        for i in range(len(best_slots) - 1):
            assert best_slots[i]["disruption_score"] <= best_slots[i + 1]["disruption_score"]


def test_goods_forecast_impact(traffic_analyzer):
    """Verifies forecasting of freight goods rake movements and controller guidance."""
    start_time = datetime(2026, 9, 6, 0, 0, tzinfo=timezone.utc)
    impact = traffic_analyzer.get_goods_forecast_impact(
        section_id="NDLS-CNB-UP",
        start_time=start_time,
        days=3,
    )

    assert "total_projected_rakes" in impact
    assert "average_daily_rakes" in impact
    assert "controller_insights" in impact
    assert impact["total_projected_rakes"] >= 0
