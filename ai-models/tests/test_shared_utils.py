"""
test_shared_utils.py
─────────────────────────────────────────────────────────────────────────────
Unit tests for shared utilities in /ai-models/shared/:
  - Test database connector
  - Test data models
  - Test utility functions
  - Test configuration loading
─────────────────────────────────────────────────────────────────────────────
"""

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
import pytest
import pandas as pd

from shared.database_connector import DatabaseConnector, DatabaseConfig
from shared.models import Defect, DefectSeverity, Department, DefectSource, PriorityResult, TrafficSlot, WorkBundle
from shared.config import AIConfig, ai_config
from shared.utils import (
    load_json_config,
    save_json_data,
    load_csv_to_dataframe,
    save_dataframe_to_csv,
    parse_datetime,
    calculate_time_difference,
    setup_logger,
    validate_defect_data,
    normalize_score,
)


def test_utility_json_and_csv_io():
    """Tests JSON and CSV file persistence and loading."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # 1. JSON Save & Load
        json_file = tmp_path / "test.json"
        data = {"service": "indian-railways", "version": "1.0", "active": True}
        assert save_json_data(data, json_file) is True
        assert json_file.exists()

        loaded_json = load_json_config(json_file)
        assert loaded_json == data

        # Non-existent file returns empty dict
        assert load_json_config(tmp_path / "missing.json") == {}

        # 2. CSV Save & Load
        csv_file = tmp_path / "test.csv"
        df = pd.DataFrame([
            {"col1": "A", "col2": 10},
            {"col1": "B", "col2": 20},
        ])
        assert save_dataframe_to_csv(df, csv_file) is True
        assert csv_file.exists()

        loaded_df = load_csv_to_dataframe(csv_file)
        assert len(loaded_df) == 2
        assert list(loaded_df["col1"]) == ["A", "B"]


def test_utility_datetime_parsing():
    """Tests parse_datetime with strings, epochs, and timezone handling."""
    # ISO string with UTC Z
    dt1 = parse_datetime("2026-09-06T10:30:00Z")
    assert dt1 is not None
    assert dt1.year == 2026 and dt1.month == 9 and dt1.day == 6
    assert dt1.tzinfo is not None

    # Epoch timestamp
    dt2 = parse_datetime(1788690600)
    assert dt2 is not None
    assert dt2.tzinfo == timezone.utc

    # Invalid input
    assert parse_datetime(None) is None
    assert parse_datetime("invalid-date-string") is None


def test_utility_time_difference():
    """Tests calculate_time_difference in minutes and absolute modes."""
    t1 = "2026-09-06T10:00:00Z"
    t2 = "2026-09-06T12:30:00Z"

    # Forward diff: 150 minutes
    assert calculate_time_difference(t1, t2) == 150.0

    # Reverse diff: -150 minutes
    assert calculate_time_difference(t2, t1) == -150.0

    # Absolute diff: 150 minutes
    assert calculate_time_difference(t2, t1, absolute=True) == 150.0


def test_utility_validate_defect_data():
    """Tests validate_defect_data schema and severity validation."""
    valid_defect = {
        "defect_id": "DEF-001",
        "department": "CIVIL",
        "section_id": "NDLS-CNB-UP",
        "severity": "CRITICAL",
    }
    is_valid, errors = validate_defect_data(valid_defect)
    assert is_valid is True
    assert len(errors) == 0

    # Missing required field
    invalid_defect = {
        "department": "CIVIL",
        "section_id": "NDLS-CNB-UP",
    }
    is_valid, errors = validate_defect_data(invalid_defect)
    assert is_valid is False
    assert any("defect_id" in err for err in errors)

    # Invalid severity
    bad_sev_defect = {
        "defect_id": "DEF-002",
        "department": "CIVIL",
        "section_id": "NDLS-CNB-UP",
        "severity": "SUPER_URGENT",
    }
    is_valid, errors = validate_defect_data(bad_sev_defect)
    assert is_valid is False
    assert any("severity" in err for err in errors)


def test_utility_normalize_score():
    """Tests score normalization and clamping."""
    # Scale 50 in [0, 100] to [0, 10]
    assert normalize_score(50, 0, 100, 0, 10) == 5.0

    # Clamping out-of-bounds
    assert normalize_score(150, 0, 100, 0, 100) == 100.0
    assert normalize_score(-20, 0, 100, 0, 100) == 0.0


def test_utility_setup_logger():
    """Tests setup_logger configuration with console and file output."""
    with tempfile.TemporaryDirectory() as tmpdir:
        log_file = Path(tmpdir) / "test.log"
        test_logger = setup_logger("unit_test_logger", log_file=log_file, level="DEBUG")

        assert test_logger.name == "unit_test_logger"
        test_logger.info("Test log entry")

        # Verify log file created and populated
        assert log_file.exists()
        content = log_file.read_text(encoding="utf-8")
        assert "Test log entry" in content

        # Close handlers so Windows can release file lock
        for h in test_logger.handlers[:]:
            h.close()
            test_logger.removeHandler(h)


def test_data_models():
    """Tests common dataclasses in shared/models.py."""
    defect = Defect(
        defect_id="DEF-101",
        section_id="NDLS-CNB-UP",
        department="CIVIL",
        asset_type="RAIL_THERMIT_WELD",
        severity="HIGH",
        detection_method="USFD",
    )
    assert defect.defect_id == "DEF-101"
    d_dict = defect.to_dict()
    assert d_dict["department"] == "CIVIL"
    assert d_dict["severity"] == "HIGH"
    assert d_dict["asset_type"] == "RAIL_THERMIT_WELD"

    # PriorityResult
    p_res = PriorityResult(
        defect_id="DEF-101",
        priority_score=88.5,
        priority_category="P1",
        priority_name="Critical / Immediate Intervention",
        explanation={"summary": "Critical track defect"},
    )
    assert p_res.priority_score == 88.5
    assert p_res.to_dict()["priority_category"] == "P1"

    # WorkBundle
    bundle = WorkBundle(
        bundle_id="BND-01",
        section_id="NDLS-CNB-UP",
        tasks=[{"task_id": "T-1"}],
        total_duration=90,
    )
    assert len(bundle.tasks) == 1
    assert bundle.to_dict()["bundle_id"] == "BND-01"


def test_database_connector_offline_resilience(db_connector):
    """Tests that DatabaseConnector falls back cleanly when PostgreSQL is offline."""
    # Test fallback defect query
    defects = db_connector.get_defects_for_prioritization(limit=5)
    assert len(defects) > 0
    if isinstance(defects, pd.DataFrame):
        first = defects.iloc[0].to_dict()
    else:
        first = defects[0]
    assert "defect_id" in first
    assert "severity" in first

    # Test fallback timetable
    now = datetime.now(timezone.utc)
    tt = db_connector.get_train_timetable("NDLS-CNB-UP", now, now + pd.Timedelta(hours=6))
    assert isinstance(tt, pd.DataFrame)
    assert len(tt) > 0


def test_configuration_loading():
    """Tests loading AIConfig and service configurations."""
    cfg = AIConfig()
    assert cfg.default_timezone == "Asia/Kolkata"
    assert cfg.database_batch_size >= 100

    prio_cfg = cfg.get_priority_config()
    assert isinstance(prio_cfg, dict)
    assert "feature_weights" in prio_cfg or "priority_thresholds" in prio_cfg

    traffic_cfg = cfg.get_traffic_config()
    assert isinstance(traffic_cfg, dict)

    opt_cfg = cfg.get_optimizer_config()
    assert isinstance(opt_cfg, dict)
