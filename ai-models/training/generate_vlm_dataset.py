"""
generate_vlm_dataset.py
─────────────────────────────────────────────────────────────────────────────
Step 1: Generates a multimodal instruction dataset in standard LLaVA format.
Pairs visual track inspection scenarios (cracks, missing Pandrol clips, ballast
voids, signal aspects, scanned circulars) with operational dispatch assessments.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import random

SAMPLE_VLM_SCENARIOS = [
    {
        "id": "trk_vlm_001",
        "image": "track_scans/km_42_ballast_washout.jpg",
        "defect_type": "Severe ballast displacement & scouring",
        "severity": "CRITICAL",
        "is_clear": False,
        "speed_restriction_kmh": 15,
        "reroute_to": "RT-LOOP-02 (Chord Bypass)",
        "recommendation": "Emergency ballast tamping required. Impose 15 km/h TSR or divert freight to Loop RT-B.",
        "bounding_box": [320, 180, 580, 440]
    },
    {
        "id": "trk_vlm_002",
        "image": "track_scans/km_18_pandrol_clip_missing.jpg",
        "defect_type": "Missing ERC (Elastic Rail Clip) Fasteners (3 consecutive sleepers)",
        "severity": "HIGH",
        "is_clear": False,
        "speed_restriction_kmh": 30,
        "reroute_to": "RT-MAIN-01 (Single Line Working)",
        "recommendation": "Dispatch Keyman Gang 04 immediately for clip insertion. Cap corridor speed to 30 km/h.",
        "bounding_box": [210, 400, 350, 520]
    },
    {
        "id": "trk_vlm_003",
        "image": "track_scans/km_88_transverse_weld_crack.jpg",
        "defect_type": "Transverse Thermite Weld Fracture (4.5mm separation)",
        "severity": "CRITICAL_IMMEDIATE_HALT",
        "is_clear": False,
        "speed_restriction_kmh": 0,
        "reroute_to": "RT-LOOP-03 (Aligarh Chord)",
        "recommendation": "DANGER: Complete line blockage mandated. Apply emergency clamp and joggled fishplate before passing any traffic.",
        "bounding_box": [450, 290, 610, 480]
    },
    {
        "id": "trk_vlm_004",
        "image": "track_scans/km_112_clear_highspeed.jpg",
        "defect_type": "None. Ballast shoulder intact, fastenings secure, alignment within tolerance",
        "severity": "SAFE_CLEAR",
        "is_clear": True,
        "speed_restriction_kmh": 130,
        "reroute_to": None,
        "recommendation": "Track section is certified clear for full 130 km/h MPS (Maximum Permissible Speed).",
        "bounding_box": None
    },
    {
        "id": "trk_vlm_005",
        "image": "bulletins/circular_nr_speed_restriction_oct26.jpg",
        "defect_type": "Document OCR: Northern Railway Caution Order No. 441/26",
        "severity": "OPERATIONAL_CAUTION",
        "is_clear": False,
        "speed_restriction_kmh": 20,
        "reroute_to": "RT-MAIN-DOWN",
        "recommendation": "TSR 20 km/h active between Km 74/2 to 78/6 from 02:00 to 07:00 hrs for sleeper replacement.",
        "bounding_box": [50, 50, 750, 900]
    }
]


def generate_llava_dataset(n_samples: int = 100):
    os.makedirs("data", exist_ok=True)
    out_file = os.path.join("data", "railway_vlm_dataset.json")

    dataset = []
    for i in range(n_samples):
        base = random.choice(SAMPLE_VLM_SCENARIOS)
        sample_id = f"trk_vlm_{i+1:03d}"
        
        gpt_response = {
            "is_clear": base["is_clear"],
            "defect_type": base["defect_type"],
            "severity": base["severity"],
            "speed_restriction_kmh": base["speed_restriction_kmh"],
            "recommendation": base["recommendation"],
            "reroute_to": base["reroute_to"],
            "bounding_box": base["bounding_box"]
        }

        entry = {
            "id": sample_id,
            "image": base["image"],
            "conversations": [
                {
                    "from": "human",
                    "value": f"<image>\nInspect this railway infrastructure scan for section {sample_id.upper()}. Assess track clearance, detect structural defects, provide bounding boxes, and recommend safe speed restrictions or rerouting options."
                },
                {
                    "from": "gpt",
                    "value": json.dumps(gpt_response, indent=2)
                }
            ]
        }
        dataset.append(entry)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)

    print(f"[OK] Generated {len(dataset)} multimodal VLM training records saved to: {out_file}")


if __name__ == "__main__":
    generate_llava_dataset(100)
