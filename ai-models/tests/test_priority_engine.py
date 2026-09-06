"""
test_priority_engine.py
─────────────────────────────────────────────────────────────────────────────
Unit tests for DefectPrioritizer in /ai-models/priority-engine/:
  - Test feature extraction
  - Test priority score calculation
  - Test priority categorization
  - Test explanation generation
  - Test batch prioritization
  - Test model save/load
─────────────────────────────────────────────────────────────────────────────
"""

import os
import tempfile
from pathlib import Path
import pytest
from sklearn.ensemble import RandomForestClassifier

from priority_engine.defect_prioritizer import DefectPrioritizer


def test_feature_extraction(prioritizer, sample_defects):
    """Verifies that all 10 domain features are extracted and normalized between 0 and 100."""
    defect = sample_defects[0]  # Critical USFD defect
    features = prioritizer.extract_features(defect)

    expected_features = [
        "safety_severity",
        "traffic_density",
        "overdue_days",
        "failure_probability",
        "asset_criticality",
        "redundancy_factor",
        "defect_age",
        "inspection_source_weight",
        "department_weight",
        "location_criticality",
    ]

    for feat in expected_features:
        assert feat in features, f"Missing feature: {feat}"
        assert 0.0 <= features[feat] <= 100.0, f"Feature {feat} out of range: {features[feat]}"

    # USFD and CRITICAL should yield high severity and source weights
    assert features["safety_severity"] == 100.0
    assert features["inspection_source_weight"] >= 90.0


def test_priority_score_calculation(prioritizer, sample_defects):
    """Verifies weighted priority score calculation bounded in [0, 100]."""
    critical_defect = sample_defects[0]
    minor_defect = sample_defects[3]

    crit_features = prioritizer.extract_features(critical_defect)
    crit_score = prioritizer.calculate_priority_score(crit_features)

    minor_features = prioritizer.extract_features(minor_defect)
    minor_score = prioritizer.calculate_priority_score(minor_features)

    assert 0.0 <= crit_score <= 100.0
    assert 0.0 <= minor_score <= 100.0
    assert crit_score > minor_score, f"Critical score ({crit_score}) should exceed minor score ({minor_score})"


def test_priority_categorization(prioritizer):
    """Verifies categorization into P1 (85+), P2 (70-84), P3 (50-69), P4 (0-49)."""
    p1_cat, _ = prioritizer.categorize_priority(92.0)
    assert p1_cat == "P1"

    p2_cat, _ = prioritizer.categorize_priority(78.5)
    assert p2_cat == "P2"

    p3_cat, _ = prioritizer.categorize_priority(62.0)
    assert p3_cat == "P3"

    p4_cat, _ = prioritizer.categorize_priority(35.0)
    assert p4_cat == "P4"

    # Boundary tests
    assert prioritizer.categorize_priority(85.0)[0] == "P1"
    assert prioritizer.categorize_priority(70.0)[0] == "P2"
    assert prioritizer.categorize_priority(50.0)[0] == "P3"
    assert prioritizer.categorize_priority(49.9)[0] == "P4"


def test_explanation_generation(prioritizer, sample_defects):
    """Verifies generation of structured, human-readable explanations with drivers."""
    defect = sample_defects[0]
    features = prioritizer.extract_features(defect)
    score = prioritizer.calculate_priority_score(features)
    category, _ = prioritizer.categorize_priority(score)

    explanation = prioritizer.generate_explanation(features, score, category, defect)

    assert "summary" in explanation
    assert "top_drivers" in explanation
    assert "feature_breakdown" in explanation
    assert "highlights" in explanation
    assert len(explanation["top_drivers"]) <= 3
    assert explanation["category"] == category
    assert explanation["score"] == score
    assert isinstance(explanation["summary"], str) and len(explanation["summary"]) > 10


def test_batch_prioritization(prioritizer, sample_defects):
    """Verifies batch prioritization and sorting by descending priority score."""
    ranked = prioritizer.prioritize_batch(sample_defects, sort_by_priority=True)

    assert len(ranked) == len(sample_defects)

    # Check descending order
    scores = [item["priority_score"] for item in ranked]
    assert scores == sorted(scores, reverse=True)

    # Ensure each item contains expected keys
    for item in ranked:
        assert "defect_id" in item
        assert "priority_score" in item
        assert "priority_category" in item
        assert "explanation" in item


def test_model_save_and_load(sample_defects):
    """Verifies saving a trained model to joblib and reloading it for inference."""
    prioritizer = DefectPrioritizer()

    # Train a minimal RandomForest model
    clf = RandomForestClassifier(n_estimators=10, random_state=42)
    # Fit on dummy data with feature column names
    import pandas as pd
    X = pd.DataFrame(
        [
            [90.0, 80.0, 50.0, 80.0, 70.0, 60.0, 40.0, 95.0, 80.0, 70.0],
            [20.0, 30.0, 0.0, 10.0, 30.0, 10.0, 5.0, 40.0, 50.0, 20.0],
        ],
        columns=prioritizer.FEATURE_KEYS,
    )
    y = [1, 0]
    clf.fit(X, y)

    prioritizer.model = clf
    prioritizer.model_metadata = {"model_type": "RandomForestClassifier", "accuracy": 1.0}

    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = Path(tmpdir) / "test_model.joblib"
        saved_path = prioritizer.save_model(model_path)
        assert os.path.exists(saved_path)

        # Create fresh instance and load
        new_prioritizer = DefectPrioritizer()
        assert new_prioritizer.model is None
        new_prioritizer.load_model(saved_path)

        assert new_prioritizer.model is not None
        assert new_prioritizer.model_metadata.get("model_type") == "RandomForestClassifier"

        # Check prediction
        features = new_prioritizer.extract_features(sample_defects[0])
        score = new_prioritizer.predict_with_model(features)
        assert 0.0 <= score <= 100.0
