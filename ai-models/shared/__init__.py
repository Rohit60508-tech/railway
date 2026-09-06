# shared/__init__.py
# Shared utilities, models, database connectors, and configuration
# ─────────────────────────────────────────────────────────────────
# Exposes core shared components as a flat import across Indian Railways AI models:
#
#   from shared import get_logger, db_pool, ai_config, to_dict
#   from shared.models import Defect, PriorityResult, TrafficSlot, WorkBundle, BlockSchedule
#   from shared.database_connector import DatabaseConnector

from .logger import get_logger, JsonFormatter, TextFormatter
from .config import AIConfig, ai_config
from .database_connector import (
    DatabaseConnector,
    DatabasePool,
    DatabaseConfig,
    get_db_connection,
    db_pool,
)
from .utils import (
    load_json_config,
    save_json_data,
    load_csv_to_dataframe,
    save_dataframe_to_csv,
    parse_datetime,
    calculate_time_difference,
    setup_logger,
    validate_defect_data,
    normalize_score,
    coerce_iso_date,
    haversine_km,
    chainage_to_gps,
    batch_list,
    retry,
    deep_merge,
    truncate_string,
)
from .models import (
    Defect,
    PriorityResult,
    TrafficSlot,
    WorkBundle,
    BlockSchedule,
    DefectRecord,
    SectionRecord,
    BlockWindowRecord,
    GangRecord,
    DefectSeverity,
    Department,
    DefectSource,
    BlockStatus,
    model_to_dict,
    to_dict,
    as_dict,
)

__version__ = "1.0.0"

__all__ = [
    "get_logger",
    "JsonFormatter",
    "TextFormatter",
    "AIConfig",
    "ai_config",
    "DatabaseConnector",
    "DatabasePool",
    "DatabaseConfig",
    "get_db_connection",
    "db_pool",
    "load_json_config",
    "save_json_data",
    "load_csv_to_dataframe",
    "save_dataframe_to_csv",
    "parse_datetime",
    "calculate_time_difference",
    "setup_logger",
    "validate_defect_data",
    "normalize_score",
    "coerce_iso_date",
    "haversine_km",
    "chainage_to_gps",
    "batch_list",
    "retry",
    "deep_merge",
    "truncate_string",
    "Defect",
    "PriorityResult",
    "TrafficSlot",
    "WorkBundle",
    "BlockSchedule",
    "DefectRecord",
    "SectionRecord",
    "BlockWindowRecord",
    "GangRecord",
    "DefectSeverity",
    "Department",
    "DefectSource",
    "BlockStatus",
    "model_to_dict",
    "to_dict",
    "as_dict",
]
