"""
logger.py
─────────────────────────────────────────────────────────────────────────────
Centralized logging module for Indian Railways AI models and microservices.
Features:
  - Structured JSON logs for all AI predictions with features, scores, timestamps
  - Model version tracking in structured log payloads
  - Comprehensive log level support (DEBUG, INFO, WARNING, ERROR, CRITICAL)
  - Daily log rotation with automatic gzip compression of archived logs
  - Monitoring system integration for automated error dispatching
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import gzip
import shutil
import json
import logging
import logging.handlers
from datetime import datetime, timezone
from contextvars import ContextVar
from typing import Optional, Dict, Any, Callable, List

# Context variable to hold distributed trace / request IDs across async/sync calls
current_trace_id: ContextVar[Optional[str]] = ContextVar("current_trace_id", default=None)

# Registry of error listeners for monitoring dispatch
_monitoring_error_listeners: List[Callable[[Dict[str, Any]], None]] = []


def register_error_listener(callback: Callable[[Dict[str, Any]], None]) -> None:
    """Register a callback function to receive formatted error events for monitoring."""
    if callback not in _monitoring_error_listeners:
        _monitoring_error_listeners.append(callback)


def set_trace_id(trace_id: str) -> None:
    """Set correlation / trace ID for current execution context."""
    current_trace_id.set(trace_id)


def get_trace_id() -> Optional[str]:
    """Retrieve correlation / trace ID for current execution context."""
    return current_trace_id.get()


class JsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects for log aggregators (ELK, CloudWatch, etc.)."""

    def __init__(self, service_name: str = "ir-ai-service"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "pid": os.getpid(),
        }

        trace_id = get_trace_id() or getattr(record, "trace_id", None)
        if trace_id:
            log_entry["trace_id"] = trace_id

        # Attach custom extra attributes if passed via extra={...}
        for attr in ("model_version", "prediction_id", "service_role", "latency_ms"):
            if hasattr(record, attr):
                log_entry[attr] = getattr(record, attr)

        if hasattr(record, "prediction_data") and isinstance(record.prediction_data, dict):
            log_entry["prediction"] = record.prediction_data

        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_entry.update(record.extra_data)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


class TextFormatter(logging.Formatter):
    """Readable colored text formatter for development and interactive console output."""

    LEVEL_COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET_COLOR = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.LEVEL_COLORS.get(record.levelname, self.RESET_COLOR)
        trace_id = get_trace_id() or getattr(record, "trace_id", "-")
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        msg = f"{timestamp} | {color}{record.levelname:<8}{self.RESET_COLOR} | [{trace_id}] | {record.name}:{record.lineno} - {record.getMessage()}"
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return msg


class CompressedDailyRotatingFileHandler(logging.handlers.TimedRotatingFileHandler):
    """
    Daily rotating file handler that automatically compresses rotated logs
    using gzip upon rotation (saving disk space and network bandwidth).
    """

    def __init__(self, filename, when='midnight', interval=1, backupCount=30, encoding='utf-8'):
        super().__init__(filename, when=when, interval=interval, backupCount=backupCount, encoding=encoding)
        self.rotator = self._gzip_rotator
        self.namer = self._gzip_namer

    @staticmethod
    def _gzip_namer(name: str) -> str:
        return name + ".gz"

    @staticmethod
    def _gzip_rotator(source: str, dest: str) -> None:
        try:
            with open(source, 'rb') as f_in:
                with gzip.open(dest, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            os.remove(source)
        except Exception as e:
            # Fallback to normal rename if compression encounters filesystem permission error
            if os.path.exists(source) and not os.path.exists(dest):
                os.rename(source, dest)


class MonitoringDispatchHandler(logging.Handler):
    """Custom logging handler that dispatches ERROR and CRITICAL records to monitoring listeners."""

    def __init__(self, service_name: str = "ir-ai-service"):
        super().__init__(level=logging.ERROR)
        self.service_name = service_name

    def emit(self, record: logging.LogRecord) -> None:
        if not _monitoring_error_listeners:
            return

        error_event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": self.service_name,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "trace_id": get_trace_id() or getattr(record, "trace_id", None),
            "module": record.module,
            "line": record.lineno,
            "exception": self.format(record) if record.exc_info else None,
        }

        for listener in _monitoring_error_listeners:
            try:
                listener(error_event)
            except Exception:
                pass


def log_prediction(
    logger: logging.Logger,
    features: Dict[str, Any],
    output_scores: Dict[str, Any],
    model_version: str = "1.0.0",
    service: str = "ai-service",
    latency_ms: Optional[float] = None,
    prediction_id: Optional[str] = None,
) -> None:
    """
    Standardized utility function to record structured AI prediction logs.

    :param logger: Logger instance
    :param features: Dictionary of input features
    :param output_scores: Dictionary of output scores / predictions
    :param model_version: Semantic version of model weights used
    :param service: Name of AI microservice
    :param latency_ms: Inference execution duration in milliseconds
    :param prediction_id: Unique correlation ID for the prediction
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    pred_id = prediction_id or f"pred-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

    pred_data = {
        "prediction_id": pred_id,
        "timestamp": timestamp,
        "service": service,
        "model_version": model_version,
        "features": features,
        "output": output_scores,
        "latency_ms": latency_ms,
    }

    extra_fields = {
        "prediction_data": pred_data,
        "model_version": model_version,
        "prediction_id": pred_id,
        "latency_ms": latency_ms,
    }

    logger.info(
        f"Prediction complete [ID: {pred_id}] [Model: {model_version}] [Latency: {latency_ms or 0:.2f}ms]",
        extra=extra_fields,
    )


def get_logger(
    name: str = "ir_ai",
    service_name: Optional[str] = None,
    level: Optional[str] = None,
    log_dir: Optional[str] = None,
    as_json: Optional[bool] = None,
    enable_daily_rotation: bool = True,
) -> logging.Logger:
    """
    Factory function to retrieve or create a configured logger instance.

    :param name: Logger module name (typically __name__)
    :param service_name: Optional application name (defaults to ENV or 'ir-ai')
    :param level: Log level string ("DEBUG", "INFO", "WARNING", "ERROR")
    :param log_dir: Optional directory for file log outputs
    :param as_json: Force JSON or text formatting (defaults to LOG_FORMAT env var)
    :param enable_daily_rotation: Enable daily TimedRotatingFileHandler with gzip compression
    """
    logger = logging.getLogger(name)

    # Avoid duplicate handlers if already configured
    if logger.handlers:
        return logger

    resolved_service = service_name or os.getenv("SERVICE_NAME", "ir-ai")
    log_level_str = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    log_level = getattr(logging, log_level_str, logging.INFO)
    logger.setLevel(log_level)

    format_is_json = as_json if as_json is not None else (os.getenv("LOG_FORMAT", "text").lower() == "json")

    # 1. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    if format_is_json:
        console_handler.setFormatter(JsonFormatter(service_name=resolved_service))
    else:
        console_handler.setFormatter(TextFormatter())
    logger.addHandler(console_handler)

    # 2. Daily Rotating Compressed File Handler
    target_log_dir = log_dir or os.getenv("LOG_DIR")
    if not target_log_dir:
        # Default to /ai-models/logs
        default_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
        target_log_dir = default_dir

    if target_log_dir:
        try:
            os.makedirs(target_log_dir, exist_ok=True)
            log_file_path = os.path.join(target_log_dir, f"{resolved_service}.log")

            if enable_daily_rotation:
                file_handler = CompressedDailyRotatingFileHandler(
                    log_file_path,
                    when="midnight",
                    interval=1,
                    backupCount=30,
                    encoding="utf-8",
                )
            else:
                file_handler = logging.handlers.RotatingFileHandler(
                    log_file_path,
                    maxBytes=50 * 1024 * 1024,
                    backupCount=10,
                    encoding="utf-8",
                )

            file_handler.setLevel(log_level)
            file_handler.setFormatter(JsonFormatter(service_name=resolved_service))
            logger.addHandler(file_handler)
        except Exception as err:
            logger.warning(f"Failed to initialize rotating file handler at {target_log_dir}: {err}")

    # 3. Monitoring Dispatch Handler for ERROR & CRITICAL events
    dispatch_handler = MonitoringDispatchHandler(service_name=resolved_service)
    logger.addHandler(dispatch_handler)

    # Prevent duplicate console propagation
    logger.propagate = False
    return logger
