"""
utils.py
─────────────────────────────────────────────────────────────────────────────
Shared utility functions for Indian Railways AI models and services.
Provides JSON/CSV persistence, datetime parsing, time difference calculations,
logging configuration, defect schema validation, score normalization,
spatial calculations, and retry decorators.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import math
import time
import functools
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    Generator,
    Iterable,
    List,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    Union,
)
from dateutil import parser as date_parser
import pytz
import pandas as pd

from .logger import get_logger, JsonFormatter, TextFormatter

logger = get_logger("shared_utils")

IST = pytz.timezone("Asia/Kolkata")
UTC = timezone.utc
T = TypeVar("T")


# ─────────────────────────────────────────────────────────────────────────────
# JSON & CSV I/O Utilities
# ─────────────────────────────────────────────────────────────────────────────
def load_json_config(config_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Loads JSON configuration file safely. Returns empty dict on failure.
    """
    path = Path(config_path)
    if not path.exists():
        logger.warning(f"JSON configuration file not found at: {path}")
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read JSON config from {path}: {e}")
        return {}


def save_json_data(data: Any, file_path: Union[str, Path], indent: int = 2) -> bool:
    """
    Saves serializable Python data to a JSON file. Creates parent directories if missing.
    """
    path = Path(file_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, default=str)
        return True
    except Exception as e:
        logger.error(f"Failed to save JSON data to {path}: {e}")
        return False


def load_csv_to_dataframe(file_path: Union[str, Path], **kwargs: Any) -> pd.DataFrame:
    """
    Loads a CSV file into a pandas DataFrame.
    """
    path = Path(file_path)
    if not path.exists():
        logger.warning(f"CSV file not found at: {path}")
        return pd.DataFrame()
    try:
        return pd.read_csv(path, **kwargs)
    except Exception as e:
        logger.error(f"Failed to load CSV from {path}: {e}")
        return pd.DataFrame()


def save_dataframe_to_csv(df: pd.DataFrame, file_path: Union[str, Path], index: bool = False) -> bool:
    """
    Saves a pandas DataFrame to a CSV file. Creates parent directories if missing.
    """
    path = Path(file_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=index)
        return True
    except Exception as e:
        logger.error(f"Failed to save DataFrame to CSV at {path}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Datetime & Temporal Utilities
# ─────────────────────────────────────────────────────────────────────────────
def parse_datetime(datetime_str: Any, default_tz: Any = UTC) -> Optional[datetime]:
    """
    Parses datetime string or epoch timestamp into an aware UTC datetime object.
    """
    if datetime_str is None:
        return None

    if isinstance(datetime_str, datetime):
        if datetime_str.tzinfo is None:
            if hasattr(default_tz, "localize"):
                return default_tz.localize(datetime_str).astimezone(UTC)
            return datetime_str.replace(tzinfo=default_tz).astimezone(UTC)
        return datetime_str.astimezone(UTC)

    if isinstance(datetime_str, (int, float)):
        epoch_seconds = datetime_str / 1000.0 if datetime_str > 1e11 else float(datetime_str)
        return datetime.fromtimestamp(epoch_seconds, tz=UTC)

    if isinstance(datetime_str, str):
        cleaned = datetime_str.strip()
        if not cleaned:
            return None
        try:
            parsed = date_parser.parse(cleaned)
            if parsed.tzinfo is None:
                if hasattr(default_tz, "localize"):
                    parsed = default_tz.localize(parsed)
                else:
                    parsed = parsed.replace(tzinfo=default_tz)
            return parsed.astimezone(UTC)
        except (ValueError, TypeError, OverflowError) as err:
            logger.debug(f"Failed to parse datetime from '{datetime_str}': {err}")
            return None

    return None


# Backward-compatible alias
coerce_iso_date = parse_datetime


def calculate_time_difference(
    dt1: Union[str, datetime],
    dt2: Union[str, datetime],
    absolute: bool = False,
) -> float:
    """
    Calculates the difference in minutes between two datetimes: (dt2 - dt1) in minutes.
    If absolute is True, returns abs(dt2 - dt1).
    """
    p_dt1 = parse_datetime(dt1)
    p_dt2 = parse_datetime(dt2)

    if not p_dt1 or not p_dt2:
        return 0.0

    delta_minutes = (p_dt2 - p_dt1).total_seconds() / 60.0
    return abs(delta_minutes) if absolute else delta_minutes


# ─────────────────────────────────────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────────────────────────────────────
def setup_logger(
    name: str = "ir_ai",
    log_file: Optional[Union[str, Path]] = None,
    level: str = "INFO",
) -> logging.Logger:
    """
    Configures and returns a logger instance with both console and optional file handlers.
    """
    log_lvl = getattr(logging, str(level).upper(), logging.INFO)
    inst = logging.getLogger(name)
    inst.setLevel(log_lvl)

    if not inst.handlers:
        # Console Stream Handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_lvl)
        console_handler.setFormatter(TextFormatter())
        inst.addHandler(console_handler)

        # File Handler
        if log_file:
            path = Path(log_file)
            path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(path, encoding="utf-8")
            file_handler.setLevel(log_lvl)
            file_handler.setFormatter(JsonFormatter(service_name=name))
            inst.addHandler(file_handler)

    inst.propagate = False
    return inst


# ─────────────────────────────────────────────────────────────────────────────
# Data Validation & Normalization
# ─────────────────────────────────────────────────────────────────────────────
def validate_defect_data(defect_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validates that a defect dictionary satisfies the essential structural requirements.
    Returns (is_valid: bool, error_messages: List[str]).
    """
    errors: List[str] = []
    if not isinstance(defect_data, dict):
        return False, ["Defect data must be a dictionary."]

    required_fields = ["defect_id", "department", "section_id"]
    for field in required_fields:
        if not defect_data.get(field):
            errors.append(f"Missing required field: '{field}'.")

    # Validate severity if present
    severity = str(defect_data.get("severity", "")).upper()
    valid_severities = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
    if severity and severity not in valid_severities:
        errors.append(f"Invalid severity '{severity}'. Must be one of: {sorted(valid_severities)}.")

    # Validate reported_at / detected_at if present
    rep_time = defect_data.get("reported_at") or defect_data.get("detected_at")
    if rep_time and parse_datetime(rep_time) is None:
        errors.append(f"Invalid timestamp format for reported_at: '{rep_time}'.")

    return len(errors) == 0, errors


def normalize_score(
    score: float,
    min_val: float = 0.0,
    max_val: float = 100.0,
    target_min: float = 0.0,
    target_max: float = 100.0,
) -> float:
    """
    Normalizes a numerical score from [min_val, max_val] to [target_min, target_max].
    Clamps the result within [target_min, target_max].
    """
    if max_val == min_val:
        return target_min

    clamped = max(min_val, min(max_val, score))
    scaled = (clamped - min_val) / (max_val - min_val)
    target_score = target_min + scaled * (target_max - target_min)
    return round(float(target_score), 2)


# ─────────────────────────────────────────────────────────────────────────────
# Geospatial & Operational Helpers
# ─────────────────────────────────────────────────────────────────────────────
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two coordinates in kilometers.
    """
    r = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def chainage_to_gps(
    section_id: str,
    km_mark: float,
    reference_points: Optional[Sequence[Dict[str, Any]]] = None,
) -> Tuple[float, float]:
    """
    Interpolates GPS coordinates from railway track chainage.
    """
    if reference_points and len(reference_points) >= 2:
        sorted_refs = sorted(reference_points, key=lambda x: x["km"])
        if km_mark <= sorted_refs[0]["km"]:
            return float(sorted_refs[0]["lat"]), float(sorted_refs[0]["lon"])
        if km_mark >= sorted_refs[-1]["km"]:
            return float(sorted_refs[-1]["lat"]), float(sorted_refs[-1]["lon"])

        for i in range(len(sorted_refs) - 1):
            p1 = sorted_refs[i]
            p2 = sorted_refs[i + 1]
            if p1["km"] <= km_mark <= p2["km"]:
                span = p2["km"] - p1["km"]
                if span <= 0:
                    return float(p1["lat"]), float(p1["lon"])
                factor = (km_mark - p1["km"]) / span
                interp_lat = p1["lat"] + factor * (p2["lat"] - p1["lat"])
                interp_lon = p1["lon"] + factor * (p2["lon"] - p1["lon"])
                return round(interp_lat, 6), round(interp_lon, 6)

    base_lat = 28.6139  # New Delhi
    base_lon = 77.2090
    delta_lat = (km_mark * 0.007)
    delta_lon = (km_mark * 0.008)
    return round(base_lat - delta_lat, 6), round(base_lon + delta_lon, 6)


def batch_list(items: Sequence[T], batch_size: int) -> Generator[List[T], None, None]:
    """
    Yields successive batches of specified size from a list or sequence.
    """
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than 0")
    for i in range(0, len(items), batch_size):
        yield list(items[i : i + batch_size])


def retry(
    max_attempts: int = 3,
    delay_seconds: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[BaseException], ...] = (Exception,),
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Function decorator with exponential backoff for resilient network / database calls.
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            current_delay = delay_seconds
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(f"Function {func.__name__} failed after {max_attempts} attempts: {e}")
                        raise
                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} for {func.__name__} failed ({e}). Retrying in {current_delay:.2f}s..."
                    )
                    time.sleep(current_delay)
                    current_delay *= backoff
            return func(*args, **kwargs)
        return wrapper
    return decorator


def deep_merge(target: Dict[str, Any], source: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively merges nested source dictionary into target dictionary.
    """
    for key, val in source.items():
        if isinstance(val, dict) and key in target and isinstance(target[key], dict):
            deep_merge(target[key], val)
        else:
            target[key] = val
    return target


def truncate_string(text: Optional[str], max_len: int = 100, suffix: str = "...") -> str:
    """
    Safely truncates string if length exceeds max_len.
    """
    if text is None:
        return ""
    if len(text) <= max_len:
        return text
    cutoff = max_len - len(suffix)
    return text[: max(0, cutoff)] + suffix
