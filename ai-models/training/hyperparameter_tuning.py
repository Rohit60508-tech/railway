"""
hyperparameter_tuning.py
─────────────────────────────────────────────────────────────────────────────
Hyperparameter optimization engine using GridSearchCV and RandomizedSearchCV.
Tunes tree ensembles for:
  1. Defect Priority Classifier (RandomForest / GradientBoosting)
  2. Traffic Delay Regressor (GradientBoosting / RandomForest)
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV

# Resolve paths
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from prepare_training_data import DataPreparationPipeline

logger = get_logger("hyperparameter_tuning")


def tune_priority_model(
    search_type: str = "random",
    n_iter: int = 15,
    cv: int = 4,
    samples: int = 2000,
    save_best: bool = True,
) -> Dict[str, Any]:
    """
    Executes hyperparameter search for Defect Priority Classifier.
    """
    logger.info(f"Preparing dataset for Priority hyperparameter tuning (samples: {samples})...")
    pipeline = DataPreparationPipeline()
    X_train, X_test, y_train, y_test, feature_names = pipeline.prepare_defect_dataset(limit=samples)

    param_distributions = {
        "n_estimators": [80, 120, 160, 200],
        "max_depth": [4, 6, 8, 10, None],
        "min_samples_split": [2, 4, 6],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", "log2", None],
    }

    base_model = RandomForestClassifier(random_state=42, n_jobs=-1)

    if search_type.lower() == "grid":
        # Narrow grid for exhaustive search to prevent excessive compute time
        grid_params = {
            "n_estimators": [100, 150],
            "max_depth": [5, 8, None],
            "min_samples_split": [2, 4],
            "min_samples_leaf": [1, 2],
        }
        search = GridSearchCV(
            estimator=base_model,
            param_grid=grid_params,
            cv=cv,
            scoring="f1_macro",
            n_jobs=-1,
            verbose=1,
        )
    else:
        search = RandomizedSearchCV(
            estimator=base_model,
            param_distributions=param_distributions,
            n_iter=n_iter,
            cv=cv,
            scoring="f1_macro",
            random_state=42,
            n_jobs=-1,
            verbose=1,
        )

    logger.info(f"Initiating {search_type.upper()} search across parameter space...")
    search.fit(X_train, y_train)

    best_estimator = search.best_estimator_
    test_score = best_estimator.score(X_test, y_test)

    logger.info(f"Priority Tuning Complete! Best CV F1-Macro: {search.best_score_:.4f}, Test Acc: {test_score * 100:.2f}%")
    logger.info(f"Optimal Parameters: {search.best_params_}")

    save_path = None
    if save_best:
        out_path = AI_MODELS_DIR / "priority-engine" / "models" / "priority_model_tuned.pkl"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "model": best_estimator,
            "feature_keys": feature_names,
            "best_params": search.best_params_,
            "cv_score": round(float(search.best_score_), 4),
            "tuned_at": datetime.now(timezone.utc).isoformat(),
        }
        joblib.dump(payload, out_path)
        save_path = str(out_path)
        logger.info(f"Saved tuned priority model artifact to: {out_path}")

    return {
        "model_type": "Priority_RandomForest",
        "best_params": search.best_params_,
        "best_cv_score": round(float(search.best_score_), 4),
        "test_accuracy": round(float(test_score), 4),
        "saved_path": save_path,
    }


def tune_traffic_model(
    search_type: str = "random",
    n_iter: int = 15,
    cv: int = 4,
    samples: int = 2000,
    save_best: bool = True,
) -> Dict[str, Any]:
    """
    Executes hyperparameter search for Train Traffic Delay Regressor.
    """
    logger.info(f"Preparing dataset for Traffic hyperparameter tuning (samples: {samples})...")
    pipeline = DataPreparationPipeline()
    X_train, X_test, y_train, y_test, feature_names = pipeline.prepare_traffic_dataset(limit=samples)

    param_distributions = {
        "n_estimators": [100, 150, 200, 250],
        "max_depth": [3, 4, 5, 7],
        "learning_rate": [0.03, 0.05, 0.08, 0.12],
        "subsample": [0.75, 0.85, 1.0],
        "min_samples_split": [2, 4, 6],
    }

    base_model = GradientBoostingRegressor(random_state=42)

    if search_type.lower() == "grid":
        grid_params = {
            "n_estimators": [100, 150],
            "max_depth": [3, 5],
            "learning_rate": [0.05, 0.1],
        }
        search = GridSearchCV(
            estimator=base_model,
            param_grid=grid_params,
            cv=cv,
            scoring="neg_mean_absolute_error",
            n_jobs=-1,
            verbose=1,
        )
    else:
        search = RandomizedSearchCV(
            estimator=base_model,
            param_distributions=param_distributions,
            n_iter=n_iter,
            cv=cv,
            scoring="neg_mean_absolute_error",
            random_state=42,
            n_jobs=-1,
            verbose=1,
        )

    logger.info(f"Initiating {search_type.upper()} search across delay regressor parameters...")
    search.fit(X_train, y_train)

    best_estimator = search.best_estimator_
    test_r2 = best_estimator.score(X_test, y_test)
    best_mae = -search.best_score_

    logger.info(f"Traffic Tuning Complete! Best CV MAE: {best_mae:.2f} mins, Test R2: {test_r2:.4f}")
    logger.info(f"Optimal Parameters: {search.best_params_}")

    save_path = None
    if save_best:
        out_path = AI_MODELS_DIR / "traffic-predictor" / "models" / "traffic_model_tuned.pkl"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "model": best_estimator,
            "feature_keys": feature_names,
            "best_params": search.best_params_,
            "best_mae_minutes": round(float(best_mae), 2),
            "tuned_at": datetime.now(timezone.utc).isoformat(),
        }
        joblib.dump(payload, out_path)
        save_path = str(out_path)
        logger.info(f"Saved tuned traffic model artifact to: {out_path}")

    return {
        "model_type": "Traffic_GradientBoosting",
        "best_params": search.best_params_,
        "best_cv_mae_minutes": round(float(best_mae), 2),
        "test_r2_score": round(float(test_r2), 4),
        "saved_path": save_path,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hyperparameter Optimization for Indian Railways AI")
    parser.add_argument("--model", type=str, default="priority", choices=["priority", "traffic"])
    parser.add_argument("--search-type", type=str, default="random", choices=["random", "grid"])
    parser.add_argument("--n-iter", type=int, default=12)
    parser.add_argument("--cv", type=int, default=3)
    parser.add_argument("--samples", type=int, default=1500)
    parser.add_argument("--no-save", action="store_true")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print(f" [TUNING] HYPERPARAMETER OPTIMIZATION: {args.model.upper()}")
    print("=" * 65)

    if args.model == "priority":
        res = tune_priority_model(
            search_type=args.search_type,
            n_iter=args.n_iter,
            cv=args.cv,
            samples=args.samples,
            save_best=not args.no_save,
        )
        print(f"\nBest Cross-Validation F1-Macro : {res['best_cv_score']:.4f}")
        print(f"Test Accuracy                  : {res['test_accuracy'] * 100:.2f}%")
        print("\nOptimal Hyperparameters:")
        for k, v in res["best_params"].items():
            print(f"  - {k:<20}: {v}")
    else:
        res = tune_traffic_model(
            search_type=args.search_type,
            n_iter=args.n_iter,
            cv=args.cv,
            samples=args.samples,
            save_best=not args.no_save,
        )
        print(f"\nBest Cross-Validation MAE      : {res['best_cv_mae_minutes']} minutes")
        print(f"Test R-Squared Score           : {res['test_r2_score']:.4f}")
        print("\nOptimal Hyperparameters:")
        for k, v in res["best_params"].items():
            print(f"  - {k:<20}: {v}")

    if res.get("saved_path"):
        print(f"\nTuned Artifact Persisted At    : {res['saved_path']}")
    print("=" * 65)
