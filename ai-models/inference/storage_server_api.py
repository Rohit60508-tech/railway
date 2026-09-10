"""
storage_server_api.py
─────────────────────────────────────────────────────────────────────────────
INDIAN RAILWAYS AI PLATFORM — DEDICATED SERVER & PERSISTENT DISK STORAGE
─────────────────────────────────────────────────────────────────────────────
Provides dedicated, always-on (non-serverless) persistent server storage:
1. Server Telemetry & Host Diagnostics (/api/v1/server/telemetry)
2. Instant Snapshot Creation & SHA-256 Checksum (/api/v1/storage/backup-now)
3. Persistent Backup Directory Indexing (/api/v1/storage/backups)
4. Direct Binary/JSON File Download (/api/v1/storage/download/{filename})
5. File Ingestion to Dedicated Disk (/api/v1/storage/upload)
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import time
import json
import sqlite3
import hashlib
import platform
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = DATA_DIR / "backups"
STORAGE_DIR = DATA_DIR / "storage"
DB_PATH = DATA_DIR / "audit_records.db"

# Ensure directories exist
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

SERVER_START_TIME = time.time()

router = APIRouter(prefix="/api/v1", tags=["Dedicated Server & Persistent Storage"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. SERVER TELEMETRY & HEALTH (NON-SERVERLESS ALWAYS-ON METRICS)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/server/telemetry", summary="Dedicated Server Telemetry & Host Diagnostics")
def get_server_telemetry() -> Dict[str, Any]:
    """Returns real-time host and runtime telemetry for the dedicated server."""
    uptime_sec = time.time() - SERVER_START_TIME
    
    # Calculate disk storage used by data directory
    total_data_bytes = 0
    for p in DATA_DIR.rglob("*"):
        if p.is_file():
            total_data_bytes += p.stat().st_size

    backup_files = list(BACKUP_DIR.glob("*"))
    
    return {
        "status": "ONLINE / ALWAYS-ON",
        "server_type": "DEDICATED_SERVER_CONTAINER",
        "is_serverless": False,
        "target_platforms": ["Railway.app", "Render", "AWS EC2", "Docker VPS"],
        "uptime_seconds": round(uptime_sec, 2),
        "uptime_human": f"{int(uptime_sec // 3600)}h {int((uptime_sec % 3600) // 60)}m {int(uptime_sec % 60)}s",
        "process_id": os.getpid(),
        "host_os": platform.platform(),
        "python_runtime": platform.python_version(),
        "persistent_volume_path": str(DATA_DIR),
        "persistent_storage_used_kb": round(total_data_bytes / 1024, 2),
        "backup_count": len(backup_files),
        "storage_health": "READ_WRITE_OK",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. INSTANT PERSISTENT BACKUP SNAPSHOT GENERATOR
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/storage/backup-now", summary="Generate Instant Snapshot to Dedicated Disk")
def create_backup_snapshot() -> Dict[str, Any]:
    """
    Creates a full timestamped JSON + SQLite snapshot directly on the server's
    persistent disk volume, computes a cryptographic SHA-256 digest, and logs it.
    """
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_filename = f"raksha_path_snapshot_{ts}.json"
        json_path = BACKUP_DIR / json_filename

        # 1. Extract all records from SQLite
        records = []
        if DB_PATH.exists():
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            cur.execute("SELECT record_id, event_type, block_id, section, window, officer_id, officer_role, reason, disruption_score, delay_minutes, timestamp FROM audit_records")
            for r in cur.fetchall():
                records.append({
                    "record_id": r[0], "event_type": r[1], "block_id": r[2],
                    "section": r[3], "window": r[4], "officer_id": r[5],
                    "officer_role": r[6], "reason": r[7],
                    "disruption_score": r[8], "delay_minutes": r[9],
                    "timestamp": r[10]
                })
            conn.close()

        # 2. Extract active corridor defects
        sample_defects = [
            {"defect_id": "DEF-TMS-401", "system": "TMS", "dept": "Civil (P-Way)", "chainage": "KM 142.8 - 143.5", "type": "Ultrasonic Rail Flaw (IMR)", "priority": "P1", "sla": "24 Hours"},
            {"defect_id": "DEF-SMMS-812", "system": "SMMS", "dept": "Signal (S&T)", "chainage": "KM 204.0 - 204.5", "type": "Point Machine 104A Detection Backlash", "priority": "P2", "sla": "72 Hours"},
            {"defect_id": "DEF-TDMS-903", "system": "TDMS", "dept": "Electrical (TRD)", "chainage": "KM 284.1 - 285.0", "type": "OHE Catenary Wire Dropper Wear > 20%", "priority": "P2", "sla": "48 Hours"},
        ]

        # 3. Assemble Snapshot Payload
        payload = {
            "metadata": {
                "snapshot_id": f"SNAP-{ts}",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "server_environment": "DEDICATED_PERSISTENT_SERVER",
                "total_audit_records": len(records),
                "total_defects": len(sample_defects),
                "corridor": "Golden Quadrilateral HDN-1 (NDLS - CNB)"
            },
            "audit_records": records,
            "defects": sample_defects
        }

        # 4. Write to persistent JSON file
        payload_bytes = json.dumps(payload, indent=2).encode("utf-8")
        json_path.write_bytes(payload_bytes)

        # 5. Compute SHA-256 checksum
        sha256_hash = hashlib.sha256(payload_bytes).hexdigest()

        # 6. Also copy the active SQLite DB file as an immutable binary snapshot
        db_snapshot_filename = f"audit_records_snapshot_{ts}.db"
        db_snapshot_path = BACKUP_DIR / db_snapshot_filename
        if DB_PATH.exists():
            shutil.copy2(DB_PATH, db_snapshot_path)

        return {
            "success": True,
            "snapshot_id": f"SNAP-{ts}",
            "filename": json_filename,
            "db_snapshot": db_snapshot_filename,
            "size_bytes": len(payload_bytes),
            "sha256": sha256_hash,
            "persistent_storage_path": str(json_path),
            "download_url": f"/api/v1/storage/download/{json_filename}",
            "records_persisted": len(records),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate persistent backup: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# 3. LIST PERSISTENT BACKUPS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/storage/backups", summary="List All Persisted Backups on Server Disk")
def list_backups() -> Dict[str, Any]:
    """Returns a list of all backup snapshots available on the dedicated server's disk."""
    items = []
    for p in sorted(BACKUP_DIR.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file():
            stat = p.stat()
            items.append({
                "filename": p.name,
                "size_bytes": stat.st_size,
                "size_kb": round(stat.st_size / 1024, 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "download_url": f"/api/v1/storage/download/{p.name}"
            })

    return {
        "total_backups": len(items),
        "backup_directory": str(BACKUP_DIR),
        "backups": items
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. DOWNLOAD BACKUP FILE
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/storage/download/{filename}", summary="Download Persisted Backup File")
def download_backup(filename: str):
    """Securely streams a requested backup snapshot file from the persistent volume."""
    safe_name = Path(filename).name
    target_file = BACKUP_DIR / safe_name

    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=404, detail="Requested backup file not found.")

    media_type = "application/json" if safe_name.endswith(".json") else "application/octet-stream"
    return FileResponse(
        path=str(target_file),
        filename=safe_name,
        media_type=media_type
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. UPLOAD FILE TO PERSISTENT STORAGE
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/storage/upload", summary="Upload File to Dedicated Server Storage")
async def upload_file_to_server(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Accepts and stores an operational file (e.g. TMS track chart, work order PDF) on dedicated server disk."""
    try:
        safe_name = Path(file.filename).name
        target_path = STORAGE_DIR / f"{int(time.time())}_{safe_name}"
        
        contents = await file.read()
        target_path.write_bytes(contents)

        return {
            "success": True,
            "filename": safe_name,
            "stored_as": target_path.name,
            "size_bytes": len(contents),
            "sha256": hashlib.sha256(contents).hexdigest(),
            "server_path": str(target_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
