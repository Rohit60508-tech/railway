# 🚆 Indian Railways AI Model Training & Evaluation Suite

This directory contains the end-to-end machine learning training, feature engineering, evaluation, and hyperparameter optimization pipelines for the Indian Railways automated maintenance planning platform.

---

## 📁 Directory Structure

```
ai-models/training/
├── README.md                     # Training documentation, data schemas, and benchmarks
├── prepare_training_data.py      # Ingestion, cleaning, imputation, categorical encoding, and splitting
├── train_priority_model.py       # Trains RandomForest/GradientBoosting defect priority classifier
├── train_traffic_model.py        # Trains GradientBoosting/RandomForest train delay regressor
├── evaluate_models.py            # Model evaluation suite (Accuracy, F1, MAE, RMSE, Confusion Matrix)
└── hyperparameter_tuning.py      # GridSearchCV and RandomizedSearchCV parameter optimization
```

---

## 📋 Data Requirements & Schemas

The training pipeline extracts historical data from PostgreSQL using `DatabaseConnector`. If the database is offline or empty, realistic synthetic datasets conforming to RDSO (Research Designs and Standards Organisation) standards are automatically generated.

### 1. Defect Dataset Requirements (`defects` table)
| Field | Type | Description / Domain | Imputation / Default |
|---|---|---|---|
| `defect_id` | `VARCHAR` | Unique defect identifier (e.g. `DEF-1001`) | Mandatory |
| `section_id` | `VARCHAR` | Track section ID (e.g. `NDLS-CNB-UP`) | Mandatory |
| `department` | `VARCHAR` | `CIVIL`, `TRD_OHE`, `SIGNALLING`, `ROLLING_STOCK` | Mode imputation |
| `severity` | `VARCHAR` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` | Mode imputation |
| `source` | `VARCHAR` | `USFD`, `TRC`, `OMS`, `ITMS`, `PATROL`, `DRONE`, `MANUAL` | Mode imputation |
| `asset_type` | `VARCHAR` | `RAIL_THERMIT_WELD`, `SWITCH_TONGUE_RAIL`, `OHE_CATENARY_WIRE`, etc. | Mode imputation |
| `detected_at` | `TIMESTAMP` | Timestamp when defect was identified | UTC current time |
| `sla_deadline` | `TIMESTAMP` | Mandatory rectification deadline | Computed via severity SLA |
| `track_quality_index` | `FLOAT` | TQI from Track Recording Car (0 to 100) | Median imputation (65.0) |
| `trains_per_day` | `INT` | Daily section train volume | Median imputation (80) |
| `track_count` | `INT` | Number of tracks (1=single, 2=double, 4=quad) | 2 (Double track) |
| `location_criticality` | `FLOAT` | Proximity to bridges, tunnels, junctions (0-100) | 50.0 |

### 2. Traffic Movement Dataset Requirements (`train_movement_logs` table)
| Field | Type | Description / Domain | Imputation / Default |
|---|---|---|---|
| `train_number` | `VARCHAR` | IR train number (e.g. `12301`) | Mandatory |
| `train_type` | `VARCHAR` | `VANDE_BHARAT`, `RAJDHANI_SHATABDI`, `SUPERFAST_EXPRESS`, `MAIL_EXPRESS`, `SUBURBAN_EMU`, `FREIGHT_BULK` | Mode imputation |
| `section_id` | `VARCHAR` | Section identifier | Mandatory |
| `scheduled_entry` | `TIMESTAMP` | Scheduled section entry time | Mandatory |
| `scheduled_exit` | `TIMESTAMP` | Scheduled section exit time | Mandatory |
| `actual_delay_minutes` | `FLOAT` | Recorded arrival delay in minutes (Target variable) | 0.0 |
| `weather_condition` | `VARCHAR` | `CLEAR`, `FOGGY`, `RAINY`, `EXTREME_HEAT` | `CLEAR` |
| `section_density_trains` | `INT` | Concurrent sectional train volume | Median imputation |

---

## 🛠️ Training Procedures & CLI Commands

### 1. Preparing Training Data
Verify and inspect dataset extraction and preprocessing:
```bash
python prepare_training_data.py
```

### 2. Training Defect Priority Classifier
Trains an ensemble classifier predicting triage tier (`P1` Critical, `P2` High, `P3` Medium, `P4` Routine):
```bash
# Default training (RandomForest, 120 trees, 3000 samples)
python train_priority_model.py

# GradientBoosting with custom parameters
python train_priority_model.py --model-type GradientBoosting --n-estimators 150 --max-depth 5 --samples 5000

# Output Artifacts Saved To:
#  - /ai-models/priority-engine/models/priority_model.pkl
#  - /ai-models/priority-engine/artifacts/defect_priority_model.joblib
```

### 3. Training Train Traffic Delay Regressor
Trains a regressor to forecast train delays and knock-on cascade impact:
```bash
# Default training (GradientBoosting, 150 trees, 3000 samples)
python train_traffic_model.py

# RandomForest alternative
python train_traffic_model.py --model-type RandomForest --n-estimators 200 --max-depth 8 --samples 4000

# Output Artifacts Saved To:
#  - /ai-models/traffic-predictor/models/traffic_model.pkl
#  - /ai-models/traffic-predictor/artifacts/traffic_forecaster.joblib
```

### 4. Evaluating Models
Runs evaluation against held-out test datasets and generates performance reports:
```bash
# Evaluate all models
python evaluate_models.py

# Evaluate priority model only
python evaluate_models.py --model priority --samples 1500

# Evaluate traffic delay model only
python evaluate_models.py --model traffic --samples 1500
```

### 5. Hyperparameter Optimization
Searches parameter space using `RandomizedSearchCV` or `GridSearchCV`:
```bash
# Tune Priority Classifier with Randomized Search (15 iterations, 4-fold CV)
python hyperparameter_tuning.py --model priority --search-type random --n-iter 15 --cv 4

# Exhaustive Grid Search for Traffic Delay Regressor
python hyperparameter_tuning.py --model traffic --search-type grid --cv 3
```

---

## 🎯 Evaluation Metrics & Benchmark Targets

The Indian Railways maintenance AI system enforces strict accuracy and reliability thresholds before models can be deployed to production:

### 1. Defect Priority Classifier Targets
| Metric | Benchmark Target | Description |
|---|---|---|
| **Overall Accuracy** | $\ge 90.0\%$ | Fraction of correct triage classifications across all 4 tiers |
| **Macro F1-Score** | $\ge 0.85$ | Unweighted mean F1 ensuring rare critical classes are handled properly |
| **P1 Class Recall** | $\ge 95.0\%$ | Critical safety defects (IMR rail fractures) must rarely be missed |
| **P4 False Alarm Rate** | $\le 5.0\%$ | Routine issues must not be misclassified as P1 emergencies |

### 2. Train Traffic Delay Regressor Targets
| Metric | Benchmark Target | Description |
|---|---|---|
| **Mean Absolute Error (MAE)** | $\le 6.0\text{ minutes}$ | Average deviation between predicted and actual train arrival delays |
| **Root Mean Squared Error (RMSE)** | $\le 10.0\text{ minutes}$ | Penalizes large outlier delay estimation errors |
| **$R^2$ Variance Explained** | $\ge 0.70$ | Proportion of variance captured by diurnal and weather features |
| **$\pm 10$ Min Tolerance Coverage** | $\ge 85.0\%$ | Percentage of train forecasts within 10 minutes of actual run |
