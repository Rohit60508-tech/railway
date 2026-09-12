"""
agents_api.py
─────────────────────────────────────────────────────────────────────────────
FastAPI REST Endpoints for Indian Railways Multi-Agent AI Swarm
─────────────────────────────────────────────────────────────────────────────
"""

import json
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.orchestrator import orchestrator

router = APIRouter(prefix="/agents", tags=["AI Swarm Agents"])


class AgentRunRequest(BaseModel):
    payload: Optional[Dict[str, Any]] = None


class TriagePipelineRequest(BaseModel):
    text: Optional[str] = None
    image_uri: Optional[str] = None
    section_id: Optional[str] = "NDLS-CNB-01"
    severity_score: Optional[float] = 88.0
    line_speed_kmh: Optional[float] = 130.0
    annual_gmt: Optional[float] = 42.0
    oms_peak_g: Optional[float] = 0.38
    wear_depth_mm: Optional[float] = 6.5
    cumulative_gmt: Optional[float] = 390.0


class CustomTrainRequest(BaseModel):
    data: Any
    target_column: Optional[str] = None
    model_algorithm: Optional[str] = "RandomForest"
    save_schema: Optional[bool] = False


# ── Static Routes (Must precede dynamic /{agent_id} routes) ─────────────────

@router.get("")
async def list_all_agents():
    """Returns all 10 specialized Indian Railways AI agents and their capabilities."""
    return {
        "status": "SUCCESS",
        "total_agents": len(orchestrator.list_agents()),
        "agents": orchestrator.list_agents()
    }


@router.get("/custom-schema")
async def get_custom_schema():
    """Returns active user custom schema structure and sample template records."""
    from training.custom_data_trainer import load_custom_schema
    return {
        "status": "SUCCESS",
        "schema": load_custom_schema()
    }


@router.post("/custom-schema")
async def update_custom_schema(schema_payload: Dict[str, Any]):
    """Updates user-defined custom schema fields and target column."""
    from training.custom_data_trainer import save_custom_schema
    save_custom_schema(schema_payload)
    return {
        "status": "SUCCESS",
        "message": "Custom training schema updated successfully.",
        "schema": schema_payload
    }


@router.post("/train-custom")
async def train_with_custom_user_data(request: CustomTrainRequest):
    """Trains a model on arbitrary user-provided data structure, columns, and target."""
    from training.custom_data_trainer import AdaptiveCustomTrainer
    trainer = AdaptiveCustomTrainer()
    try:
        res = trainer.train(
            data_input=request.data,
            target_column=request.target_column,
            model_algorithm=request.model_algorithm or "RandomForest"
        )
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Custom training failed: {str(exc)}")


@router.get("/training-status")
async def get_training_status():
    """Returns the latest multi-agent training manifest and performance metrics."""
    manifest_path = Path(__file__).resolve().parent.parent / "agents" / "artifacts" / "swarm_training_manifest.json"
    if manifest_path.exists():
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading manifest: {e}")
    return {
        "status": "NOT_TRAINED",
        "message": "No previous training run found. Trigger POST /api/v1/agents/train-all to train all agents."
    }


@router.post("/train-all")
async def train_all_swarm_agents():
    """Triggers the full multi-agent swarm training pipeline across all 10 agents."""
    from training.train_all_agents import train_all_agents
    manifest = train_all_agents()
    return {
        "status": "SUCCESS",
        "message": f"All {manifest.get('trained_agents_count', 10)} agents trained successfully.",
        "manifest": manifest
    }


@router.post("/pipeline/triage")
async def run_triage_pipeline(request: TriagePipelineRequest):
    """Runs the collaborative multi-agent triage pipeline."""
    payload = request.dict(exclude_none=True)
    res = orchestrator.run_triage_pipeline(payload)
    return res


# ── Dynamic Routes Parameterized by {agent_id} ─────────────────────────────

@router.get("/{agent_id}")
async def get_agent_details(agent_id: str):
    """Returns metadata for a specific AI agent."""
    agent = orchestrator.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    return {
        "status": "SUCCESS",
        "agent": agent.get_info()
    }


@router.post("/{agent_id}/run")
async def run_single_agent(agent_id: str, request: Optional[AgentRunRequest] = None):
    """Executes a specific agent with provided payload or defaults."""
    payload = request.payload if request and request.payload else {}
    agent = orchestrator.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")

    res = agent.run(payload)
    return res


@router.post("/{agent_id}/train")
async def train_single_agent(agent_id: str):
    """Triggers training for a specific individual agent."""
    from training.train_all_agents import (
        train_defect_priority_agent,
        train_time_to_event_agent,
        train_traffic_forecast_agent,
        train_vision_defect_agent,
        train_ollama_llm_agents,
        train_anomaly_detection_agent,
        train_scheduling_agent,
        train_federated_learning_agent
    )
    dispatch = {
        "defect_priority_agent": train_defect_priority_agent,
        "time_to_event_risk_agent": train_time_to_event_agent,
        "traffic_forecast_agent": train_traffic_forecast_agent,
        "vision_defect_alert_agent": train_vision_defect_agent,
        "text_extraction_agent": train_ollama_llm_agents,
        "planner_qa_agent": train_ollama_llm_agents,
        "explanation_agent": train_ollama_llm_agents,
        "anomaly_detection_agent": train_anomaly_detection_agent,
        "scheduling_agent": train_scheduling_agent,
        "federated_learning_agent": train_federated_learning_agent
    }
    fn = dispatch.get(agent_id)
    if not fn:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' does not support standalone training.")
    res = fn()
    return {
        "status": "SUCCESS",
        "agent_id": agent_id,
        "training_result": res
    }
