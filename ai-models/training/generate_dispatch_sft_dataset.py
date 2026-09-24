"""
generate_dispatch_sft_dataset.py
─────────────────────────────────────────────────────────────────────────────
Step 3: Generates a fine-tuning dataset (JSONL) of historical dispatch decisions.
Creates multi-turn and single-turn conversation pairs teaching the LLM (Llama-3/Mistral)
how to analyze XGBoost/numerical delay predictions, assess track safety trade-offs,
and produce verified JSON recommendations.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import random

CORRIDORS = [
    {"name_a": "NDLS Main Line", "name_b": "Anand Vihar Chord Bypass", "dist_a": 95, "dist_b": 120, "mps_a": 110, "mps_b": 100},
    {"name_a": "Ghaziabad Northern Chord", "name_b": "Sahibabad Loop Bypass", "dist_a": 42, "dist_b": 58, "mps_a": 100, "mps_b": 90},
    {"name_a": "Kanpur Direct Down Line", "name_b": "Chakeri Freight Loop", "dist_a": 180, "dist_b": 210, "mps_a": 130, "mps_b": 110},
    {"name_a": "Aligarh High Speed Line", "name_b": "Hathras Chord", "dist_a": 130, "dist_b": 148, "mps_a": 130, "mps_b": 100},
    {"name_a": "Prayagraj North Corridor", "name_b": "Naini South Bypass", "dist_a": 110, "dist_b": 135, "mps_a": 110, "mps_b": 90},
]

DISRUPTIONS = [
    {"type": "Track Deep Screening & Tamping", "speed": 20, "single_line": True, "len_range": (4, 12)},
    {"type": "OHE Overhead Power Block", "speed": 30, "single_line": False, "len_range": (3, 8)},
    {"type": "Rail Fracture Weld Replacement", "speed": 15, "single_line": True, "len_range": (2, 5)},
    {"type": "Electronic Interlocking Signal Testing", "speed": 25, "single_line": False, "len_range": (5, 15)},
    {"type": "Bridge Girder Routine Inspection", "speed": 30, "single_line": False, "len_range": (1, 4)},
]

SYSTEM_PROMPT = (
    "You are an expert Indian Railways Section Controller & Automatic Dispatch AI. "
    "Evaluate candidate rail corridors using numerical track physics and maintenance logs. "
    "Select the optimal route and output a structured JSON recommendation."
)


def generate_sft_dataset(n_samples: int = 500):
    os.makedirs("data", exist_ok=True)
    out_path = os.path.join("data", "railway_dispatch_sft.jsonl")

    samples = []
    for i in range(n_samples):
        corr = random.choice(CORRIDORS)
        dis = random.choice(DISRUPTIONS)
        
        # Scenario generation: Corridor A has work, Corridor B is clear (or vice-versa)
        a_is_disrupted = random.random() < 0.70
        
        if a_is_disrupted:
            dis_km = round(random.uniform(*dis["len_range"]), 1)
            dis_speed = dis["speed"]
            is_single = dis["single_line"]
            
            # Physics delay computation
            normal_time_a = (corr["dist_a"] / corr["mps_a"]) * 60
            zone_normal = (dis_km / corr["mps_a"]) * 60
            zone_slow = (dis_km / dis_speed) * 60
            pred_delay_a = int((zone_slow - zone_normal) + (25 if is_single else 5))
            total_time_a = int(normal_time_a + pred_delay_a)

            total_time_b = int((corr["dist_b"] / corr["mps_b"]) * 60)
            pred_delay_b = 0

            status_a = f"{dis['type']} at Km {round(random.uniform(10, 40), 1)}-{round(random.uniform(42, 60), 1)} (TSR: {dis_speed} km/h{' with single-track pilot token working' if is_single else ''})"
            status_b = "Clear. No active speed restrictions or maintenance blocks."
        else:
            total_time_a = int((corr["dist_a"] / corr["mps_a"]) * 60)
            pred_delay_a = 0
            
            dis_km = round(random.uniform(*dis["len_range"]), 1)
            dis_speed = dis["speed"]
            is_single = dis["single_line"]
            normal_time_b = (corr["dist_b"] / corr["mps_b"]) * 60
            zone_normal = (dis_km / corr["mps_b"]) * 60
            zone_slow = (dis_km / dis_speed) * 60
            pred_delay_b = int((zone_slow - zone_normal) + (25 if is_single else 5))
            total_time_b = int(normal_time_b + pred_delay_b)

            status_a = "Clear. No active speed restrictions or maintenance blocks."
            status_b = f"{dis['type']} at Km {round(random.uniform(10, 30), 1)}-{round(random.uniform(32, 50), 1)} (TSR: {dis_speed} km/h{' with single-track pilot token working' if is_single else ''})"

        # Best route decision
        if total_time_a < total_time_b:
            chosen_id = "RT-01"
            chosen_name = corr["name_a"]
            time_diff = total_time_b - total_time_a
            reasoning = (
                f"Selected {corr['name_a']} (RT-01) with total transit ETA of {total_time_a} mins. "
                f"Although route experiences operational conditions, it is still {time_diff} mins faster than "
                f"{corr['name_b']} (total ETA {total_time_b} mins)."
            )
        else:
            chosen_id = "RT-02"
            chosen_name = corr["name_b"]
            time_diff = total_time_a - total_time_b
            reasoning = (
                f"Selected {corr['name_b']} (RT-02) with clear track status and ETA of {total_time_b} mins. "
                f"Routing via {corr['name_a']} would incur +{pred_delay_a} mins delay due to {status_a}, "
                f"making RT-02 {time_diff} mins faster."
            )

        # Build prompt and assistant response
        user_content = (
            f"Evaluate route clearance and ETA for:\n"
            f"- Route 1 (RT-01): {corr['name_a']}, Distance: {corr['dist_a']} km, MPS: {corr['mps_a']} km/h. Maintenance: {status_a}. Model Predicted Delay: +{pred_delay_a} mins.\n"
            f"- Route 2 (RT-02): {corr['name_b']}, Distance: {corr['dist_b']} km, MPS: {corr['mps_b']} km/h. Maintenance: {status_b}. Model Predicted Delay: +{pred_delay_b} mins."
        )

        assistant_payload = {
            "recommended_route_id": chosen_id,
            "decision_reasoning": reasoning,
            "routes": [
                {
                    "route_id": "RT-01",
                    "route_name": corr["name_a"],
                    "is_clear": pred_delay_a == 0,
                    "estimated_duration_mins": total_time_a,
                    "added_delay_mins": pred_delay_a,
                    "status_summary": status_a
                },
                {
                    "route_id": "RT-02",
                    "route_name": corr["name_b"],
                    "is_clear": pred_delay_b == 0,
                    "estimated_duration_mins": total_time_b,
                    "added_delay_mins": pred_delay_b,
                    "status_summary": status_b
                }
            ]
        }

        entry = {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": json.dumps(assistant_payload)}
            ]
        }
        samples.append(entry)

    with open(out_path, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")

    print(f"[OK] Generated {len(samples)} SFT training examples saved to: {out_path}")


if __name__ == "__main__":
    generate_sft_dataset(500)
