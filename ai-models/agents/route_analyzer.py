"""
route_analyzer.py
─────────────────────────────────────────────────────────────────────────────
RAKSHA PATH — Indian Railways AI Route & Disruption Reasoning Engine
Evaluates candidate railway routes against maintenance logs, speed restrictions (TSR),
single-track bottlenecks, and corridor possessions using Groq Llama-3.3 / Gemini / Pydantic.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pydantic Structured Output Schema
# ─────────────────────────────────────────────────────────────────────────────

class RouteAssessment(BaseModel):
    route_id: str = Field(description="Unique identifier for candidate route")
    route_name: str = Field(description="Descriptive railway corridor or chord line name")
    is_clear: bool = Field(description="False if track maintenance, blockages, or slow orders exist")
    estimated_duration_mins: int = Field(description="Total journey time including maintenance delays")
    added_delay_mins: int = Field(description="Estimated extra delay caused by work zones or speed restrictions")
    status_summary: str = Field(description="Brief reason for status (e.g., '20 km/h caution order at Km 45-52')")


class RailwayRecommendation(BaseModel):
    recommended_route_id: str = Field(description="ID of the best overall route to assign")
    decision_reasoning: str = Field(description="Operational rationale explaining the selection")
    routes: List[RouteAssessment] = Field(description="List of evaluated candidate route assessments")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Heuristic Fallback Engine (when API keys are offline or unreachable)
# ─────────────────────────────────────────────────────────────────────────────

def compute_heuristic_recommendation(payload: Dict[str, Any]) -> RailwayRecommendation:
    candidate_routes = payload.get("candidate_routes", [])
    assessments: List[RouteAssessment] = []
    
    best_route_id = None
    best_time = float("inf")
    
    for r in candidate_routes:
        route_id = r.get("route_id", "RT-UNKNOWN")
        name = r.get("name", route_id)
        base_time = int(r.get("base_travel_time_mins", 60))
        disruptions = r.get("active_disruptions", [])
        
        is_clear = len(disruptions) == 0
        added_delay = 0
        reasons = []
        
        for d in disruptions:
            dtype = d.get("type", "Maintenance")
            start_km = d.get("start_km", 0)
            end_km = d.get("end_km", 0)
            speed = d.get("speed_restriction_kmh", 30)
            pilot = d.get("single_track_pilot_working", False)
            
            # Estimate delay based on slow order length and speed cap
            dist = max(1, end_km - start_km)
            normal_time = (dist / 100.0) * 60  # assume 100 km/h nominal
            restricted_time = (dist / max(10, speed)) * 60
            crawl_delay = max(5, int(restricted_time - normal_time))
            if pilot:
                crawl_delay += 20  # queueing / token exchange delay
                
            added_delay += crawl_delay
            pilot_note = " with single-track pilot bottleneck" if pilot else ""
            reasons.append(f"{dtype} at Km {start_km}-{end_km} (TSR: {speed} km/h{pilot_note})")
            
        total_time = base_time + added_delay
        status_str = "; ".join(reasons) if reasons else "Clear. No active speed restrictions or maintenance blocks."
        
        assessments.append(RouteAssessment(
            route_id=route_id,
            route_name=name,
            is_clear=is_clear,
            estimated_duration_mins=total_time,
            added_delay_mins=added_delay,
            status_summary=status_str
        ))
        
        if total_time < best_time:
            best_time = total_time
            best_route_id = route_id

    if not best_route_id and assessments:
        best_route_id = assessments[0].route_id

    # Generate operational reasoning
    chosen = next((a for a in assessments if a.route_id == best_route_id), None)
    others = [a for a in assessments if a.route_id != best_route_id]
    
    if chosen and others:
        other_summary = ", ".join([f"{o.route_name} (ETA: {o.estimated_duration_mins}m, +{o.added_delay_mins}m delay)" for o in others])
        reasoning = (
            f"Selected {chosen.route_name} ({chosen.route_id}) as the optimal route with total ETA of {chosen.estimated_duration_mins} mins. "
            f"Alternative routes suffer from active maintenance bottlenecks: {other_summary}."
        )
    elif chosen:
        reasoning = f"Assigned {chosen.route_name} with verified clear status and estimated transit time of {chosen.estimated_duration_mins} mins."
    else:
        reasoning = "Evaluated network topology with standard dispatch clearance rules."

    return RailwayRecommendation(
        recommended_route_id=best_route_id or "RT-01",
        decision_reasoning=reasoning,
        routes=assessments
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Main Route Analysis Function (Groq with Automatic Resilient Fallback)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_routes_with_ai(network_payload: Dict[str, Any]) -> RailwayRecommendation:
    """
    Analyzes railway network routing using Groq Cloud Llama-3.3-70b with Pydantic JSON schema.
    Falls back gracefully to local deterministic heuristic if API key is missing or network fails.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if groq_api_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)

            system_prompt = (
                "You are an automated Railway Dispatch & Track Clearance Reasoning Engine for Indian Railways. "
                "Evaluate candidate railway routes against reported maintenance, track cautions, "
                "single-track bottlenecks, and speed limits. Compute realistic total travel times and select the optimal route."
            )
            user_prompt = (
                f"Analyze these railway routes and their current maintenance logs:\n"
                f"{json.dumps(network_payload, indent=2)}"
            )

            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
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

            result_json = completion.choices[0].message.content
            parsed = RailwayRecommendation.model_validate_json(result_json)
            return parsed
        except Exception as e:
            sys.stderr.write(f"[WARN] Groq API execution encountered an error: {e}. Utilizing deterministic reasoning fallback.\n")

    # Fallback if no API key or remote failure
    return compute_heuristic_recommendation(network_payload)


# ─────────────────────────────────────────────────────────────────────────────
# 4. CLI Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Standard sample scenario if no argument provided
    default_network_state = {
        "origin": "Station Alpha (NDLS)",
        "destination": "Station Beta (CNB)",
        "candidate_routes": [
            {
                "route_id": "RT-MAIN-01",
                "name": "Northern Main Line",
                "base_distance_km": 120,
                "base_travel_time_mins": 75,
                "active_disruptions": [
                    {
                        "type": "Track Maintenance (Ballast Tamping)",
                        "start_km": 45,
                        "end_km": 52,
                        "speed_restriction_kmh": 20,
                        "single_track_pilot_working": True
                    }
                ]
            },
            {
                "route_id": "RT-LOOP-02",
                "name": "Southern Chord Bypass",
                "base_distance_km": 155,
                "base_travel_time_mins": 95,
                "active_disruptions": []
            }
        ]
    }

    input_payload = default_network_state
    if len(sys.argv) > 1:
        try:
            if sys.argv[1] == "--input" and len(sys.argv) > 2:
                input_payload = json.loads(sys.argv[2])
            else:
                input_payload = json.loads(sys.argv[1])
        except Exception as err:
            sys.stderr.write(f"[ERROR] Failed to parse input JSON: {err}\n")

    recommendation = analyze_routes_with_ai(input_payload)
    print(json.dumps(recommendation.model_dump(), indent=2))
