# 🚆 Indian Railways AI Models & Optimization Engine

This directory contains the machine learning, forecasting, and constraint optimization microservices powering the automated maintenance planning and block allocation platform for Indian Railways.

---

## 📁 Directory Structure

```
ai-models/
├── requirements.txt            # Python dependencies (pandas, scikit-learn, xgboost, ortools, etc.)
├── README.md                   # Architecture overview, setup guide, and usage examples
├── priority-engine/            # Defect priority & failure risk scoring
│   ├── __init__.py
│   └── config.json
├── traffic-predictor/          # Train traffic density forecasting & block delay estimator
│   ├── __init__.py
│   └── config.json
├── block-optimizer/            # Google OR-Tools CP-SAT multi-department block scheduler
│   ├── __init__.py
│   └── config.json
└── shared/                     # Common utilities, data models, DB pooling, and logging
    ├── __init__.py
    ├── config.json
    ├── database_connector.py   # PostgreSQL ThreadedConnectionPool manager
    ├── logger.py               # Structured JSON & console logger with trace IDs
    ├── models.py               # DefectRecord, SectionRecord, BlockWindowRecord, GangRecord
    └── utils.py                # GPS chainage interpolation, Haversine, date coercion, retry
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Python 3.10+ recommended
- PostgreSQL 14+ (with PostGIS optional for spatial queries)
- GCC / C++ build tools for `ortools` and `psycopg2` binary extensions (pre-built wheels available for Windows/Linux/macOS)

### 2. Environment Setup

```bash
# Navigate to ai-models directory
cd ai-models

# Create a dedicated virtual environment
python -m venv .venv

# Activate the virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Windows (cmd):
.\.venv\Scripts\activate.bat
# Linux / macOS:
source .venv/bin/activate

# Install all required dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the project root or export variables in your shell:

```bash
# Database Settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ir_maintenance
DB_USER=ir_app
DB_PASSWORD=secret_db_pass
DB_SSLMODE=prefer
DB_POOL_MIN=2
DB_POOL_MAX=20

# Logging Configuration
LOG_LEVEL=INFO
LOG_FORMAT=text          # Options: "text" (colorized console) or "json" (structured production)
LOG_DIR=/var/log/ir-ai   # Optional: path to write rotating service log files

# Service Ports
PRIORITY_PORT=8001
TRAFFIC_PORT=8002
OPTIMIZER_PORT=8003
```

---

## 🛠️ Services & Usage Examples

### 1. Defect Priority Engine (`/priority-engine/`)
Combines XGBoost classification with domain-specific multi-criteria scoring (RDSO defect codes, asset age, GMT track loading, weather conditions, and SLA urgency).

#### Python Usage Example:
```python
from shared.models import DefectRecord, DefectSeverity, Department, DefectSource
from shared.logger import get_logger

logger = get_logger("priority_demo")

# Instantiate a defect record
defect = DefectRecord(
    defect_id="DEF-NDLS-2026-0891",
    section_id="NDLS-CNB-UP",
    asset_id="RAIL-WELD-KM114.2",
    asset_type="THERMIT_WELD",
    department=Department.CIVIL.value,
    chainage_km=114.2,
    severity=DefectSeverity.CRITICAL.value,
    source=DefectSource.USFD.value,
    flaw_code="IMR_221", # Immediate Removal Rail Flaw
    track_quality_index=42.5,
    speed_restriction_kmh=30,
)

# Multi-criteria scoring logic (weights configured in priority-engine/config.json)
severity_weights = {"CRITICAL": 1.0, "HIGH": 0.75, "MEDIUM": 0.4, "LOW": 0.15}
base_weight = severity_weights.get(defect.severity, 0.5)
sla_multiplier = 4.0 if defect.severity == "CRITICAL" else 1.2
tqi_penalty = max(0.0, (60.0 - (defect.track_quality_index or 75.0)) / 60.0)

composite_priority = min(100.0, (base_weight * 50.0 + tqi_penalty * 25.0) * (sla_multiplier / 2.0))
defect.priority_score = round(composite_priority, 2)

logger.info(f"Defect {defect.defect_id} evaluated with Priority Score: {defect.priority_score}/100")
```

---

### 2. Train Traffic Predictor (`/traffic-predictor/`)
Forecasts sectional train density over 6h, 12h, 24h, and 48h horizons using historical COA (Control Office Application) feeds, detecting low-traffic shadow windows suitable for track maintenance.

#### Python Usage Example:
```python
import numpy as np
import pandas as pd
from shared.logger import get_logger

logger = get_logger("traffic_demo")

# Generate 24-hour sectional traffic projection
hours = np.arange(24)
# Typical IR double-line traffic curve (troughs between 01:00-05:00 and 13:00-15:00)
base_trains_per_hour = [
    2, 1, 1, 2, 3, 5, 8, 9, 8, 7, 6, 5, 4, 3, 4, 6, 8, 9, 9, 8, 6, 4, 3, 2
]

df_forecast = pd.DataFrame({
    "hour": hours,
    "expected_trains": base_trains_per_hour,
    "passenger_share": [0.6 if 6 <= h <= 22 else 0.2 for h in hours],
})

# Identify optimal shadow maintenance windows (consecutive hours with <= 2 trains)
low_traffic_slots = df_forecast[df_forecast["expected_trains"] <= 2]
logger.info(f"Recommended maintenance shadow hours (UTC/IST): {low_traffic_slots['hour'].tolist()}")
```

---

### 3. Block Window Optimizer (`/block-optimizer/`)
Solves multi-department maintenance scheduling using Google OR-Tools CP-SAT constraint programming. Maximizes priority defect coverage while consolidating Civil, Electrical (TRD/OHE), and S&T work into single integrated blocks.

#### Python Usage Example:
```python
from ortools.sat.python import cp_model
from shared.logger import get_logger

logger = get_logger("optimizer_demo")

model = cp_model.CpModel()

# Time slots (e.g. 8 available 1-hour slots)
NUM_SLOTS = 8
# Candidate work requests: [Civil Track Tamping, OHE Wire Inspection, Signal Point Motor]
requests = ["REQ_CIVIL", "REQ_OHE", "REQ_SIG"]
durations = {"REQ_CIVIL": 2, "REQ_OHE": 2, "REQ_SIG": 1}
priorities = {"REQ_CIVIL": 90, "REQ_OHE": 85, "REQ_SIG": 60}

# Decision variables: start slot for each request
starts = {}
ends = {}
intervals = {}

for req in requests:
    dur = durations[req]
    start_var = model.NewIntVar(0, NUM_SLOTS - dur, f"start_{req}")
    end_var = model.NewIntVar(dur, NUM_SLOTS, f"end_{req}")
    interval_var = model.NewIntervalVar(start_var, dur, end_var, f"interval_{req}")
    starts[req] = start_var
    ends[req] = end_var
    intervals[req] = interval_var

# Consolidation constraint: Civil and OHE work should overlap to create an integrated block
# (Both scheduled at the exact same start slot for simultaneous execution)
model.Add(starts["REQ_CIVIL"] == starts["REQ_OHE"])

# Objective: Minimize completion time and maximize priority coverage
model.Minimize(ends["REQ_CIVIL"] + ends["REQ_SIG"])

# Solve model
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 10.0
status = solver.Solve(model)

if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    for req in requests:
        slot_start = solver.Value(starts[req])
        slot_end = solver.Value(ends[req])
        logger.info(f"Scheduled {req}: Slot {slot_start} -> {slot_end}")
```

---

### 4. Shared Utilities & Models (`/shared/`)
Provides standardized models, safe connection pooling, and geospatial utilities across all services.

#### Python Usage Example:
```python
from shared.utils import haversine_km, chainage_to_gps, coerce_iso_date, batch_list
from shared.models import SectionRecord, GangRecord
from shared.database_connector import db_pool
from shared.logger import get_logger

logger = get_logger("shared_demo")

# 1. Spatial interpolation from Railway Track Chainage
lat, lon = chainage_to_gps("NDLS-CNB-UP", km_mark=142.5)
logger.info(f"GPS for KM 142.5: Lat {lat}, Lon {lon}")

# 2. Haversine distance between two stations
dist_km = haversine_km(28.6139, 77.2090, 26.4499, 80.3319) # New Delhi to Kanpur
logger.info(f"Air distance: {dist_km:.2f} km")

# 3. Batch processing items
sample_defects = [f"DEF_{i}" for i in range(10)]
for batch in batch_list(sample_defects, batch_size=3):
    logger.info(f"Processing batch: {batch}")
```

---

## 🧪 Testing & Validation

To test individual shared components or verify model schemas:

```bash
# Run unit tests or sanity checks
python -c "import shared; print('Shared package version:', shared.__version__)"
python -c "from shared.models import DefectRecord; print(DefectRecord(defect_id='D1', section_id='S1', asset_id='A1', asset_type='RAIL', department='CIVIL', chainage_km=10.5))"
```
