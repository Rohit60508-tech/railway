# AI Model Training & Lifecycle Guide

## 1. Overview

This guide details the complete machine learning lifecycle for the Indian Railways Maintenance AI platform, covering dataset preparation, training pipelines, hyperparameter optimization, model validation, semantic artifact versioning, and zero-downtime deployment.

All training scripts reside in `ai-models/training/`:
- `prepare_training_data.py`: Ingestion, cleaning, feature transformation, and train/test splits.
- `train_priority_model.py`: Defect priority classification model training.
- `train_traffic_model.py`: Train movement and delay impact model training.
- `evaluate_models.py`: Comprehensive offline evaluation across accuracy, precision, recall, F1, MAE, and RMSE.
- `hyperparameter_tuning.py`: Systematic search over model hyperparameter spaces.

---

## 2. Training Data Preparation

Dataset preparation is managed by `prepare_training_data.py`:
- Ingests raw defect logs and inspection feeds (USFD, TRC, track patrol).
- **Imputation**: Missing continuous values (e.g. traffic GMT) imputed using sectional averages; categorical values imputed with `UNKNOWN`.
- **Feature Encoding**: Ordinal mapping for severity levels (`CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1`); one-hot or frequency encoding for track section IDs.
- **Stratified Splitting**: 80/20 train/test split preserving the natural class distribution of P1/P2/P3/P4 defects.

```bash
python ai-models/training/prepare_training_data.py --source postgres --output data/processed/
```

---

## 3. Training Procedures

### 3.1 Training the Defect Priority Model
```bash
python ai-models/training/train_priority_model.py --data data/processed/defects_train.csv --output-dir ai-models/priority-engine/models/
```

**Training Execution Flow**:
1. Loads feature matrix: 10 input features.
2. Fits `RandomForestClassifier(n_estimators=120, max_depth=6, random_state=42)`.
3. Fits comparison baseline with `GradientBoostingClassifier` and `HistGradientBoostingClassifier`.
4. Selects top performing model by Cross-Validated Macro F1 Score.
5. Saves model weights to `ai-models/priority-engine/models/priority_model.pkl` with SHA256 integrity checksum.

### 3.2 Training the Traffic Prediction Model
```bash
python ai-models/training/train_traffic_model.py --data data/processed/train_timetables.csv --output-dir ai-models/traffic-predictor/models/
```

Fits an ensemble regressor predicting expected train dwell and regulation delay (in minutes) caused by sectional maintenance restrictions.

---

## 4. Hyperparameter Tuning

Managed via `ai-models/training/hyperparameter_tuning.py` using 5-fold cross-validation:

| Parameter | Grid Search Space | Optimal Selected Value |
|---|---|---|
| `n_estimators` | `[50, 80, 100, 120, 150, 200]` | `120` |
| `max_depth` | `[4, 6, 8, 10, None]` | `6` |
| `min_samples_split` | `[2, 4, 8, 16]` | `4` |
| `min_samples_leaf` | `[1, 2, 4]` | `2` |
| `max_features` | `['sqrt', 'log2', 0.8]` | `'sqrt'` |

---

## 5. Evaluation Metrics & Acceptance Thresholds

Before any model is promoted to production, it must satisfy strict evaluation criteria enforced by `evaluate_models.py`:

### Priority Model Classification Thresholds:
- **Macro F1-Score**: $\ge 0.88$ (Critical to prevent class imbalance skewing P4 over P1).
- **P1 Recall**: $\ge 0.96$ (**Crucial Safety Requirement**: Under no circumstances may an urgent rail flaw or fracture be misclassified as non-critical).
- **Overall Accuracy**: $\ge 0.90$.

### Traffic Model Regression Thresholds:
- **Mean Absolute Error (MAE)**: $\le 4.5 \text{ minutes}$ on train regulation delay.
- **Root Mean Squared Error (RMSE)**: $\le 8.0 \text{ minutes}$.

---

## 6. Model Versioning & Artifact Storage

Trained models are packaged with immutable metadata:

```json
{
  "model_name": "railway_defect_prioritizer",
  "version": "1.2.0",
  "trained_timestamp": "2026-09-06T00:00:00Z",
  "training_records_count": 48500,
  "git_commit_hash": "e8a94c1",
  "metrics": {
    "accuracy": 0.924,
    "macro_f1": 0.896,
    "p1_recall": 0.981
  },
  "artifact_checksum_sha256": "8a34bcf9...d4"
}
```

Artifacts are archived in the shared volume `/app/models/` and tagged by semantic release (`priority_model_v1.2.0.pkl`).

---

## 7. Production Deployment & Zero-Downtime Hot Reload

1. Push validated model artifact to the shared Kubernetes PVC (`/app/models/priority_model.pkl`).
2. Trigger the reload endpoint across running pods:
   ```bash
   curl -X POST http://ai.maintenance.railnet.gov.in/api/v1/priority/retrain
   ```
3. The FastAPI inference process instantiates the new model object, verifies input/output shapes with a synthetic test defect, and replaces the in-memory reference atomically.
4. If validation fails, the worker retains the existing model and emits an alert to Prometheus.
