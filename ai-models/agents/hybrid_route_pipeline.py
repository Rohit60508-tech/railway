"""
hybrid_route_pipeline.py
─────────────────────────────────────────────────────────────────────────────
Hybrid AI Pipeline for Indian Railways:
  1. Tabular Model (XGBoost): Predicts accurate physical delay minutes for each route.
  2. Language Model (Groq Llama-3.3 / Fine-tuned LoRA): Performs dispatch reasoning & trade-offs.
  3. Pydantic Engine: Guarantees verified, strictly-typed JSON schema output for frontend.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import sys
import numpy as np
from typing import Any, Dict, List
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# Schema Definitions
# ─────────────────────────────────────────────────────────────────────────────

class RouteAssessment(BaseModel):
    route_id: str
    route_name: str
    is_clear: bool
    estimated_duration_mins: int
    added_delay_mins: int
    status_summary: str

class RailwayRecommendation(BaseModel):
    recommended_route_id: str
    decision_reasoning: str
    routes: List[RouteAssessment]


# ─────────────────────────────────────────────────────────────────────────────
# 1. Numerical Delay Prediction Layer (XGBoost / GBR)
# ─────────────────────────────────────────────────────────────────────────────

def predict_route_delay(route: Dict[str, Any], weather: int = 0, priority: int = 2) -> float:
    """
    Predicts added delay minutes using physics baseline and the trained model.
    """
    distance_km = float(route.get("base_distance_km", 100.0))
    max_speed = float(route.get("max_speed_kmh", 110.0))
    disruptions = route.get("active_disruptions", [])

    if not disruptions:
        return 0.0

    caution_km = 0.0
    caution_speed = max_speed
    single_track = 0

    for d in disruptions:
        start_km = float(d.get("start_km", 0.0))
        end_km = float(d.get("end_km", 0.0))
        caution_km += max(1.0, abs(end_km - start_km))
        caution_speed = min(caution_speed, float(d.get("speed_restriction_kmh", 30.0)))
        if d.get("single_track_pilot_working", False):
            single_track = 1

    # Feature vector matching trained XGBoost schema
    # [distance_km, caution_km, caution_speed, max_speed, single_track, weather_severity, train_priority]
    features = np.array([[distance_km, caution_km, caution_speed, max_speed, single_track, weather, priority]], dtype=np.float32)

    # Try loading trained model
    model_path = os.path.join("ai-models", "shared", "railway_delay_model.json")
    if os.path.exists(model_path):
        try:
            import xgboost as xgb
            booster = xgb.Booster()
            booster.load_model(model_path)
            dmatrix = xgb.DMatrix(features)
            predicted = float(booster.predict(dmatrix)[0])
            return max(0.0, round(predicted, 1))
        except Exception:
            pass

    # Physics mathematical fallback
    normal_t = (caution_km / max_speed) * 60.0
    slow_t = (caution_km / max(10.0, caution_speed)) * 60.0
    delay = (slow_t - normal_t) + (20.0 if single_track else 3.0)
    return round(delay, 1)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Reasoning Layer (Groq Llama 3.3 / Local SFT / Fallback)
# ─────────────────────────────────────────────────────────────────────────────

def run_hybrid_pipeline(network_state: Dict[str, Any]) -> RailwayRecommendation:
    candidate_routes = network_state.get("candidate_routes", [])
    
    # Phase 1: Compute numerical delays for each path
    enriched_routes = []
    for r in candidate_routes:
        pred_delay = predict_route_delay(r)
        base_time = int(r.get("base_travel_time_mins", 60))
        total_time = int(base_time + pred_delay)
        is_clear = len(r.get("active_disruptions", [])) == 0
        
        disruptions = r.get("active_disruptions", [])
        if disruptions:
            summaries = []
            for d in disruptions:
                dtype = d.get("type", "Maintenance")
                spd = d.get("speed_restriction_kmh", 30)
                skm = d.get("start_km", 0)
                ekm = d.get("end_km", 0)
                pilot = " (Single-line token working)" if d.get("single_track_pilot_working") else ""
                summaries.append(f"{dtype} Km {skm}-{ekm} [TSR: {spd} km/h{pilot}]")
            status_summary = "; ".join(summaries)
        else:
            status_summary = "Clear. No active speed restrictions."

        enriched_routes.append({
            "route_id": r.get("route_id", "RT-01"),
            "name": r.get("name", "Main Line"),
            "base_time": base_time,
            "pred_delay": int(pred_delay),
            "total_time": total_time,
            "is_clear": is_clear,
            "status_summary": status_summary
        })

    # Phase 2: Send numerical predictions to LLM for dispatch reasoning
    groq_api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_api_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)

            sys_prompt = (
                "You are an Indian Railways Section Controller reasoning engine. "
                "Evaluate candidate rail routes using the provided XGBoost delay predictions. "
                "Explain the operational trade-offs and select the optimal route."
            )
            user_prompt = (
                f"Candidate Routes with Model Predictions:\n{json.dumps(enriched_routes, indent=2)}"
            )

            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "RailwayRecommendation",
                        "schema": RailwayRecommendation.model_json_schema()
                    }
                },
                temperature=0.1
            )
            return RailwayRecommendation.model_validate_json(completion.choices[0].message.content)
        except Exception as e:
            sys.stderr.write(f"[WARN] LLM API call bypassed: {e}\n")

    # Phase 3: Deterministic synthesis fallback
    best = min(enriched_routes, key=lambda x: x["total_time"])
    assessments = [
        RouteAssessment(
            route_id=er["route_id"],
            route_name=er["name"],
            is_clear=er["is_clear"],
            estimated_duration_mins=er["total_time"],
            added_delay_mins=er["pred_delay"],
            status_summary=er["status_summary"]
        )
        for er in enriched_routes
    ]

    other_routes = [er for er in enriched_routes if er["route_id"] != best["route_id"]]
    if other_routes:
        alt_str = ", ".join([f"{o['name']} (+{o['pred_delay']}m delay, total {o['total_time']}m)" for o in other_routes])
        reasoning = (
            f"Assigned {best['name']} ({best['route_id']}) with total ETA of {best['total_time']} mins. "
            f"Alternative paths have higher delay penalties: {alt_str}."
        )
    else:
        reasoning = f"Assigned {best['name']} with clear track status and ETA of {best['total_time']} mins."

    return RailwayRecommendation(
        recommended_route_id=best["route_id"],
        decision_reasoning=reasoning,
        routes=assessments
    )


if __name__ == "__main__":
    sample_state = {
        "origin": "New Delhi (NDLS)",
        "destination": "Kanpur Central (CNB)",
        "candidate_routes": [
            {
                "route_id": "RT-MAIN-01",
                "name": "Direct Main Corridor",
                "base_distance_km": 140,
                "base_travel_time_mins": 80,
                "max_speed_kmh": 130,
                "active_disruptions": [
                    {
                        "type": "Tamping Machine Block",
                        "start_km": 60,
                        "end_km": 72,
                        "speed_restriction_kmh": 20,
                        "single_track_pilot_working": True
                    }
                ]
            },
            {
                "route_id": "RT-LOOP-02",
                "name": "Aligarh-Chandausi Loop Bypass",
                "base_distance_km": 175,
                "base_travel_time_mins": 105,
                "max_speed_kmh": 110,
                "active_disruptions": []
            }
        ]
    }
    result = run_hybrid_pipeline(sample_state)
    print(json.dumps(result.model_dump(), indent=2))
