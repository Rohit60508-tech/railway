#!/usr/bin/env python3
"""
run_swarm_triage.py
─────────────────────────────────────────────────────────────────────────────
CLI entry point for Node.js server to run the 1-Click Multi-Agent Swarm Triage.
Outputs clean JSON to stdout for easy parsing.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import json
import logging
from pathlib import Path

# Add ai-models directory to path
AGENTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = AGENTS_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

# Suppress debug/info logging on stdout so stdout is clean JSON
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
for name in ["inference_app", "defect_prioritizer", "train_all_agents", "traffic_predictor"]:
    logging.getLogger(name).setLevel(logging.WARNING)

from agents.orchestrator import RailwayAgentOrchestrator


def main():
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        payload = json.loads(raw_input) if raw_input.strip() else {}
    except Exception:
        payload = {"text": "Urgent rail defect observed at KM 124/6 on UP main line."}

    orch = RailwayAgentOrchestrator()
    result = orch.run_triage_pipeline(payload)
    print("__JSON_START__")
    print(json.dumps(result))
    print("__JSON_END__")


if __name__ == "__main__":
    main()
