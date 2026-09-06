"""
models.py
─────────────────────────────────────────────────────────────────────────────
Common domain models and data schemas for Indian Railways AI services.
Contains Defect, PriorityResult, TrafficSlot, WorkBundle, BlockSchedule,
DefectRecord, SectionRecord, BlockWindowRecord, GangRecord, and dictionary conversion helpers.
─────────────────────────────────────────────────────────────────────────────
"""

from dataclasses import dataclass, field, asdict, is_dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from .utils import coerce_iso_date


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────
class DefectSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Department(str, Enum):
    CIVIL = "CIVIL"                # Track / P-Way / Engineering
    TRD_OHE = "TRD_OHE"            # Traction Distribution / Overhead Equipment
    SIGNALLING = "SIGNALLING"      # S&T / Interlocking
    ROLLING_STOCK = "ROLLING_STOCK"


class DefectSource(str, Enum):
    USFD = "USFD"                  # Ultrasonic Flaw Detection
    TRC = "TRC"                    # Track Recording Car
    OMS = "OMS"                    # Oscillation Monitoring System
    ITMS = "ITMS"                  # Integrated Track Monitoring System
    PATROL = "PATROL"              # Foot patrol / Keyman report
    DRONE = "DRONE"                # Aerial inspection
    MANUAL = "MANUAL"              # Station master / Driver / Guard report


class BlockStatus(str, Enum):
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


# ─────────────────────────────────────────────────────────────────────────────
# Requested Dataclasses
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class Defect:
    """Represents a maintenance defect or work order."""

    defect_id: str
    department: str
    section_id: str
    asset_type: str
    severity: str = "MEDIUM"
    reported_at: Optional[Union[str, datetime]] = None
    detection_method: str = "MANUAL"
    requires_traffic_block: bool = True
    estimated_work_minutes: int = 60
    location_criticality: float = 50.0
    priority_score: Optional[float] = None
    priority_category: Optional[str] = None
    priority_explanation: Optional[Union[str, Dict[str, Any]]] = None

    def __post_init__(self):
        if self.reported_at is not None:
            self.reported_at = coerce_iso_date(self.reported_at)
        else:
            self.reported_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if isinstance(self.reported_at, datetime):
            data["reported_at"] = self.reported_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Defect":
        copied = dict(data)
        if "reported_at" in copied:
            copied["reported_at"] = coerce_iso_date(copied["reported_at"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class PriorityResult:
    """Represents the output evaluation of defect priority scoring."""

    defect_id: str
    priority_score: float
    priority_category: str
    priority_name: str
    features: Dict[str, float] = field(default_factory=dict)
    explanation: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[Union[str, datetime]] = None

    def __post_init__(self):
        if self.timestamp is not None:
            self.timestamp = coerce_iso_date(self.timestamp)
        else:
            self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if isinstance(self.timestamp, datetime):
            data["timestamp"] = self.timestamp.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PriorityResult":
        copied = dict(data)
        if "timestamp" in copied:
            copied["timestamp"] = coerce_iso_date(copied["timestamp"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class TrafficSlot:
    """Represents an analyzed track possession window candidate."""

    section_id: str
    start_time: Union[str, datetime]
    end_time: Union[str, datetime]
    duration_minutes: int
    traffic_impact_score: float = 0.0
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    feasibility: str = "HIGH_FEASIBILITY"
    overall_score: float = 80.0

    def __post_init__(self):
        self.start_time = coerce_iso_date(self.start_time) or datetime.now(timezone.utc)
        self.end_time = coerce_iso_date(self.end_time) or self.start_time

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if isinstance(self.start_time, datetime):
            data["start_time"] = self.start_time.isoformat()
        if isinstance(self.end_time, datetime):
            data["end_time"] = self.end_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrafficSlot":
        copied = dict(data)
        if "start_time" in copied:
            copied["start_time"] = coerce_iso_date(copied["start_time"])
        if "end_time" in copied:
            copied["end_time"] = coerce_iso_date(copied["end_time"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class WorkBundle:
    """Represents a multi-task maintenance bundle grouped by section."""

    bundle_id: str
    section_id: str
    tasks: List[Dict[str, Any]] = field(default_factory=list)
    total_duration: int = 120
    departments: List[str] = field(default_factory=list)
    bundling_score: float = 75.0
    benefits: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkBundle":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class BlockSchedule:
    """Represents a scheduled track maintenance possession."""

    schedule_id: str
    section_id: str
    start_time: Union[str, datetime]
    end_time: Union[str, datetime]
    tasks: List[Dict[str, Any]] = field(default_factory=list)
    departments: List[str] = field(default_factory=list)
    total_duration: int = 120
    traffic_impact_score: float = 15.0
    feasibility: str = "HIGH_FEASIBILITY"
    created_at: Optional[Union[str, datetime]] = None

    def __post_init__(self):
        self.start_time = coerce_iso_date(self.start_time) or datetime.now(timezone.utc)
        self.end_time = coerce_iso_date(self.end_time) or self.start_time
        if self.created_at is not None:
            self.created_at = coerce_iso_date(self.created_at)
        else:
            self.created_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if isinstance(self.start_time, datetime):
            data["start_time"] = self.start_time.isoformat()
        if isinstance(self.end_time, datetime):
            data["end_time"] = self.end_time.isoformat()
        if isinstance(self.created_at, datetime):
            data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BlockSchedule":
        copied = dict(data)
        if "start_time" in copied:
            copied["start_time"] = coerce_iso_date(copied["start_time"])
        if "end_time" in copied:
            copied["end_time"] = coerce_iso_date(copied["end_time"])
        if "created_at" in copied:
            copied["created_at"] = coerce_iso_date(copied["created_at"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


# ─────────────────────────────────────────────────────────────────────────────
# Backward-Compatible Legacy Dataclasses
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class DefectRecord:
    defect_id: str
    section_id: str
    asset_id: str
    asset_type: str
    department: str
    chainage_km: float
    severity: str = DefectSeverity.MEDIUM.value
    source: str = DefectSource.MANUAL.value
    detected_at: Optional[datetime] = None
    sla_deadline: Optional[datetime] = None
    description: str = ""
    status: str = "OPEN"
    flaw_code: Optional[str] = None
    track_quality_index: Optional[float] = None
    speed_restriction_kmh: Optional[int] = None
    priority_score: Optional[float] = None
    predicted_failure_risk: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.detected_at is not None:
            self.detected_at = coerce_iso_date(self.detected_at)
        else:
            self.detected_at = datetime.now(timezone.utc)
        if self.sla_deadline is not None:
            self.sla_deadline = coerce_iso_date(self.sla_deadline)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.detected_at:
            data["detected_at"] = self.detected_at.isoformat()
        if self.sla_deadline:
            data["sla_deadline"] = self.sla_deadline.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DefectRecord":
        copied = dict(data)
        if "detected_at" in copied:
            copied["detected_at"] = coerce_iso_date(copied["detected_at"])
        if "sla_deadline" in copied:
            copied["sla_deadline"] = coerce_iso_date(copied["sla_deadline"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class SectionRecord:
    section_id: str
    division: str
    zone: str
    start_station: str
    end_station: str
    start_km: float
    end_km: float
    track_count: int = 2
    electrified: bool = True
    max_permissible_speed_kmh: int = 130
    traffic_density_gmt: float = 40.0
    trains_per_day_avg: int = 80
    current_tqi: float = 75.0
    active_speed_restrictions: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def length_km(self) -> float:
        return abs(self.end_km - self.start_km)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["length_km"] = self.length_km
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SectionRecord":
        copied = dict(data)
        copied.pop("length_km", None)
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class BlockWindowRecord:
    window_id: str
    section_id: str
    department: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    start_km: float
    end_km: float
    block_type: str = "SHADOW"
    status: str = BlockStatus.REQUESTED.value
    work_order_ids: List[str] = field(default_factory=list)
    assigned_gang_ids: List[str] = field(default_factory=list)
    assigned_equipment_ids: List[str] = field(default_factory=list)
    impacted_trains_count: int = 0
    estimated_total_delay_min: float = 0.0
    optimisation_score: Optional[float] = None
    created_at: Optional[datetime] = None

    def __post_init__(self):
        self.start_time = coerce_iso_date(self.start_time) or datetime.now(timezone.utc)
        self.end_time = coerce_iso_date(self.end_time) or self.start_time
        if not self.duration_minutes and self.end_time > self.start_time:
            self.duration_minutes = int((self.end_time - self.start_time).total_seconds() / 60)
        if self.created_at is not None:
            self.created_at = coerce_iso_date(self.created_at)
        else:
            self.created_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["start_time"] = self.start_time.isoformat()
        data["end_time"] = self.end_time.isoformat()
        if self.created_at:
            data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BlockWindowRecord":
        copied = dict(data)
        if "start_time" in copied:
            copied["start_time"] = coerce_iso_date(copied["start_time"])
        if "end_time" in copied:
            copied["end_time"] = coerce_iso_date(copied["end_time"])
        if "created_at" in copied:
            copied["created_at"] = coerce_iso_date(copied["created_at"])
        return cls(**{k: v for k, v in copied.items() if k in cls.__dataclass_fields__})


@dataclass
class GangRecord:
    gang_id: str
    department: str
    base_station: str
    crew_count: int
    supervisor_name: str
    contact_number: str = ""
    is_available: bool = True
    current_section_id: Optional[str] = None
    certifications: List[str] = field(default_factory=list)
    max_continuous_work_hours: int = 6
    min_rest_hours_between_shifts: int = 10
    specialization: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GangRecord":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions for Object Conversion
# ─────────────────────────────────────────────────────────────────────────────
def model_to_dict(obj: Any) -> Any:
    """
    Recursively converts a model, dataclass instance, list, or dict into a pure dictionary.
    Handles ISO datetime serialization automatically.
    """
    if obj is None:
        return None

    if hasattr(obj, "to_dict") and callable(obj.to_dict):
        return obj.to_dict()

    if is_dataclass(obj) and not isinstance(obj, type):
        result = {}
        for key, val in asdict(obj).items():
            if isinstance(val, datetime):
                result[key] = val.isoformat()
            elif isinstance(val, (list, tuple)):
                result[key] = [model_to_dict(item) for item in val]
            elif isinstance(val, dict):
                result[key] = {k: model_to_dict(v) for k, v in val.items()}
            else:
                result[key] = val
        return result

    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, (list, tuple)):
        return [model_to_dict(item) for item in obj]

    if isinstance(obj, dict):
        return {k: model_to_dict(v) for k, v in obj.items()}

    return obj


# Alias helper
to_dict = model_to_dict
as_dict = model_to_dict
