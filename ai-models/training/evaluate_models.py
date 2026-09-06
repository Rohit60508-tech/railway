"""
evaluate_models.py
─────────────────────────────────────────────────────────────────────────────
Comprehensive evaluation suite for Indian Railways AI models.
Evaluates:
  1. Defect Priority Classifier: Accuracy, Precision, Recall, F1-Score (per class and macro), Confusion Matrix.
  2. Traffic Delay Predictor: MAE, RMSE, MAPE, Max Error, R2 score, and punctuality tolerance coverage.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import argparse
import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
)

# Resolve paths
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from prepare_training_data import DataPreparationPipeline

logger = get_logger("evaluate_models")

PRIORITY_MODEL_PATHS = [
    AI_MODELS_DIR / "priority-engine" / "models" / "priority_model.pkl",
    AI_MODELS_DIR / "priority-engine" / "artifacts" / "defect_priority_model.joblib",
]

TRAFFIC_MODEL_PATHS = [
    AI_MODELS_DIR / "traffic-predictor" / "models" / "traffic_model.pkl",
    AI_MODELS_DIR / "traffic-predictor" / "artifacts" / "traffic_forecaster.joblib",
]


def load_artifact(paths: list) -> Tuple[Any, Path]:
    """Attempts loading model artifact from list of priority paths."""
    for p in paths:
        if p.exists():
            payload = joblib.load(p)
            model = payload["model"] if isinstance(payload, dict) and "model" in payload else payload
            return model, p
    raise FileNotFoundError(f"No valid model artifact found among: {paths}")


def evaluate_priority_model(test_samples: int = 1000) -> Dict[str, Any]:
    """
    Evaluates classification performance on held-out defect test data.
    """
    logger.info("Evaluating Defect Priority Model...")
    model, model_path = load_artifact(PRIORITY_MODEL_PATHS)

    pipeline = DataPreparationPipeline()
    _, X_test, _, y_test, feature_names = pipeline.prepare_defect_dataset(limit=test_samples, test_size=0.3)

    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)

    prec_weighted = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec_weighted = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    target_names = ["P4 (Routine)", "P3 (Medium)", "P2 (High)", "P1 (Critical)"]
    report = classification_report(
        y_test, y_pred, labels=[0, 1, 2, 3], target_names=target_names, output_dict=True, zero_division=0
    )
    conf_mat = confusion_matrix(y_test, y_pred, labels=[0, 1, 2, 3]).tolist()

    return {
        "model_path": str(model_path),
        "test_samples": len(X_test),
        "accuracy": round(float(acc), 4),
        "macro_metrics": {
            "precision": round(float(prec_macro), 4),
            "recall": round(float(rec_macro), 4),
            "f1_score": round(float(f1_macro), 4),
        },
        "weighted_metrics": {
            "precision": round(float(prec_weighted), 4),
            "recall": round(float(rec_weighted), 4),
            "f1_score": round(float(f1_weighted), 4),
        },
        "confusion_matrix": conf_mat,
        "per_class_metrics": {
            k: {
                "precision": round(report[k]["precision"], 4),
                "recall": round(report[k]["recall"], 4),
                "f1_score": round(report[k]["f1-score"], 4),
                "support": int(report[k]["support"]),
            }
            for k in target_names if k in report
        },
    }


def evaluate_traffic_model(test_samples: int = 1000) -> Dict[str, Any]:
    """
    Evaluates delay prediction regression performance on held-out timetable data.
    """
    logger.info("Evaluating Traffic Delay Prediction Model...")
    model, model_path = load_artifact(TRAFFIC_MODEL_PATHS)

    pipeline = DataPreparationPipeline()
    _, X_test, _, y_test, feature_names = pipeline.prepare_traffic_dataset(limit=test_samples, test_size=0.3)

    y_pred = model.predict(X_test)
    errors = np.abs(y_test.values - y_pred)

    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)
    max_err = np.max(errors)

    # Operational tolerance thresholds
    within_5_min = np.mean(errors <= 5.0) * 100.0
    within_10_min = np.mean(errors <= 10.0) * 100.0
    within_15_min = np.mean(errors <= 15.0) * 100.0

    return {
        "model_path": str(model_path),
        "test_samples": len(X_test),
        "mae_minutes": round(float(mae), 2),
        "rmse_minutes": round(float(rmse), 2),
        "r2_score": round(float(r2), 4),
        "max_error_minutes": round(float(max_err), 2),
        "tolerance_coverage": {
            "within_5_minutes_pct": round(float(within_5_min), 1),
            "within_10_minutes_pct": round(float(within_10_min), 1),
            "within_15_minutes_pct": round(float(within_15_min), 1),
        },
    }


def print_evaluation_summary(priority_res: Optional[Dict[str, Any]], traffic_res: Optional[Dict[str, Any]]) -> None:
    """Prints beautiful formatted summary to console."""
    print("\n" + "=" * 70)
    print(" [REPORT] INDIAN RAILWAYS AI MODEL EVALUATION REPORT")
    print("=" * 70)

    if priority_res:
        print("\n[1] DEFECT PRIORITY CLASSIFIER")
        print(f"Artifact : {priority_res['model_path']}")
        print(f"Accuracy : {priority_res['accuracy'] * 100:.2f}% (Test Samples: {priority_res['test_samples']})")
        print(f"Macro    : Precision={priority_res['macro_metrics']['precision']:.4f} | Recall={priority_res['macro_metrics']['recall']:.4f} | F1={priority_res['macro_metrics']['f1_score']:.4f}")
        print(f"Weighted : Precision={priority_res['weighted_metrics']['precision']:.4f} | Recall={priority_res['weighted_metrics']['recall']:.4f} | F1={priority_res['weighted_metrics']['f1_score']:.4f}")
        print("\nPer-Tier Performance:")
        print(f"  {'Tier':<20} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support'}")
        print("  " + "-" * 62)
        for tier, m in priority_res["per_class_metrics"].items():
            print(f"  {tier:<20} {m['precision'] * 100:>8.1f}%   {m['recall'] * 100:>8.1f}%   {m['f1_score']:>8.4f}     {m['support']}")

    if traffic_res:
        print("\n" + "-" * 70)
        print("[2] TRAIN TRAFFIC DELAY PREDICTOR")
        print(f"Artifact : {traffic_res['model_path']}")
        print(f"MAE      : {traffic_res['mae_minutes']} minutes (Average absolute prediction error)")
        print(f"RMSE     : {traffic_res['rmse_minutes']} minutes")
        print(f"R2 Score : {traffic_res['r2_score']} (Variance explained)")
        print(f"Max Err  : {traffic_res['max_error_minutes']} minutes")
        print("\nOperational Tolerance Coverage:")
        print(f"  - Forecast within +/-5  mins : {traffic_res['tolerance_coverage']['within_5_minutes_pct']}%")
        print(f"  - Forecast within +/-10 mins : {traffic_res['tolerance_coverage']['within_10_minutes_pct']}%")
        print(f"  - Forecast within +/-15 mins : {traffic_res['tolerance_coverage']['within_15_minutes_pct']}%")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Trained Indian Railways AI Models")
    parser.add_argument("--model", type=str, default="all", choices=["all", "priority", "traffic"])
    parser.add_argument("--samples", type=int, default=1000)
    args = parser.parse_args()

    p_res = None
    t_res = None

    if args.model in ("all", "priority"):
        try:
            p_res = evaluate_priority_model(test_samples=args.samples)
        except Exception as e:
            logger.error(f"Priority model evaluation failed: {e}")

    if args.model in ("all", "traffic"):
        try:
            t_res = evaluate_traffic_model(test_samples=args.samples)
        except Exception as e:
            logger.error(f"Traffic model evaluation failed: {e}")

    print_evaluation_summary(p_res, t_res)
