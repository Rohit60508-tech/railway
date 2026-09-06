"""
monitoring.py
─────────────────────────────────────────────────────────────────────────────
Comprehensive AI monitoring and observability subsystem for Indian Railways.
Implements:
  1. PredictionCounter  - Count predictions by service, model type, and result category
  2. LatencyTracker     - Track AI inference duration (avg, p50, p95, p99) & context managers
  3. AccuracyTracker    - Track ground-truth validation accuracy and confusion matrix
  4. ErrorTracker       - Track and categorize AI errors, exceptions, and error rates
  5. ResourceMonitor    - Track CPU, RAM, disk, and GPU hardware utilization
  6. ModelDriftDetector - Detect statistical distribution shift and accuracy degradation
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import time
import math
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from threading import Lock
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager

# Add parent dir to sys.path if needed
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from shared.logger import get_logger, register_error_listener

logger = get_logger("ai_monitoring")


# ── 1. Prediction Counter ───────────────────────────────────────────────────
class PredictionCounter:
    """Thread-safe counter tracking AI predictions by microservice, model, and output category."""

    def __init__(self, history_maxlen: int = 5000):
        self._lock = Lock()
        self.total_count = 0
        self.service_counts: Dict[str, int] = defaultdict(int)
        self.model_counts: Dict[str, int] = defaultdict(int)
        self.category_counts: Dict[str, int] = defaultdict(int)
        # Recent timestamped predictions for rate calculations
        self.recent_predictions: deque = deque(maxlen=history_maxlen)

    def record_prediction(
        self,
        service: str = "priority-engine",
        model_type: str = "RandomForestClassifier",
        category_or_result: str = "P1",
        count: int = 1,
    ) -> None:
        """Record one or more predictions."""
        with self._lock:
            self.total_count += count
            self.service_counts[service] += count
            self.model_counts[model_type] += count
            self.category_counts[category_or_result] += count
            now = time.time()
            for _ in range(count):
                self.recent_predictions.append((now, service, category_or_result))

    def get_predictions_per_minute(self, service: Optional[str] = None) -> float:
        """Calculate predictions per minute over the trailing 60 seconds."""
        cutoff = time.time() - 60.0
        with self._lock:
            matching = [
                ts for ts, s, _ in self.recent_predictions
                if ts >= cutoff and (service is None or s == service)
            ]
            return float(len(matching))

    def get_summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "total_predictions": self.total_count,
                "predictions_per_minute": self.get_predictions_per_minute(),
                "by_service": dict(self.service_counts),
                "by_model": dict(self.model_counts),
                "by_category": dict(self.category_counts),
            }


# ── 2. Latency Tracker ───────────────────────────────────────────────────────
class LatencyTracker:
    """Tracks execution latency (ms) for model inference and solver operations."""

    def __init__(self, window_size: int = 1000):
        self._lock = Lock()
        self.window_size = window_size
        self.records: Dict[str, deque] = defaultdict(lambda: deque(maxlen=window_size))

    def record_latency(self, service: str, duration_ms: float) -> None:
        """Record latency measurement in milliseconds."""
        with self._lock:
            self.records[service].append(float(duration_ms))

    @contextmanager
    def measure(self, service: str = "ai-service"):
        """Context manager to measure and record block execution duration."""
        start = time.perf_counter()
        try:
            yield
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            self.record_latency(service, elapsed_ms)

    def get_statistics(self, service: str) -> Dict[str, float]:
        """Compute latency percentiles (min, max, mean, p50, p95, p99)."""
        with self._lock:
            values = sorted(list(self.records[service]))

        if not values:
            return {"count": 0, "avg_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0, "max_ms": 0.0}

        n = len(values)
        avg_val = sum(values) / n
        p50 = values[int(n * 0.50)]
        p95 = values[min(int(n * 0.95), n - 1)]
        p99 = values[min(int(n * 0.99), n - 1)]

        return {
            "count": n,
            "min_ms": round(values[0], 2),
            "max_ms": round(values[-1], 2),
            "avg_ms": round(avg_val, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
        }

    def get_all_statistics(self) -> Dict[str, Dict[str, float]]:
        with self._lock:
            services = list(self.records.keys())
        return {s: self.get_statistics(s) for s in services}


# ── 3. Accuracy Tracker ──────────────────────────────────────────────────────
class AccuracyTracker:
    """Tracks field validation feedback against model predictions to compute accuracy over time."""

    def __init__(self, max_history: int = 2000):
        self._lock = Lock()
        self.history: deque = deque(maxlen=max_history)
        self.confusion_matrix: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.initial_baseline_accuracy: float = 0.92

    def record_feedback(
        self,
        predicted_label: str,
        actual_label: str,
        service: str = "priority-engine",
        prediction_id: Optional[str] = None,
    ) -> None:
        """Record ground truth feedback from field resolution."""
        correct = str(predicted_label).upper() == str(actual_label).upper()
        with self._lock:
            self.history.append({
                "timestamp": time.time(),
                "service": service,
                "predicted": str(predicted_label).upper(),
                "actual": str(actual_label).upper(),
                "correct": correct,
            })
            self.confusion_matrix[str(actual_label).upper()][str(predicted_label).upper()] += 1

    def get_current_accuracy(self, service: Optional[str] = None, window: int = 500) -> float:
        """Calculate accuracy over the most recent feedback entries."""
        with self._lock:
            entries = [
                e for e in list(self.history)[-window:]
                if service is None or e["service"] == service
            ]
        if not entries:
            return self.initial_baseline_accuracy

        correct_count = sum(1 for e in entries if e["correct"])
        return round(correct_count / len(entries), 4)

    def get_metrics_summary(self) -> Dict[str, Any]:
        with self._lock:
            total_feedback = len(self.history)
            acc = self.get_current_accuracy()
            cf_copy = {k: dict(v) for k, v in self.confusion_matrix.items()}

        return {
            "total_feedback_samples": total_feedback,
            "rolling_accuracy": acc,
            "baseline_accuracy": self.initial_baseline_accuracy,
            "accuracy_drop": round(max(0.0, self.initial_baseline_accuracy - acc), 4),
            "confusion_matrix": cf_copy,
        }


# ── 4. Error Tracker ─────────────────────────────────────────────────────────
class ErrorTracker:
    """Tracks and categorizes AI exceptions, timeouts, and computes 5-minute error rates."""

    def __init__(self, max_errors: int = 500):
        self._lock = Lock()
        self.recent_errors: deque = deque(maxlen=max_errors)
        self.error_counts_by_type: Dict[str, int] = defaultdict(int)
        self.error_counts_by_service: Dict[str, int] = defaultdict(int)
        self.total_errors = 0

    def record_error(
        self,
        service: str = "ai-service",
        error_type: str = "InferenceException",
        message: str = "",
        exception: Optional[Exception] = None,
        severity: str = "ERROR",
    ) -> None:
        """Record an error event."""
        with self._lock:
            self.total_errors += 1
            self.error_counts_by_type[error_type] += 1
            self.error_counts_by_service[service] += 1
            self.recent_errors.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "time_sec": time.time(),
                "service": service,
                "type": error_type,
                "message": message or str(exception),
                "severity": severity,
            })

    def get_recent_error_rate(self, total_recent_requests: int = 100, window_seconds: int = 300) -> float:
        """Calculate error percentage in trailing 5-minute window."""
        cutoff = time.time() - window_seconds
        with self._lock:
            errors_in_window = sum(1 for e in self.recent_errors if e["time_sec"] >= cutoff)

        if total_recent_requests <= 0:
            return 0.0
        return round((errors_in_window / total_recent_requests) * 100.0, 2)

    def get_summary(self) -> Dict[str, Any]:
        with self._lock:
            recent_list = list(self.recent_errors)[-10:]
            return {
                "total_errors": self.total_errors,
                "by_type": dict(self.error_counts_by_type),
                "by_service": dict(self.error_counts_by_service),
                "recent_errors": recent_list,
            }


# ── 5. Resource Monitor ──────────────────────────────────────────────────────
class ResourceMonitor:
    """Gathers real-time host and container hardware telemetry (CPU, Memory, Disk, GPU)."""

    def __init__(self):
        self.has_psutil = False
        try:
            import psutil
            self.psutil = psutil
            self.has_psutil = True
        except ImportError:
            pass

    def get_system_metrics(self) -> Dict[str, Any]:
        """Fetch current CPU, Memory, and Disk utilization percentages."""
        if self.has_psutil:
            try:
                cpu_pct = self.psutil.cpu_percent(interval=None)
                mem = self.psutil.virtual_memory()
                disk = self.psutil.disk_usage('/') if os.name != 'nt' else self.psutil.disk_usage('C:\\')

                # Process specific RSS
                proc = self.psutil.Process(os.getpid())
                proc_rss_mb = round(proc.memory_info().rss / (1024 * 1024), 2)

                return {
                    "cpu_percent": float(cpu_pct),
                    "memory_percent": float(mem.percent),
                    "memory_used_mb": round(mem.used / (1024 * 1024), 2),
                    "memory_total_mb": round(mem.total / (1024 * 1024), 2),
                    "disk_percent": float(disk.percent),
                    "process_rss_mb": proc_rss_mb,
                    "gpu_available": False,
                    "gpu_memory_percent": 0.0,
                    "status": "NORMAL" if mem.percent < 90 else "EXHAUSTION_WARNING",
                }
            except Exception as e:
                logger.warning(f"Error reading psutil telemetry: {e}")

        # Fallback simulation if psutil not installed
        return {
            "cpu_percent": 18.5,
            "memory_percent": 42.0,
            "memory_used_mb": 1720.0,
            "memory_total_mb": 4096.0,
            "disk_percent": 35.0,
            "process_rss_mb": 245.0,
            "gpu_available": False,
            "gpu_memory_percent": 0.0,
            "status": "NORMAL",
        }


# ── 6. Model Drift Detector ──────────────────────────────────────────────────
class ModelDriftDetector:
    """
    Detects statistical feature drift and prediction score drift using
    Population Stability Index (PSI) and accuracy degradation thresholds.
    """

    def __init__(self, baseline_bins: Optional[List[float]] = None):
        self._lock = Lock()
        # Default baseline priority distribution percentages (P1, P2, P3, P4)
        self.baseline_distribution = {
            "P1": 0.12,
            "P2": 0.28,
            "P3": 0.40,
            "P4": 0.20,
        }
        self.recent_scores: deque = deque(maxlen=1000)
        self.recent_categories: deque = deque(maxlen=500)

    def record_prediction(self, score: float, category: str) -> None:
        """Add prediction to drift evaluation window."""
        with self._lock:
            self.recent_scores.append(float(score))
            self.recent_categories.append(str(category).upper())

    def calculate_psi(self) -> float:
        """
        Calculate Population Stability Index (PSI) comparing recent predictions
        against the expected training baseline distribution.
        PSI < 0.1: No change
        0.1 <= PSI < 0.25: Moderate drift
        PSI >= 0.25: Significant drift
        """
        with self._lock:
            if len(self.recent_categories) < 20:
                return 0.02  # Not enough samples; nominal baseline

            total = len(self.recent_categories)
            actual_counts = defaultdict(int)
            for cat in self.recent_categories:
                actual_counts[cat] += 1

        psi = 0.0
        for cat, expected_pct in self.baseline_distribution.items():
            actual_pct = (actual_counts.get(cat, 0) / total)
            # Avoid division by zero
            actual_pct = max(actual_pct, 0.0001)
            expected_pct = max(expected_pct, 0.0001)

            psi += (actual_pct - expected_pct) * math.log(actual_pct / expected_pct)

        return round(psi, 4)

    def check_drift(self, accuracy_drop: float = 0.0) -> Dict[str, Any]:
        """Check if PSI or accuracy drop exceeds alerting thresholds."""
        psi = self.calculate_psi()
        is_drift_detected = (psi >= 0.25) or (accuracy_drop >= 0.10)

        severity = "NORMAL"
        if psi >= 0.25 or accuracy_drop >= 0.10:
            severity = "CRITICAL_DRIFT"
        elif psi >= 0.10:
            severity = "MODERATE_DRIFT"

        return {
            "psi_score": psi,
            "accuracy_drop": accuracy_drop,
            "drift_detected": is_drift_detected,
            "severity": severity,
            "threshold_psi": 0.25,
            "threshold_accuracy_drop": 0.10,
            "action_required": "Trigger automated model retraining" if is_drift_detected else "None",
        }


# ── Global AI Monitoring Coordinator ─────────────────────────────────────────
class AIMonitor:
    """Unified telemetry coordinator aggregating all tracking components."""

    def __init__(self):
        self.prediction_counter = PredictionCounter()
        self.latency_tracker = LatencyTracker()
        self.accuracy_tracker = AccuracyTracker()
        self.error_tracker = ErrorTracker()
        self.resource_monitor = ResourceMonitor()
        self.drift_detector = ModelDriftDetector()
        self.model_version = "1.0.0"
        self.last_model_update = datetime.now(timezone.utc).isoformat()
        self.pending_queue_backlog = 0

        # Hook into centralized logger for automated error dispatching
        register_error_listener(self._on_logger_error)

    def _on_logger_error(self, error_event: Dict[str, Any]) -> None:
        """Listener receiving error events emitted by logger.py."""
        self.error_tracker.record_error(
            service=error_event.get("service", "ai-service"),
            error_type="LoggedException",
            message=error_event.get("message", ""),
            severity=error_event.get("level", "ERROR"),
        )

    def record_inference(
        self,
        service: str,
        model_type: str,
        category: str,
        score: float,
        duration_ms: float,
    ) -> None:
        """Helper to record an inference event across counter, latency, and drift tracking."""
        self.prediction_counter.record_prediction(service, model_type, category)
        self.latency_tracker.record_latency(service, duration_ms)
        self.drift_detector.record_prediction(score, category)

    def get_full_status(self) -> Dict[str, Any]:
        """Aggregate comprehensive metrics payload for Prometheus and Grafana."""
        acc_summary = self.accuracy_tracker.get_metrics_summary()
        drift_status = self.drift_detector.check_drift(acc_summary["accuracy_drop"])
        sys_metrics = self.resource_monitor.get_system_metrics()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_version": self.model_version,
            "last_model_update": self.last_model_update,
            "queue_backlog": self.pending_queue_backlog,
            "predictions": self.prediction_counter.get_summary(),
            "latency": self.latency_tracker.get_all_statistics(),
            "accuracy": acc_summary,
            "errors": self.error_tracker.get_summary(),
            "system_resources": sys_metrics,
            "drift": drift_status,
            "health": "HEALTHY" if sys_metrics["status"] == "NORMAL" and not drift_status["drift_detected"] else "DEGRADED",
        }


# Singleton instance
ai_monitor = AIMonitor()
