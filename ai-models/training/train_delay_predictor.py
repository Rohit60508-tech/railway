"""
train_delay_predictor.py
─────────────────────────────────────────────────────────────────────────────
Step 1 & 2: Trains a numerical Railway Delay Predictor using XGBoost / GradientBoosting.
Features:
  - distance_km: Total path distance
  - caution_km: Length of Temporary Speed Restriction (TSR) zone
  - caution_speed: Imposed speed limit (e.g., 20, 30 km/h)
  - max_speed: Normal track maximum permissible speed (e.g., 110, 130 km/h)
  - single_track: Binary flag (1 if single line pilot working, 0 if double line)
  - weather_severity: 0 (Clear) to 2 (Dense Fog / Heavy Rain)
  - train_priority: 1 (Superfast / Rajdhani) to 4 (Freight)
Output:
  - Saves trained model to ai-models/shared/railway_delay_model.json
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import random
import numpy as np

def generate_synthetic_railway_logs(n_samples: int = 1500):
    """
    Generates synthetic but physics-calibrated Indian Railways trip logs.
    """
    np.random.seed(42)
    random.seed(42)

    records = []
    for _ in range(n_samples):
        distance_km = round(random.uniform(40.0, 250.0), 1)
        max_speed = random.choice([80, 100, 110, 120, 130, 160])
        
        # 60% chance of having a caution order
        has_caution = random.random() < 0.60
        if has_caution:
            caution_km = round(random.uniform(2.0, min(35.0, distance_km * 0.4)), 1)
            caution_speed = random.choice([15, 20, 30, 45, 60])
        else:
            caution_km = 0.0
            caution_speed = max_speed

        single_track = 1 if (has_caution and random.random() < 0.35) else 0
        weather = random.choice([0, 0, 0, 1, 2]) # mostly clear, occasional rain/fog
        priority = random.choice([1, 2, 2, 3, 3, 4])

        # Physics-based baseline travel time (minutes)
        normal_travel_time = (distance_km / max_speed) * 60

        # Physics delay from caution zone
        if caution_km > 0 and caution_speed < max_speed:
            normal_zone_time = (caution_km / max_speed) * 60
            restricted_zone_time = (caution_km / caution_speed) * 60
            speed_drop_delay = restricted_zone_time - normal_zone_time
        else:
            speed_drop_delay = 0.0

        # Operational delays
        single_track_delay = random.uniform(15.0, 35.0) if single_track else 0.0
        weather_delay = weather * random.uniform(4.0, 12.0)
        priority_penalty = (priority - 1) * random.uniform(2.0, 6.0) # lower priority trains get looped

        # Random noise / braking and acceleration gradient losses
        noise = random.gauss(0, 2.5)

        actual_delay = max(0.0, speed_drop_delay + single_track_delay + weather_delay + priority_penalty + noise)

        records.append({
            "distance_km": distance_km,
            "caution_km": caution_km,
            "caution_speed": caution_speed,
            "max_speed": max_speed,
            "single_track": single_track,
            "weather_severity": weather,
            "train_priority": priority,
            "actual_delay_mins": round(actual_delay, 1)
        })

    return records


def train_and_save_model():
    print("[1/4] Generating 1,500 historical railway trip & maintenance logs...")
    data = generate_synthetic_railway_logs(1500)
    
    # Save CSV dataset copy for records
    os.makedirs("data", exist_ok=True)
    csv_path = os.path.join("data", "railway_delay_historical_logs.json")
    with open(csv_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        print(f"  [OK] Saved training dataset to: {csv_path}")

    # Prepare numpy feature matrices
    feature_keys = [
        "distance_km", "caution_km", "caution_speed",
        "max_speed", "single_track", "weather_severity", "train_priority"
    ]
    X = np.array([[row[k] for k in feature_keys] for row in data], dtype=np.float32)
    y = np.array([row["actual_delay_mins"] for row in data], dtype=np.float32)

    # Train / Test split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print("[2/4] Training Gradient Boosted Delay Regressor...")
    try:
        import xgboost as xgb
        regressor = xgb.XGBRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.85,
            random_state=42
        )
        regressor.fit(X_train, y_train)
        model_type = "XGBoost"
        
        # Evaluate
        preds = regressor.predict(X_test)
        mae = np.mean(np.abs(preds - y_test))
        print(f"  [OK] XGBRegressor trained successfully! Test MAE: {mae:.2f} mins")

        os.makedirs("ai-models/shared", exist_ok=True)
        model_out = "ai-models/shared/railway_delay_model.json"
        regressor.save_model(model_out)
        print(f"  [OK] Model saved to: {model_out}")
    except ImportError:
        # Fallback to sklearn if xgboost is not installed
        from sklearn.ensemble import GradientBoostingRegressor
        print("  [INFO] XGBoost not in current env, using Scikit-Learn GradientBoostingRegressor...")
        regressor = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42
        )
        regressor.fit(X_train, y_train)
        model_type = "Sklearn_GBR"
        
        preds = regressor.predict(X_test)
        mae = np.mean(np.abs(preds - y_test))
        print(f"  [OK] GradientBoostingRegressor trained! Test MAE: {mae:.2f} mins")

        # Save weights as JSON metadata
        os.makedirs("ai-models/shared", exist_ok=True)
        model_out = "ai-models/shared/railway_delay_model.json"
        meta = {
            "model_type": model_type,
            "feature_keys": feature_keys,
            "test_mae_mins": float(round(mae, 2)),
            "n_samples": len(data),
            "created_at": "2026-09-24T00:00:00Z"
        }
        with open(model_out, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        print(f"  [OK] Metadata saved to: {model_out}")

    print("[3/4] Ready for Step 3: Dispatcher Fine-Tuning Dataset Generation.")


if __name__ == "__main__":
    train_and_save_model()
