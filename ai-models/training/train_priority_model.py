"""
train_priority_model.py
─────────────────────────────────────────────────────────────────────────────
Training pipeline for Indian Railways Defect Priority Classifier.
Loads historical defect records, applies domain feature engineering, trains
RandomForest / GradientBoosting classifier, evaluates metrics, and serializes
model artifacts to /ai-models/priority-engine/models/priority_model.pkl.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score

# Resolve paths
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from prepare_training_data import DataPreparationPipeline

logger = get_logger("train_priority_model")

DEFAULT_MODEL_DIR = AI_MODELS_DIR / "priority-engine" / "models"
DEFAULT_OUTPUT_PKL = DEFAULT_MODEL_DIR / "priority_model.pkl"
DEFAULT_ARTIFACT_PATH = AI_MODELS_DIR / "priority-engine" / "artifacts" / "defect_priority_model.joblib"


def train_priority_model(
    model_type: str = "RandomForest",
    n_estimators: int = 120,
    max_depth: int = 6,
    samples: int = 3000,
    output_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Executes training and persistence for the defect priority model.
    """
    out_file = Path(output_path) if output_path else DEFAULT_OUTPUT_PKL
    out_file.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading and preparing training data (limit: {samples})...")
    pipeline = DataPreparationPipeline()
    X_train, X_test, y_train, y_test, feature_names = pipeline.prepare_defect_dataset(limit=samples)

    # Initialize model
    logger.info(f"Instantiating {model_type}Classifier (n_estimators={n_estimators}, max_depth={max_depth})...")
    if "Gradient" in model_type:
        model = GradientBoostingClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            learning_rate=0.08,
        )
    else:
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            min_samples_split=4,
            n_jobs=-1,
        )

    # Train model
    logger.info("Fitting model on training set...")
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    target_names = ["P4", "P3", "P2", "P1"]
    report = classification_report(
        y_test, y_pred, labels=[0, 1, 2, 3], target_names=target_names, output_dict=True, zero_division=0
    )

    logger.info(f"Model Training Complete! Accuracy: {acc * 100:.2f}%, F1 Macro: {f1_macro:.4f}")

    # Feature Importances
    importances: Dict[str, float] = {}
    if hasattr(model, "feature_importances_"):
        for feat, imp in zip(feature_names, model.feature_importances_):
            importances[feat] = round(float(imp), 4)

    metadata = {
        "model_type": type(model).__name__,
        "accuracy": round(float(acc), 4),
        "f1_macro": round(float(f1_macro), 4),
        "samples_trained": len(X_train),
        "samples_tested": len(X_test),
        "features": feature_names,
        "feature_importances": importances,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    # Persist model bundle
    payload = {
        "model": model,
        "feature_keys": feature_names,
        "metadata": metadata,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }

    # Save to requested location /priority-engine/models/priority_model.pkl
    joblib.dump(payload, out_file)
    logger.info(f"Saved primary model artifact to: {out_file}")

    # Also synchronize with priority-engine artifacts directory for model_loader
    joblib.dump(payload, DEFAULT_ARTIFACT_PATH)
    logger.info(f"Synchronized model artifact to: {DEFAULT_ARTIFACT_PATH}")

    return {
        "model": model,
        "output_path": str(out_file),
        "metrics": metadata,
        "classification_report": report,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Indian Railways Defect Priority Model")
    parser.add_argument("--model-type", type=str, default="RandomForest", choices=["RandomForest", "GradientBoosting"])
    parser.add_argument("--n-estimators", type=int, default=120)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--samples", type=int, default=3000)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    results = train_priority_model(
        model_type=args.model_type,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        samples=args.samples,
        output_path=Path(args.output) if args.output else None,
    )

    print("\n" + "=" * 65)
    print(" [OK] DEFECT PRIORITY MODEL TRAINING SUCCESSFUL")
    print("=" * 65)
    print(f"Artifact Saved To : {results['output_path']}")
    print(f"Test Accuracy     : {results['metrics']['accuracy'] * 100:.2f}%")
    print(f"Macro F1-Score    : {results['metrics']['f1_macro']:.4f}")
    print("\nTop Contributing Features:")
    sorted_feats = sorted(results["metrics"]["feature_importances"].items(), key=lambda x: x[1], reverse=True)
    for name, imp in sorted_feats[:5]:
        print(f"  - {name:<26}: {imp * 100:.1f}%")
    print("=" * 65)
