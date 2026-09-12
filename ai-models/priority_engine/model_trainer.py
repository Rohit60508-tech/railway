"""
model_trainer.py
─────────────────────────────────────────────────────────────────────────────
ModelTrainer: Trains the defect priority machine learning model using historical
defect data extracted from PostgreSQL (or synthetic generation fallback).
Evaluates classification and ranking metrics, then persists the trained model
pipeline using joblib.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import argparse
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score
from sklearn.model_selection import train_test_split

try:
    from shared.logger import get_logger
    from shared.database_connector import db_pool
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.database_connector import db_pool

from defect_prioritizer import DefectPrioritizer

logger = get_logger("model_trainer")


class ModelTrainer:
    """
    Orchestrates data extraction, feature matrix construction, model fitting,
    evaluation, and artifact persistence for the defect priority engine.
    """

    def __init__(self, config_path: Optional[str] = None):
        self.prioritizer = DefectPrioritizer(config_path)
        self.config = self.prioritizer.config
        self.model_type = self.config.get("model_type", "RandomForestClassifier")
        self.n_estimators = int(self.config.get("n_estimators", 120))
        self.max_depth = int(self.config.get("max_depth", 6))
        self.training_params = self.config.get("training_parameters", {})
        self.artifact_path = Path(__file__).resolve().parent / self.config.get(
            "artifact_path", "artifacts/defect_priority_model.joblib"
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Data Ingestion
    # ─────────────────────────────────────────────────────────────────────────
    def load_data_from_db(self, limit: int = 10000) -> List[Dict[str, Any]]:
        """
        Attempts to load historical defect records from PostgreSQL.
        Falls back to generating synthetic training data if DB is unavailable.
        """
        query = """
            SELECT 
                defect_id, section_id, asset_id, asset_type, department,
                severity, source, detected_at, sla_deadline, status,
                track_quality_index, speed_restriction_kmh, trains_per_day
            FROM defects
            ORDER BY detected_at DESC
            LIMIT %s;
        """
        try:
            records = db_pool.execute_query(query, (limit,))
            if records and len(records) >= 50:
                logger.info(f"Retrieved {len(records)} historical defect records from database.")
                return records
            logger.info("Database returned insufficient records. Falling back to synthetic generator.")
        except Exception as err:
            logger.warning(f"Database query failed ({err}). Using synthetic historical data.")

        return self.generate_synthetic_historical_data(num_samples=min(limit, 3000))

    def generate_synthetic_historical_data(self, num_samples: int = 2500) -> List[Dict[str, Any]]:
        """
        Synthesizes realistic Indian Railways defect records conforming to RDSO norms.
        """
        logger.info(f"Generating {num_samples} realistic synthetic defect records...")
        departments = ["CIVIL", "TRD_OHE", "SIGNALLING", "ROLLING_STOCK"]
        sources = ["USFD", "TRC", "OMS", "ITMS", "PATROL", "DRONE", "MANUAL"]
        severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        asset_types = [
            "RAIL_THERMIT_WELD", "SWITCH_TONGUE_RAIL", "CMS_CROSSING",
            "OHE_CATENARY_WIRE", "POINT_MACHINE", "TRACK_CIRCUIT", "CONCRETE_SLEEPER"
        ]
        sections = [
            ("NDLS-CNB-UP", 130, 110, 2),
            ("CNB-DDU-DN", 130, 120, 2),
            ("BCT-BRC-UP", 140, 130, 4),
            ("MAS-GDR-DN", 110, 75, 2),
            ("HWH-KGP-UP", 110, 95, 3),
            ("KYN-PUNE-GHAT", 80, 50, 1),
        ]

        now = datetime.now(timezone.utc)
        synthetic_records: List[Dict[str, Any]] = []

        for i in range(num_samples):
            sec_name, max_speed, base_trains, tracks = random.choice(sections)
            dept = random.choice(departments)
            source = random.choice(sources)
            asset = random.choice(asset_types)
            # Target diverse priority tiers including overdue and acute defects
            target_tier = random.choices(["P1", "P2", "P3", "P4"], weights=[0.25, 0.30, 0.25, 0.20])[0]

            if target_tier == "P1":
                severity = "CRITICAL"
                source = random.choice(["USFD", "TRC"])
                days_ago = random.uniform(5.0, 30.0)
                sla_days = 1.0
                tqi = random.uniform(25.0, 45.0)
                speed_rest = 30
                tracks = 1
                base_trains = 120
            elif target_tier == "P2":
                severity = "HIGH"
                source = random.choice(["USFD", "TRC", "OMS"])
                days_ago = random.uniform(3.0, 15.0)
                sla_days = 3.0
                tqi = random.uniform(40.0, 60.0)
                speed_rest = 45 if random.random() < 0.5 else None
            elif target_tier == "P3":
                severity = "MEDIUM"
                source = random.choice(["PATROL", "ITMS", "MANUAL"])
                days_ago = random.uniform(1.0, 10.0)
                sla_days = 7.0
                tqi = random.uniform(55.0, 75.0)
                speed_rest = None
            else: # P4
                severity = "LOW"
                source = random.choice(["MANUAL", "PATROL", "DRONE"])
                days_ago = random.uniform(0.1, 3.0)
                sla_days = 30.0
                tqi = random.uniform(70.0, 95.0)
                speed_rest = None
                tracks = 4
                base_trains = 40

            detected_at = now - timedelta(days=days_ago)
            sla_deadline = detected_at + timedelta(days=sla_days)

            record = {
                "defect_id": f"HIST-DEF-{100000 + i}",
                "section_id": sec_name,
                "asset_id": f"AST-{random.randint(1000, 9999)}",
                "asset_type": asset,
                "department": dept,
                "severity": severity,
                "source": source,
                "detected_at": detected_at.isoformat(),
                "sla_deadline": sla_deadline.isoformat(),
                "trains_per_day": base_trains + random.randint(-10, 10),
                "track_count": tracks,
                "track_quality_index": tqi,
                "speed_restriction_kmh": speed_rest,
                "is_ghat_section": (tracks == 1 and "GHAT" in sec_name),
            }
            synthetic_records.append(record)

        return synthetic_records

    # ─────────────────────────────────────────────────────────────────────────
    # Feature & Target Engineering
    # ─────────────────────────────────────────────────────────────────────────
    def build_dataset(self, raw_defects: List[Dict[str, Any]]) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Converts raw defect dicts into feature matrix X and classification target y.
        Target classes:
        - 0: P4 (Routine)
        - 1: P3 (Medium)
        - 2: P2 (High)
        - 3: P1 (Critical)
        """
        feature_rows: List[Dict[str, float]] = []
        target_labels: List[int] = []

        category_map = {"P4": 0, "P3": 1, "P2": 2, "P1": 3}

        for defect in raw_defects:
            feats = self.prioritizer.extract_features(defect)
            score = self.prioritizer.calculate_priority_score(feats)
            cat, _ = self.prioritizer.categorize_priority(score)

            # Inject slight realistic label noise to prevent over-fitting
            label_idx = category_map[cat]
            if random.random() < 0.04:
                label_idx = max(0, min(3, label_idx + random.choice([-1, 1])))

            feature_rows.append(feats)
            target_labels.append(label_idx)

        X = pd.DataFrame(feature_rows)
        y = pd.Series(target_labels, name="priority_tier")
        return X, y

    # ─────────────────────────────────────────────────────────────────────────
    # Model Training & Evaluation
    # ─────────────────────────────────────────────────────────────────────────
    def train(self, num_samples: int = 2500) -> Dict[str, Any]:
        """
        Executes full training pipeline, logs performance metrics, and saves model artifact.
        """
        logger.info("Beginning model training pipeline...")
        raw_defects = self.load_data_from_db(limit=num_samples)
        X, y = self.build_dataset(raw_defects)

        test_size = float(self.training_params.get("test_size", 0.2))
        rand_state = int(self.training_params.get("random_state", 42))
        min_class_count = int(y.value_counts().min()) if len(y) > 0 else 0
        stratify_arg = y if min_class_count >= 2 else None

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=rand_state, stratify=stratify_arg
        )

        logger.info(f"Training set: {len(X_train)} samples, Test set: {len(X_test)} samples.")

        # Initialize Estimator
        if "Gradient" in self.model_type:
            model = GradientBoostingClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                random_state=rand_state,
                learning_rate=float(self.training_params.get("learning_rate", 0.08)),
            )
        else:
            model = RandomForestClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                random_state=rand_state,
                min_samples_split=int(self.training_params.get("min_samples_split", 4)),
                n_jobs=-1,
            )

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

        # Compute Feature Importances
        importances = {}
        if hasattr(model, "feature_importances_"):
            for feat, imp in zip(X.columns, model.feature_importances_):
                importances[feat] = round(float(imp), 4)

        metadata = {
            "model_type": type(model).__name__,
            "accuracy": round(float(acc), 4),
            "f1_macro": round(float(f1_macro), 4),
            "samples_trained": len(X_train),
            "samples_tested": len(X_test),
            "feature_importances": importances,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }

        # Persist model
        self.prioritizer.model = model
        self.prioritizer.model_metadata = metadata
        saved_file = self.prioritizer.save_model(self.artifact_path, metadata=metadata)

        return {
            "artifact_path": saved_file,
            "metrics": metadata,
            "classification_report": report,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Indian Railways Defect Priority ML Model")
    parser.add_argument("--samples", type=int, default=2500, help="Number of training samples")
    args = parser.parse_args()

    trainer = ModelTrainer()
    results = trainer.train(num_samples=args.samples)
    print("\n" + "=" * 60)
    print("TRAINING SUCCESSFUL")
    print(f"Artifact: {results['artifact_path']}")
    print(f"Accuracy: {results['metrics']['accuracy'] * 100:.2f}%")
    print("Top Feature Importances:")
    for feat, imp in sorted(results["metrics"]["feature_importances"].items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  • {feat:<26}: {imp:.4f}")
    print("=" * 60)
