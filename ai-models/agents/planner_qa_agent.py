"""
planner_qa_agent.py
─────────────────────────────────────────────────────────────────────────────
Agent 6: Planner Q&A Agent
Need: Planner Q&A
AI/ML Method: RAG: LLM (Ollama llama3.2:1b) + retrieval from approved records/policies
Why Practical: Natural-language access without letting LLM directly query raw operational systems
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
from typing import Any, Dict, List

AGENTS_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = AGENTS_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from agents.base_agent import BaseRailwayAgent
from seeds.ollama_converter import get_ollama_client, OLLAMA_MODEL

# Approved Indian Railways Knowledge Corpus for RAG Retrieval
RAILWAY_POLICY_KNOWLEDGE_BASE = [
    {
        "manual": "IRPWM (Indian Railways Permanent Way Manual)",
        "citation": "IRPWM Para 268 & IRS T-12",
        "topic": "USFD Ultrasonic Flaw Classification",
        "text": "IMR (Immediate Removal Flaw) defects require immediate fishplate clamping with joggled fishplates and imposition of a Temporary Speed Restriction (TSR) of 30 km/h. Complete rail cut and replacement must be executed within 24 hours under traffic block."
    },
    {
        "manual": "IRPWM Para 522 & 523",
        "citation": "IRPWM Chapter V",
        "topic": "Track Geometry & Dynamic Oscillation Limits",
        "text": "Peak vertical and lateral oscillations recorded by OMS exceeding 0.35g on high-speed routes (>110 km/h) require urgent inspection within 24 hours and priority tamping / ballast packing within 72 hours."
    },
    {
        "manual": "IRSEM (Indian Railways Signal Engineering Manual)",
        "citation": "IRSEM Part II Section 7",
        "topic": "Point Machine Overhaul & Signalling Disconnection",
        "text": "Work on track circuits, point detection, and axle counters requires issuance of Disconnection Notice Form S&T (T/351) to the Station Master. S&T work must be coordinated with Engineering block possession."
    },
    {
        "manual": "ACTM (AC Traction Manual)",
        "citation": "ACTM Vol II Part I Para 204",
        "topic": "OHE Power Block & Permit to Work (PTW)",
        "text": "Any civil engineering work within 2 meters of live 25kV OHE catenary requires an approved Power Block and formal Permit to Work (PTW) issued by Traction Power Controller (TPC) to ensure discharge and earthing."
    },
    {
        "manual": "Indian Railways Operating Code",
        "citation": "General & Subsidiary Rules (G&SR) Rule 4.08",
        "topic": "Mega-Block Possession Coordination",
        "text": "Corridor blocks affecting main lines require minimum 15-minute headway buffer before and after the possession. Shadow blocks should bundle Civil, S&T, and Electrical works to minimize net passenger disruption."
    }
]


class PlannerQAAgent(BaseRailwayAgent):
    def __init__(self):
        super().__init__(
            agent_id="planner_qa_agent",
            name="Railway Operational Policy & RAG Q&A Assistant",
            need="Planner Q&A",
            method="RAG: LLM (Ollama llama3.2:1b) + retrieval from approved records/policies",
            practical_rationale="Natural-language access without letting LLM directly query raw operational systems"
        )

    def _retrieve_relevant_policies(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """Semantic/keyword retrieval from verified railway manuals."""
        q_lower = query.lower()
        scored = []
        for item in RAILWAY_POLICY_KNOWLEDGE_BASE:
            score = 0
            words = q_lower.split()
            for w in words:
                if len(w) > 3 and (w in item["topic"].lower() or w in item["text"].lower() or w in item["manual"].lower()):
                    score += 1
            scored.append((score, item))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:top_k]]

    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        query = payload.get("query", payload.get("question", "What is the rule for an IMR rail flaw detected by USFD?"))
        client = get_ollama_client()

        retrieved_docs = self._retrieve_relevant_policies(query, top_k=2)
        context_str = "\n\n".join([f"[{d['citation']}]: {d['text']}" for d in retrieved_docs])

        answer = None
        if client is not None:
            try:
                system_prompt = (
                    "You are the Indian Railways AI Chief Planning Officer. Answer the user's question "
                    "strictly using the provided approved railway manual policies. "
                    "Always cite the exact Manual and Paragraph number. Keep it concise, authoritative, and clear."
                )
                user_content = f"Approved Policy Context:\n{context_str}\n\nUser Question: {query}"
                resp = client.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    options={"temperature": 0.2}
                )
                answer = resp["message"]["content"]
            except Exception:
                pass

        if not answer:
            # Fallback deterministic RAG answer
            top = retrieved_docs[0]
            answer = f"According to {top['citation']} ({top['manual']}): {top['text']}"

        return {
            "query": query,
            "answer": answer,
            "citations": [d["citation"] for d in retrieved_docs],
            "retrieved_context": retrieved_docs,
            "llm_engine": f"Ollama ({OLLAMA_MODEL}) RAG Pipeline" if client else "Deterministic Policy Retrieval"
        }
