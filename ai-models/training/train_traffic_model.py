"""
train_traffic_model.py
─────────────────────────────────────────────────────────────────────────────
Training pipeline for Indian Railways Train Traffic & Delay Prediction Model.
Loads historical train movement timetables, engineers temporal and density
features, fits a GradientBoosting / RandomForest Regressor to forecast delay
minutes, evaluates MAE and RMSE, and saves models to /ai-models/traffic-predictor/models/.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Resolve paths
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from prepare_training_data import DataPreparationPipeline

logger = get_logger("train_traffic_model")

DEFAULT_MODEL_DIR = AI_MODELS_DIR / "traffic-predictor" / "models"
DEFAULT_OUTPUT_PKL = DEFAULT_MODEL_DIR / "traffic_model.pkl"
DEFAULT_ARTIFACT_PATH = AI_MODELS_DIR / "traffic-predictor" / "artifacts" / "traffic_forecaster.joblib"


def train_traffic_model(
    model_type: str = "GradientBoosting",
    n_estimators: int = 150,
    max_depth: int = 5,
    samples: int = 3000,
    output_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Executes training, evaluation, and serialization for the train traffic delay model.
    """
    out_file = Path(output_path) if output_path else DEFAULT_OUTPUT_PKL
    out_file.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading and preparing train traffic dataset (limit: {samples})...")
    pipeline = DataPreparationPipeline()
    X_train, X_test, y_train, y_test, feature_names = pipeline.prepare_traffic_dataset(limit=samples)

    logger.info(f"Instantiating {model_type}Regressor (n_estimators={n_estimators}, max_depth={max_depth})...")
    if "RandomForest" in model_type:
        model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            n_jobs=-1,
        )
    else:
        model = GradientBoostingRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=42,
            learning_rate=0.06,
        )

    logger.info("Fitting delay prediction regressor on train set...")
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)

    logger.info(f"Traffic Model Training Complete! MAE: {mae:.2f} mins, RMSE: {rmse:.2f} mins, R2: {r2:.4f}")

    # Feature Importances
    importances: Dict[str, float] = {}
    if hasattr(model, "feature_importances_"):
        for feat, imp in zip(feature_names, model.feature_importances_):
            importances[feat] = round(float(imp), 4)

    metadata = {
        "model_type": type(model).__name__,
        "mae_minutes": round(float(mae), 2),
        "rmse_minutes": round(float(rmse), 2),
        "r2_score": round(float(r2), 4),
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

    joblib.dump(payload, out_file)
    logger.info(f"Saved primary traffic model artifact to: {out_file}")

    joblib.dump(payload, DEFAULT_ARTIFACT_PATH)
    logger.info(f"Synchronized artifact to: {DEFAULT_ARTIFACT_PATH}")

    return {
        "model": model,
        "output_path": str(out_file),
        "metrics": metadata,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Indian Railways Traffic Delay Prediction Model")
    parser.add_argument("--model-type", type=str, default="GradientBoosting", choices=["GradientBoosting", "RandomForest"])
    parser.add_argument("--n-estimators", type=int, default=150)
    parser.add_argument("--max-depth", type=int, default=5)
    parser.add_argument("--samples", type=int, default=3000)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    results = train_traffic_model(
        model_type=args.model_type,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        samples=args.samples,
        output_path=Path(args.output) if args.output else None,
    )

    print("\n" + "=" * 65)
    print(" [OK] TRAFFIC DELAY PREDICTION MODEL TRAINING SUCCESSFUL")
    print("=" * 65)
    print(f"Artifact Saved To : {results['output_path']}")
    print(f"Mean Absolute Err : {results['metrics']['mae_minutes']} minutes")
    print(f"Root Mean Sq Err  : {results['metrics']['rmse_minutes']} minutes")
    print(f"R-Squared Score   : {results['metrics']['r2_score']}")
    print("\nKey Influencing Factors:")
    sorted_feats = sorted(results["metrics"]["feature_importances"].items(), key=lambda x: x[1], reverse=True)
    for name, imp in sorted_feats[:5]:
        print(f"  - {name:<26}: {imp * 100:.1f}%")
    print("=" * 65)
