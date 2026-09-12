"""
custom_data_trainer.py
─────────────────────────────────────────────────────────────────────────────
Adaptive Custom Data Trainer for User-Defined Railway Schemas
Trains ML models on arbitrary user-provided columns, features, and target labels.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import time
import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, f1_score, mean_absolute_error, r2_score

# Paths
TRAINING_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = TRAINING_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger

logger = get_logger("custom_data_trainer")

DEFAULT_SCHEMA_PATH = TRAINING_DIR / "custom_training_schema.json"
CUSTOM_ARTIFACTS_DIR = AI_MODELS_DIR / "agents" / "artifacts"
CUSTOM_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
CUSTOM_MODEL_JOB_PATH = CUSTOM_ARTIFACTS_DIR / "custom_user_trained_model.joblib"


def load_custom_schema() -> Dict[str, Any]:
    """Loads active user custom dataset schema definition."""
    if DEFAULT_SCHEMA_PATH.exists():
        with open(DEFAULT_SCHEMA_PATH, "r") as f:
            return json.load(f)
    return {
        "dataset_name": "Custom Dataset",
        "target_column": "target",
        "columns": []
    }


def save_custom_schema(schema_data: Dict[str, Any]) -> None:
    """Saves updated user custom dataset schema definition."""
    with open(DEFAULT_SCHEMA_PATH, "w") as f:
        json.dump(schema_data, f, indent=2)


class AdaptiveCustomTrainer:
    """
    Parses arbitrary user-defined tabular data (CSV or JSON), builds dynamic
    feature pipelines matching the user's custom schema, and trains models.
    """

    def __init__(self, target_column: Optional[str] = None):
        self.target_column = target_column
        self.feature_columns: List[str] = []
        self.model: Any = None
        self.is_classification: bool = True
        self.feature_importances: List[Dict[str, Any]] = []

    def parse_input_data(self, data_input: Union[str, List[Dict[str, Any]], pd.DataFrame]) -> pd.DataFrame:
        """Converts raw CSV text, JSON list, or DataFrame into a cleaned DataFrame."""
        if isinstance(data_input, pd.DataFrame):
            df = data_input.copy()
        elif isinstance(data_input, str):
            text = data_input.strip()
            if text.startswith("[") or text.startswith("{"):
                # Parse JSON string
                parsed = json.loads(text)
                if isinstance(parsed, dict) and "records" in parsed:
                    df = pd.DataFrame(parsed["records"])
                elif isinstance(parsed, list):
                    df = pd.DataFrame(parsed)
                else:
                    df = pd.DataFrame([parsed])
            else:
                # Parse CSV text
                df = pd.read_csv(io.StringIO(text))
        elif isinstance(data_input, list):
            df = pd.DataFrame(data_input)
        else:
            raise ValueError(f"Unsupported data input format: {type(data_input)}")

        if df.empty:
            raise ValueError("Input dataset contains zero records.")

        return df

    def train(
        self,
        data_input: Union[str, List[Dict[str, Any]], pd.DataFrame],
        target_column: Optional[str] = None,
        model_algorithm: str = "RandomForest",
        test_size: float = 0.2,
        augment_if_small: bool = True
    ) -> Dict[str, Any]:
        """
        Main entrypoint: ingests arbitrary user columns, transforms features,
        fits model, evaluates holdout split, and serializes artifact.
        """
        t0 = time.perf_counter()
        df = self.parse_input_data(data_input)
        
        # Determine target column
        if target_column:
            self.target_column = target_column
        elif not self.target_column:
            # Fallback to schema target column or last column
            schema = load_custom_schema()
            self.target_column = schema.get("target_column", df.columns[-1])

        if self.target_column not in df.columns:
            # If target column missing, pick the last column as target
            self.target_column = df.columns[-1]

        logger.info(f"Target column designated: '{self.target_column}'")

        # Augment dataset if user provided small sample (< 40 rows) so ML algorithms can fit properly
        orig_count = len(df)
        if len(df) < 40 and augment_if_small:
            logger.info(f"Input records ({len(df)}) small. Bootstrapping realistic variations...")
            dfs = [df]
            for _ in range(int(np.ceil(50 / len(df)))):
                jittered = df.copy()
                for col in jittered.select_dtypes(include=[np.number]).columns:
                    noise = np.random.normal(0, 0.05 * (jittered[col].std() or 1.0), len(jittered))
                    jittered[col] = (jittered[col] + noise).round(3)
                dfs.append(jittered)
            df = pd.concat(dfs, ignore_index=True)

        # Separate Features X and Target y
        y_raw = df[self.target_column]
        X_raw = df.drop(columns=[self.target_column])

        # Identify problem type (Classification vs Regression)
        unique_targets = y_raw.nunique()
        is_numeric = pd.api.types.is_numeric_dtype(y_raw)

        if not is_numeric or unique_targets <= 10:
            self.is_classification = True
            task_type = "classification"
            y = y_raw.astype(str)
        else:
            self.is_classification = False
            task_type = "regression"
            y = y_raw.astype(float)

        # Encode Features
        # Impute numeric columns with median, categorical columns with mode / 'UNKNOWN'
        X_encoded = pd.DataFrame(index=X_raw.index)
        user_columns_summary = []

        for col in X_raw.columns:
            series = X_raw[col]
            if pd.api.types.is_numeric_dtype(series):
                median_val = series.median() if not np.isnan(series.median()) else 0.0
                X_encoded[col] = series.fillna(median_val)
                user_columns_summary.append({"column": col, "type": "numeric", "samples": len(series)})
            else:
                # Categorical column: One-Hot encode
                fill_val = series.mode()[0] if not series.empty and not pd.isna(series.mode()[0]) else "UNKNOWN"
                cleaned = series.fillna(fill_val).astype(str)
                dummies = pd.get_dummies(cleaned, prefix=col, drop_first=False)
                X_encoded = pd.concat([X_encoded, dummies], axis=1)
                user_columns_summary.append({"column": col, "type": "categorical", "categories": int(cleaned.nunique())})

        self.feature_columns = list(X_encoded.columns)

        # Train / Test split
        X_train, X_test, y_train, y_test = train_test_split(
            X_encoded, y, test_size=test_size, random_state=42
        )

        # Instantiate Model
        if self.is_classification:
            if "Gradient" in model_algorithm:
                self.model = GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42)
            else:
                self.model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        else:
            if "Gradient" in model_algorithm:
                self.model = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
            else:
                self.model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)

        # Fit Model
        self.model.fit(X_train, y_train)

        # Evaluate Performance
        y_pred = self.model.predict(X_test)
        metrics: Dict[str, Any] = {}

        if self.is_classification:
            acc = round(float(accuracy_score(y_test, y_pred)) * 100.0, 2)
            f1 = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 3)
            metrics = {
                "accuracy": f"{acc}%",
                "macro_f1": f1,
                "classes_learned": [str(c) for c in self.model.classes_]
            }
        else:
            mae = round(float(mean_absolute_error(y_test, y_pred)), 3)
            r2 = round(float(r2_score(y_test, y_pred)), 3)
            metrics = {
                "mae": mae,
                "r2_score": r2
            }

        # Calculate Feature Importances
        importances = getattr(self.model, "feature_importances_", None)
        feature_importance_list = []
        if importances is not None:
            indices = np.argsort(importances)[::-1][:10]
            for idx in indices:
                feat_name = self.feature_columns[idx]
                feat_weight = round(float(importances[idx]), 4)
                feature_importance_list.append({
                    "feature": feat_name,
                    "importance_weight": feat_weight,
                    "impact_percentage": f"{round(feat_weight * 100, 1)}%"
                })
        self.feature_importances = feature_importance_list

        # Serialize Model Package
        model_artifact = {
            "model": self.model,
            "target_column": self.target_column,
            "is_classification": self.is_classification,
            "feature_columns": self.feature_columns,
            "user_columns_summary": user_columns_summary,
            "metrics": metrics,
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_records": len(df)
        }
        joblib.dump(model_artifact, CUSTOM_MODEL_JOB_PATH)

        duration_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            "status": "SUCCESS",
            "message": f"Successfully trained custom {model_algorithm} model on your data structure.",
            "target_column": self.target_column,
            "task_type": task_type,
            "algorithm_used": f"{model_algorithm} ({'Classifier' if self.is_classification else 'Regressor'})",
            "original_records_entered": orig_count,
            "total_samples_trained": len(df),
            "custom_columns_detected": user_columns_summary,
            "features_engineered_count": len(self.feature_columns),
            "performance_metrics": metrics,
            "top_feature_importance": feature_importance_list,
            "artifact_saved_to": str(CUSTOM_MODEL_JOB_PATH),
            "training_time_ms": duration_ms
        }


# Global instance
custom_trainer = AdaptiveCustomTrainer()


if __name__ == "__main__":
    # Test on default custom schema sample records
    schema = load_custom_schema()
    samples = schema.get("sample_records", [])
    trainer = AdaptiveCustomTrainer()
    res = trainer.train(samples, target_column=schema.get("target_column"))
    print("\nCustom Data Training Smoke Test:")
    print(json.dumps(res, indent=2))
