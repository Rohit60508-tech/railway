"""
prepare_training_data.py
─────────────────────────────────────────────────────────────────────────────
Data preparation and feature engineering pipeline for Indian Railways AI models.
Handles missing value imputation, categorical encoding, temporal feature
extraction, synthetic data generation for offline environments, and train/test splits.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# Resolve shared directory
SHARED_DIR = Path(__file__).resolve().parent.parent / "shared"
if str(SHARED_DIR.parent) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR.parent))

from shared.logger import get_logger
from shared.database_connector import DatabaseConnector
from shared.utils import coerce_iso_date, save_dataframe_to_csv

logger = get_logger("prepare_training_data")


class DataPreparationPipeline:
    """
    Extracts, cleans, encodes, and splits historical defect and traffic datasets
    for machine learning model training.
    """

    def __init__(self, db_connector: Optional[DatabaseConnector] = None):
        self.db = db_connector or DatabaseConnector()

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Defect Dataset Preparation
    # ─────────────────────────────────────────────────────────────────────────
    def load_raw_defects(self, limit: int = 5000) -> pd.DataFrame:
        """
        Loads historical defect records from PostgreSQL, or generates synthetic data if offline.
        """
        query = """
            SELECT 
                defect_id, section_id, asset_id, asset_type, department,
                severity, source, detected_at, sla_deadline, status,
                track_quality_index, speed_restriction_kmh, trains_per_day,
                track_count, location_criticality
            FROM defects
            ORDER BY detected_at DESC
            LIMIT %s;
        """
        df = self.db.execute_query(query, (limit,))
        if not df.empty and len(df) >= 50:
            logger.info(f"Loaded {len(df)} defect records from database.")
            return df

        logger.info("Database returned insufficient records. Generating realistic synthetic defect dataset...")
        return self._generate_synthetic_defects(limit)

    def _generate_synthetic_defects(self, count: int = 3000) -> pd.DataFrame:
        """Synthesizes realistic defect records across P1-P4 priority tiers."""
        departments = ["CIVIL", "TRD_OHE", "SIGNALLING", "ROLLING_STOCK"]
        sources = ["USFD", "TRC", "OMS", "ITMS", "PATROL", "DRONE", "MANUAL"]
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
        rows: List[Dict[str, Any]] = []

        for i in range(count):
            sec_name, max_speed, base_trains, tracks = random.choice(sections)
            dept = random.choice(departments)
            source = random.choice(sources)
            asset = random.choice(asset_types)
            target_tier = random.choices(["P1", "P2", "P3", "P4"], weights=[0.25, 0.30, 0.25, 0.20])[0]

            if target_tier == "P1":
                severity = "CRITICAL"
                source = random.choice(["USFD", "TRC"])
                days_ago = random.uniform(4.0, 25.0)
                sla_days = 1.0
                tqi = random.uniform(25.0, 45.0)
                speed_rest = 30
                tracks = 1
                base_trains = 120
            elif target_tier == "P2":
                severity = "HIGH"
                source = random.choice(["USFD", "TRC", "OMS"])
                days_ago = random.uniform(2.0, 12.0)
                sla_days = 3.0
                tqi = random.uniform(40.0, 60.0)
                speed_rest = 45 if random.random() < 0.5 else None
            elif target_tier == "P3":
                severity = "MEDIUM"
                source = random.choice(["PATROL", "ITMS", "MANUAL"])
                days_ago = random.uniform(1.0, 8.0)
                sla_days = 7.0
                tqi = random.uniform(55.0, 75.0)
                speed_rest = None
            else:  # P4
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

            # Introduce realistic missing values for testing imputation
            if random.random() < 0.05:
                tqi = np.nan
            if random.random() < 0.03:
                base_trains = np.nan

            rows.append({
                "defect_id": f"HIST-DEF-{100000 + i}",
                "section_id": sec_name,
                "asset_id": f"AST-{random.randint(1000, 9999)}",
                "asset_type": asset,
                "department": dept,
                "severity": severity,
                "source": source,
                "detected_at": detected_at.isoformat(),
                "sla_deadline": sla_deadline.isoformat(),
                "trains_per_day": base_trains + random.randint(-10, 10) if not np.isnan(base_trains) else np.nan,
                "track_count": tracks,
                "track_quality_index": tqi,
                "speed_restriction_kmh": speed_rest,
                "location_criticality": 80.0 if tracks == 1 else 50.0,
                "target_tier": target_tier,
            })

        return pd.DataFrame(rows)

    def clean_defect_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Imputes missing values and removes invalid entries.
        """
        cleaned = df.copy()

        # Impute numerical features
        if "track_quality_index" in cleaned.columns:
            median_tqi = cleaned["track_quality_index"].median()
            cleaned["track_quality_index"] = cleaned["track_quality_index"].fillna(median_tqi if not np.isnan(median_tqi) else 65.0)

        if "trains_per_day" in cleaned.columns:
            median_trains = cleaned["trains_per_day"].median()
            cleaned["trains_per_day"] = cleaned["trains_per_day"].fillna(median_trains if not np.isnan(median_trains) else 60.0)

        if "track_count" in cleaned.columns:
            cleaned["track_count"] = cleaned["track_count"].fillna(2).astype(int)

        if "location_criticality" in cleaned.columns:
            cleaned["location_criticality"] = cleaned["location_criticality"].fillna(50.0)

        # Impute categorical features with mode
        for col in ["department", "severity", "source", "asset_type"]:
            if col in cleaned.columns:
                mode_val = cleaned[col].mode()[0] if not cleaned[col].dropna().empty else "UNKNOWN"
                cleaned[col] = cleaned[col].fillna(mode_val)

        return cleaned

    def encode_defect_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Calculates normalized domain feature columns and target priority category indices.
        Target mapping: 0=P4, 1=P3, 2=P2, 3=P1.
        """
        now = datetime.now(timezone.utc)
        features: List[Dict[str, float]] = []
        targets: List[int] = []

        tier_map = {"P4": 0, "P3": 1, "P2": 2, "P1": 3}
        sev_weights = {"CRITICAL": 100.0, "HIGH": 75.0, "MEDIUM": 45.0, "LOW": 20.0}
        source_weights = {"USFD": 100.0, "TRC": 92.0, "OMS": 85.0, "ITMS": 88.0, "PATROL": 80.0, "DRONE": 70.0, "MANUAL": 65.0}
        dept_weights = {"CIVIL": 95.0, "TRD_OHE": 90.0, "SIGNALLING": 88.0, "ROLLING_STOCK": 80.0}

        for _, row in df.iterrows():
            # 1. Safety severity
            sev = str(row.get("severity", "MEDIUM")).upper()
            f_sev = sev_weights.get(sev, 50.0)

            # 2. Traffic density (0 to 100)
            f_traf = min(100.0, (float(row.get("trains_per_day", 60.0)) / 120.0) * 100.0)

            # 3. Overdue days (0 to 100)
            sla_dt = coerce_iso_date(row.get("sla_deadline"))
            f_overdue = 0.0
            if sla_dt:
                delta_sec = (now - sla_dt).total_seconds()
                if delta_sec > 0:
                    f_overdue = min(100.0, (delta_sec / (86400.0 * 14.0)) * 100.0)

            # 4. Failure probability from TQI
            tqi = float(row.get("track_quality_index", 65.0))
            f_fail = max(10.0, min(95.0, (80.0 - tqi) * 1.5))

            # 5. Asset criticality
            asset = str(row.get("asset_type", "")).upper()
            if any(term in asset for term in ["SWITCH", "CROSSING", "POINT", "TURNOUT"]):
                f_asset = 95.0
            elif any(term in asset for term in ["BRIDGE", "GIRDER", "TUNNEL"]):
                f_asset = 90.0
            elif any(term in asset for term in ["RAIL", "WELD", "OHE_CATENARY"]):
                f_asset = 80.0
            else:
                f_asset = 60.0

            # 6. Redundancy factor
            tracks = int(row.get("track_count", 2))
            f_red = 100.0 if tracks == 1 else (60.0 if tracks == 2 else 25.0)

            # 7. Defect age
            det_dt = coerce_iso_date(row.get("detected_at"))
            f_age = 10.0
            if det_dt:
                age_days = max(0.0, (now - det_dt).total_seconds() / 86400.0)
                f_age = min(100.0, (age_days / 30.0) * 100.0)

            # 8. Inspection source weight
            src = str(row.get("source", "MANUAL")).upper()
            f_src = source_weights.get(src, 65.0)

            # 9. Department weight
            dept = str(row.get("department", "CIVIL")).upper()
            f_dept = dept_weights.get(dept, 75.0)

            # 10. Location criticality
            f_loc = float(row.get("location_criticality", 50.0))

            features.append({
                "safety_severity": round(f_sev, 2),
                "traffic_density": round(f_traf, 2),
                "overdue_days": round(f_overdue, 2),
                "failure_probability": round(f_fail, 2),
                "asset_criticality": round(f_asset, 2),
                "redundancy_factor": round(f_red, 2),
                "defect_age": round(f_age, 2),
                "inspection_source_weight": round(f_src, 2),
                "department_weight": round(f_dept, 2),
                "location_criticality": round(f_loc, 2),
            })

            # Determine target label
            target_str = str(row.get("target_tier", "")).upper()
            if target_str in tier_map:
                targets.append(tier_map[target_str])
            else:
                # Rule-based synthetic target if target_tier column missing
                composite = (
                    f_sev * 0.22 + f_traf * 0.14 + f_overdue * 0.12 + f_fail * 0.12
                    + f_asset * 0.10 + f_red * 0.08 + f_age * 0.06 + f_src * 0.06
                    + f_dept * 0.05 + f_loc * 0.05
                )
                if composite >= 85.0:
                    targets.append(3)  # P1
                elif composite >= 70.0:
                    targets.append(2)  # P2
                elif composite >= 50.0:
                    targets.append(1)  # P3
                else:
                    targets.append(0)  # P4

        X = pd.DataFrame(features)
        y = pd.Series(targets, name="priority_tier")
        return X, y

    def prepare_defect_dataset(
        self,
        limit: int = 3000,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, List[str]]:
        """
        Full defect preparation pipeline: load -> clean -> feature encode -> train/test split.
        """
        raw_df = self.load_raw_defects(limit=limit)
        clean_df = self.clean_defect_data(raw_df)
        X, y = self.encode_defect_features(clean_df)

        min_class = int(y.value_counts().min()) if len(y) > 0 else 0
        stratify = y if min_class >= 2 else None

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )

        logger.info(f"Defect dataset prepared: Train={len(X_train)}, Test={len(X_test)}, Features={list(X.columns)}")
        return X_train, X_test, y_train, y_test, list(X.columns)

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Traffic Delay Dataset Preparation
    # ─────────────────────────────────────────────────────────────────────────
    def load_raw_traffic(self, limit: int = 5000) -> pd.DataFrame:
        """
        Loads historical train timetable and delay records from database or synthesizes them.
        """
        query = """
            SELECT 
                train_number, train_name, train_type, section_id,
                scheduled_entry, scheduled_exit, actual_entry, actual_exit,
                delay_entry_minutes, delay_exit_minutes, weather_condition
            FROM train_movement_logs
            ORDER BY scheduled_entry DESC
            LIMIT %s;
        """
        df = self.db.execute_query(query, (limit,))
        if not df.empty and len(df) >= 50:
            logger.info(f"Loaded {len(df)} traffic movement records from database.")
            return df

        logger.info("Database returned insufficient traffic records. Generating synthetic train movement dataset...")
        return self._generate_synthetic_traffic(limit)

    def _generate_synthetic_traffic(self, count: int = 3000) -> pd.DataFrame:
        """Synthesizes historical train delay movements."""
        train_types = [
            "VANDE_BHARAT", "RAJDHANI_SHATABDI", "SUPERFAST_EXPRESS",
            "MAIL_EXPRESS", "SUBURBAN_EMU", "PASSENGER_ORDINARY", "FREIGHT_BULK"
        ]
        sections = ["NDLS-CNB-UP", "CNB-DDU-DN", "BCT-BRC-UP", "MAS-GDR-DN", "HWH-KGP-UP"]
        weather_conditions = ["CLEAR", "FOGGY", "RAINY", "EXTREME_HEAT"]

        now = datetime.now(timezone.utc)
        rows: List[Dict[str, Any]] = []

        for i in range(count):
            ttype = random.choice(train_types)
            sec = random.choice(sections)
            weather = random.choices(weather_conditions, weights=[0.65, 0.15, 0.12, 0.08])[0]

            hours_ago = random.uniform(1.0, 720.0)  # Past 30 days
            sched_entry = now - timedelta(hours=hours_ago)
            runtime_min = random.randint(30, 75)
            sched_exit = sched_entry + timedelta(minutes=runtime_min)

            # Realistic delay distributions by train type & weather
            base_delay = random.expovariate(0.08)  # Mean ~12.5 mins
            if ttype in ("VANDE_BHARAT", "RAJDHANI_SHATABDI"):
                base_delay *= 0.35  # High punctuality priority
            elif "FREIGHT" in ttype:
                base_delay *= 1.80  # Siding regulation delays

            if weather == "FOGGY":
                base_delay += random.uniform(15.0, 45.0)
            elif weather == "RAINY":
                base_delay += random.uniform(5.0, 20.0)

            actual_delay = max(0.0, round(base_delay, 1))

            rows.append({
                "train_number": f"{12000 + (i % 200)}",
                "train_name": f"Express_{i % 50}",
                "train_type": ttype,
                "section_id": sec,
                "scheduled_entry": sched_entry.isoformat(),
                "scheduled_exit": sched_exit.isoformat(),
                "actual_delay_minutes": actual_delay,
                "weather_condition": weather,
                "section_density_trains": random.randint(40, 130),
            })

        return pd.DataFrame(rows)

    def clean_traffic_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Cleans traffic dataset, imputes missing delays and densities."""
        cleaned = df.copy()
        if "actual_delay_minutes" in cleaned.columns:
            cleaned["actual_delay_minutes"] = cleaned["actual_delay_minutes"].fillna(0.0)

        if "section_density_trains" in cleaned.columns:
            med = cleaned["section_density_trains"].median()
            cleaned["section_density_trains"] = cleaned["section_density_trains"].fillna(med if not np.isnan(med) else 80)

        for col in ["train_type", "weather_condition", "section_id"]:
            if col in cleaned.columns:
                cleaned[col] = cleaned[col].fillna("UNKNOWN")

        return cleaned

    def encode_traffic_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Engineers temporal and operational features for train delay regression.
        Features: train_type_weight, hour_of_day, is_peak_hour, day_of_week,
        weather_severity, section_density.
        Target: actual_delay_minutes.
        """
        train_type_weights = {
            "VANDE_BHARAT": 5.0, "RAJDHANI_SHATABDI": 4.5, "SUPERFAST_EXPRESS": 3.0,
            "MAIL_EXPRESS": 2.2, "SUBURBAN_EMU": 4.0, "PASSENGER_ORDINARY": 1.5,
            "FREIGHT_BULK": 1.0, "UNKNOWN": 2.0,
        }
        weather_weights = {"CLEAR": 0.0, "RAINY": 2.0, "EXTREME_HEAT": 1.5, "FOGGY": 4.0, "UNKNOWN": 0.0}

        features: List[Dict[str, float]] = []
        targets: List[float] = []

        for _, row in df.iterrows():
            t_type = str(row.get("train_type", "UNKNOWN")).upper()
            w_cond = str(row.get("weather_condition", "CLEAR")).upper()

            entry_dt = coerce_iso_date(row.get("scheduled_entry")) or datetime.now(timezone.utc)
            hour = entry_dt.hour
            dow = entry_dt.weekday()
            is_peak = 1.0 if ((7 <= hour <= 10) or (17 <= hour <= 20)) else 0.0
            is_night = 1.0 if (23 <= hour or hour <= 5) else 0.0

            features.append({
                "train_type_priority": float(train_type_weights.get(t_type, 2.0)),
                "hour_of_day": float(hour),
                "is_peak_hour": is_peak,
                "is_night_window": is_night,
                "day_of_week": float(dow),
                "weather_hazard_factor": float(weather_weights.get(w_cond, 0.0)),
                "section_density": float(row.get("section_density_trains", 80.0)),
            })

            targets.append(float(row.get("actual_delay_minutes", 0.0)))

        X = pd.DataFrame(features)
        y = pd.Series(targets, name="actual_delay_minutes")
        return X, y

    def prepare_traffic_dataset(
        self,
        limit: int = 3000,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, List[str]]:
        """
        Full traffic delay dataset preparation pipeline: load -> clean -> encode -> split.
        """
        raw_df = self.load_raw_traffic(limit=limit)
        clean_df = self.clean_traffic_data(raw_df)
        X, y = self.encode_traffic_features(clean_df)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        logger.info(f"Traffic dataset prepared: Train={len(X_train)}, Test={len(X_test)}, Features={list(X.columns)}")
        return X_train, X_test, y_train, y_test, list(X.columns)


if __name__ == "__main__":
    pipeline = DataPreparationPipeline()
    X_tr_d, X_te_d, y_tr_d, y_te_d, feats_d = pipeline.prepare_defect_dataset(limit=500)
    print(f"Defects Train: {X_tr_d.shape}, Test: {X_te_d.shape}, Features: {feats_d}")

    X_tr_t, X_te_t, y_tr_t, y_te_t, feats_t = pipeline.prepare_traffic_dataset(limit=500)
    print(f"Traffic Train: {X_tr_t.shape}, Test: {X_te_t.shape}, Features: {feats_t}")
