"""
conftest.py
─────────────────────────────────────────────────────────────────────────────
Pytest configuration and shared fixtures for Indian Railways AI test suite:
  - Path initialization and module aliasing for hyphenated directories
  - Fixtures for test data (sample defects, timetable DataFrame, tasks, slots)
  - Fixtures for model instances (DefectPrioritizer, TrafficAnalyzer, etc.)
  - Database connection & mock fallback fixtures
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import importlib.util
from pathlib import Path
from typing import Any, Dict, List

import pytest
import pandas as pd

# Setup absolute paths
TESTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = TESTS_DIR.parent
WORKSPACE_DIR = AI_MODELS_DIR.parent
TEST_DATA_DIR = TESTS_DIR / "test_data"

for d in [WORKSPACE_DIR, AI_MODELS_DIR]:
    if str(d) not in sys.path:
        sys.path.insert(0, str(d))

# Register hyphenated packages
HYPHENATED_PACKAGES = [
    ("priority_engine", "priority-engine"),
    ("traffic_predictor", "traffic-predictor"),
    ("block_optimizer", "block-optimizer"),
    ("training", "training"),
    ("shared", "shared"),
    ("inference", "inference"),
]

for pkg_name, folder_name in HYPHENATED_PACKAGES:
    pkg_path = AI_MODELS_DIR / folder_name
    if pkg_path.exists():
        if str(pkg_path) not in sys.path:
            sys.path.insert(0, str(pkg_path))
        init_file = pkg_path / "__init__.py"
        if pkg_name not in sys.modules and init_file.exists():
            spec = importlib.util.spec_from_file_location(
                pkg_name,
                str(init_file),
                submodule_search_locations=[str(pkg_path)],
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[pkg_name] = mod
                try:
                    spec.loader.exec_module(mod)
                except Exception:
                    pass

from priority_engine.defect_prioritizer import DefectPrioritizer
from traffic_predictor.traffic_analyzer import TrafficAnalyzer
from block_optimizer.bundling_engine import BundlingEngine
from block_optimizer.constraint_solver import BlockConstraintSolver
from shared.database_connector import DatabaseConnector, DatabasePool


@pytest.fixture(scope="session")
def test_data_path() -> Path:
    """Returns path to the test_data directory."""
    return TEST_DATA_DIR


@pytest.fixture(scope="session")
def sample_defects() -> List[Dict[str, Any]]:
    """Loads sample defect records from JSON."""
    file_path = TEST_DATA_DIR / "sample_defects.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def sample_traffic_df() -> pd.DataFrame:
    """Loads sample train traffic timetable into pandas DataFrame."""
    file_path = TEST_DATA_DIR / "sample_traffic.csv"
    return pd.read_csv(file_path)


@pytest.fixture(scope="session")
def sample_tasks() -> List[Dict[str, Any]]:
    """Loads sample multi-department maintenance tasks from JSON."""
    file_path = TEST_DATA_DIR / "sample_tasks.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def sample_slots() -> List[Dict[str, Any]]:
    """Loads sample candidate block slots from JSON."""
    file_path = TEST_DATA_DIR / "sample_slots.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def prioritizer() -> DefectPrioritizer:
    """Returns a DefectPrioritizer instance."""
    return DefectPrioritizer()


@pytest.fixture(scope="session")
def traffic_analyzer() -> TrafficAnalyzer:
    """Returns a TrafficAnalyzer instance."""
    return TrafficAnalyzer()


@pytest.fixture(scope="session")
def bundling_engine() -> BundlingEngine:
    """Returns a BundlingEngine instance."""
    return BundlingEngine()


@pytest.fixture(scope="session")
def constraint_solver() -> BlockConstraintSolver:
    """Returns a BlockConstraintSolver instance."""
    return BlockConstraintSolver()


@pytest.fixture(scope="session")
def db_connector() -> DatabaseConnector:
    """Returns a DatabaseConnector instance operating in resilient mode."""
    return DatabaseConnector()
