"""
base_agent.py
─────────────────────────────────────────────────────────────────────────────
Base Railway Agent Abstract Framework for Indian Railways Swarm System
─────────────────────────────────────────────────────────────────────────────
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import time
from typing import Any, Dict, Optional


class BaseRailwayAgent(ABC):
    """
    Abstract Base Class for all Indian Railways specialized AI/ML & LLM Agents.
    Standardizes telemetry, execution lifecycle, schema contract, and error boundaries.
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        need: str,
        method: str,
        practical_rationale: str,
        version: str = "1.0.0"
    ):
        self.agent_id = agent_id
        self.name = name
        self.need = need
        self.method = method
        self.practical_rationale = practical_rationale
        self.version = version

    @abstractmethod
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Agent-specific execution logic. Must be implemented by concrete subclass.
        """
        pass

    def run(self, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Lifecycle wrapper: validates input, records timing, captures exceptions,
        and returns standard swarm agent response schema.
        """
        if payload is None:
            payload = {}

        t0 = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()

        try:
            result = self.execute(payload)
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "agent_id": self.agent_id,
                "name": self.name,
                "need": self.need,
                "method": self.method,
                "practical_rationale": self.practical_rationale,
                "version": self.version,
                "status": "SUCCESS",
                "execution_time_ms": elapsed_ms,
                "timestamp": timestamp,
                "result": result
            }
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "agent_id": self.agent_id,
                "name": self.name,
                "need": self.need,
                "method": self.method,
                "practical_rationale": self.practical_rationale,
                "version": self.version,
                "status": "ERROR",
                "execution_time_ms": elapsed_ms,
                "timestamp": timestamp,
                "error": str(exc),
                "result": None
            }

    def get_info(self) -> Dict[str, Any]:
        """Returns agent metadata for dashboard discovery."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "need": self.need,
            "method": self.method,
            "practical_rationale": self.practical_rationale,
            "version": self.version
        }
