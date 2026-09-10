"""
advanced_features.py
─────────────────────────────────────────────────────────────────────────────
Indian Railways AI Maintenance & Block Planning Platform (RAKSHA PATH)
Standout Differentiating AI Engines:
  1. Dynamic Speed Restriction (PSR/TSR) Trade-off Simulator
  2. Goods Train Forecast "Opportunistic Windowing"
  3. AI Machine & Resource Fleet Balancer (BCM, Tampers, Tower Wagons)
  4. Automated Post-Block Yield & Burst Scorecard
  5. Emergency Block Impact & Freight Rerouting Assistant
  6. Digital Twin String Diagram (Marey Chart) Data Engine
  7. Multi-Horizon Planner (Weekly Tactical & Monthly Strategic)
─────────────────────────────────────────────────────────────────────────────
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import math


# =============================================================================
# 1. DYNAMIC SPEED RESTRICTION (PSR/TSR) TRADE-OFF SIMULATOR
# =============================================================================
class TSRTradeoffSimulator:
    """
    Simulates the punctuality trade-off:
    Scenario A: Grant immediate track block (brief traffic disruption today)
    Scenario B: Defer block (defect deteriorates into TSR causing chronic delays for N days)
    """

    @staticmethod
    def calculate_tradeoff(
        defect_type: str = "Ultrasonic Flaw (IMR)",
        corridor_speed_kmh: float = 130.0,
        tsr_speed_kmh: float = 30.0,
        restriction_length_km: float = 2.5,
        daily_train_density: int = 48,
        deferral_days: int = 7,
        block_duration_minutes: int = 120,
        trains_regulated_during_block: int = 4,
    ) -> Dict[str, Any]:
        # Punctuality loss per train under TSR:
        # Time at normal speed: (L / V_max) * 60
        # Time at TSR speed: (L / V_tsr) * 60 + deceleration/acceleration loss (~2.0 mins)
        t_normal = (restriction_length_km / corridor_speed_kmh) * 60.0
        t_restricted = (restriction_length_km / tsr_speed_kmh) * 60.0 + 2.0
        loss_per_train_mins = round(t_restricted - t_normal, 2)

        # Total cumulative delay if block is deferred for N days:
        total_trains_impacted = daily_train_density * deferral_days
        total_tsr_delay_mins = round(total_trains_impacted * loss_per_train_mins, 1)

        # Cost if block is granted today:
        # Average delay to 4 regulated passenger/freight trains during 2-hour window
        avg_block_delay_per_train = block_duration_minutes * 0.35  # Loop diversion/regulation
        immediate_block_total_delay_mins = round(trains_regulated_during_block * avg_block_delay_per_train, 1)

        net_delay_minutes_saved = round(total_tsr_delay_mins - immediate_block_total_delay_mins, 1)
        punctuality_preservation_ratio = round(
            (net_delay_minutes_saved / total_tsr_delay_mins) * 100.0 if total_tsr_delay_mins > 0 else 0, 1
        )

        recommendation = (
            "SANCTION IMMEDIATE BLOCK"
            if net_delay_minutes_saved > 0
            else "DEFERRABLE UNDER INTENSIVE USFD MONITORING"
        )

        return {
            "defect_type": defect_type,
            "corridor_speed_kmh": corridor_speed_kmh,
            "tsr_speed_kmh": tsr_speed_kmh,
            "restriction_length_km": restriction_length_km,
            "daily_train_density": daily_train_density,
            "deferral_days": deferral_days,
            "tsr_delay_per_train_mins": loss_per_train_mins,
            "total_deferred_tsr_delay_mins": total_tsr_delay_mins,
            "immediate_block_delay_mins": immediate_block_total_delay_mins,
            "net_punctuality_minutes_saved": net_delay_minutes_saved,
            "efficiency_gain_pct": punctuality_preservation_ratio,
            "recommendation": recommendation,
            "irpwn_reference": "IRPWM Para 204 & 602 (TSR Economic Minimization)",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# =============================================================================
# 2. GOODS TRAIN FORECAST "OPPORTUNISTIC WINDOWING"
# =============================================================================
class OpportunisticWindowDetector:
    """
    Detects dynamic gaps in freight traffic created by terminal turnaround delays,
    coal siding loading lulls, or junction clearance buffers. Converts downtime
    into productive micro-maintenance slots.
    """

    @staticmethod
    def find_opportunistic_windows(section_id: str = "NDLS-CNB-UP") -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        return [
            {
                "window_id": f"OPP-FREIGHT-{(now + timedelta(hours=2)).strftime('%H%M')}",
                "section_id": section_id,
                "start_time": (now + timedelta(hours=2, minutes=15)).strftime("%H:%M"),
                "end_time": (now + timedelta(hours=3, minutes=0)).strftime("%H:%M"),
                "duration_minutes": 45,
                "span_km": "KM 118.2 – KM 124.0 (near Khurja Jn)",
                "opportunity_cause": "Dadri Thermal Power Siding empty rake turnaround delay (+55 mins)",
                "suitable_work_types": [
                    "Weld Collar Ultrasonic Testing (Civil)",
                    "Point Machine 104A Lubrication & Detection Test (S&T)",
                    "Cantilever Insulator Cleaning (TRD OHE)",
                ],
                "priority_status": "HIGH VALUE OPPORTUNITY",
                "recommended_dept": "S&T / Engineering",
                "passenger_impact": "ZERO (Clear headway between 12004 and 12417)",
            },
            {
                "window_id": f"OPP-FREIGHT-{(now + timedelta(hours=5)).strftime('%H%M')}",
                "section_id": section_id,
                "start_time": (now + timedelta(hours=5, minutes=30)).strftime("%H:%M"),
                "end_time": (now + timedelta(hours=6, minutes=10)).strftime("%H:%M"),
                "duration_minutes": 40,
                "span_km": "KM 202.0 – KM 208.5 (Tundla Outer)",
                "opportunity_cause": "Kanpur Container Yard sorting buffer clearance",
                "suitable_work_types": [
                    "Axle Counter Sensor Recalibration (S&T)",
                    "TRD Contact Wire Height Laser Gauge Verification",
                ],
                "priority_status": "FAST CLAIM AVAILABLE",
                "recommended_dept": "TRD OHE",
                "passenger_impact": "ZERO",
            },
            {
                "window_id": f"OPP-FREIGHT-{(now + timedelta(hours=8)).strftime('%H%M')}",
                "section_id": section_id,
                "start_time": (now + timedelta(hours=8, minutes=0)).strftime("%H:%M"),
                "end_time": (now + timedelta(hours=8, minutes=50)).strftime("%H:%M"),
                "duration_minutes": 50,
                "span_km": "KM 340.0 – KM 346.0 (Etawah Bypass)",
                "opportunity_cause": "EDFC Goods traffic diversion via New Khurja link",
                "suitable_work_types": [
                    "Track Fastening Tightening with ERC Applicator",
                    "Glued Joint Insulation Resistance Testing",
                ],
                "priority_status": "EXPEDITE APPROVAL",
                "recommended_dept": "Civil (P-Way)",
                "passenger_impact": "ZERO",
            },
        ]


# =============================================================================
# 3. AI MACHINE & RESOURCE LOAD BALANCER
# =============================================================================
class ResourceFleetBalancer:
    """
    Tracks heavy on-track machinery (BCM, 09-3X Tampers, CSM, DGS, Tower Wagons)
    and certifies crew/machine transit feasibility to eliminate "ghost blocks".
    """

    FLEET_DATABASE = [
        {
            "machine_id": "BCM-372",
            "type": "Ballast Cleaning Machine (Plasser & Theurer)",
            "department": "Civil (P-Way)",
            "current_stabling": "Tundla Jn Track Depot (KM 204.0)",
            "max_transit_speed_kmh": 40.0,
            "crew_available": True,
            "diesel_stock_liters": 3200,
            "status": "OPERATIONAL / READY FOR DEPLOYMENT",
        },
        {
            "machine_id": "TAMPER-09-3X",
            "type": "Continuous 3-Sleeper Tamping Machine",
            "department": "Civil (P-Way)",
            "current_stabling": "Aligarh Jn Stabling Siding (KM 126.0)",
            "max_transit_speed_kmh": 50.0,
            "crew_available": True,
            "diesel_stock_liters": 2800,
            "status": "OPERATIONAL / ON STANDBY",
        },
        {
            "machine_id": "DGS-184",
            "type": "Dynamic Track Stabilizer",
            "department": "Civil (P-Way)",
            "current_stabling": "Ghaziabad Yard (KM 25.0)",
            "max_transit_speed_kmh": 45.0,
            "crew_available": True,
            "diesel_stock_liters": 2100,
            "status": "OPERATIONAL / READY",
        },
        {
            "machine_id": "TW-8W-042",
            "type": "8-Wheeler TRD OHE Tower Wagon",
            "department": "Electrical (TRD)",
            "current_stabling": "Khurja OHE Depot (KM 83.0)",
            "max_transit_speed_kmh": 60.0,
            "crew_available": True,
            "diesel_stock_liters": 1500,
            "status": "OPERATIONAL / PATROL READY",
        },
        {
            "machine_id": "CSM-911",
            "type": "Continuous Action Tamper",
            "department": "Civil (P-Way)",
            "current_stabling": "Kanpur Central West Yard (KM 435.0)",
            "max_transit_speed_kmh": 45.0,
            "crew_available": False,
            "diesel_stock_liters": 950,
            "status": "CREW REST MANDATORY (Available in 4h)",
        },
    ]

    @classmethod
    def get_fleet_status(cls) -> List[Dict[str, Any]]:
        return cls.FLEET_DATABASE

    @classmethod
    def validate_resource_for_block(
        cls, machine_id: str, target_km: float, scheduled_start_hour: float
    ) -> Dict[str, Any]:
        machine = next((m for m in cls.FLEET_DATABASE if m["machine_id"] == machine_id), None)
        if not machine:
            return {"valid": False, "reason": f"Machine {machine_id} not found in divisional inventory."}

        # Extract current KM from stabling description
        current_km = 126.0  # default
        if "KM " in machine["current_stabling"]:
            try:
                km_part = machine["current_stabling"].split("KM ")[1].split(")")[0]
                current_km = float(km_part)
            except Exception:
                current_km = 126.0

        distance_km = abs(target_km - current_km)
        transit_speed = machine["max_transit_speed_kmh"]
        transit_time_hours = round(distance_km / transit_speed, 2)
        transit_time_mins = round(transit_time_hours * 60)

        can_reach = transit_time_hours <= 3.5 and machine["crew_available"]
        verdict = "FEASIBLE: NO GHOST BLOCK RISK" if can_reach else "INFEASIBLE: GHOST BLOCK DANGER"

        return {
            "machine_id": machine_id,
            "type": machine["type"],
            "current_location": machine["current_stabling"],
            "target_km": target_km,
            "transit_distance_km": round(distance_km, 1),
            "estimated_transit_minutes": transit_time_mins,
            "crew_available": machine["crew_available"],
            "is_feasible": can_reach,
            "verdict": verdict,
            "action": "Dispatch Machine Movement Authorization (MMA) Form 402" if can_reach else "Reassign to local siding Tamper",
        }


# =============================================================================
# 4. POST-BLOCK YIELD & BURST SCORECARD
# =============================================================================
class PostBlockScorecard:
    """
    Measures block utilization efficiency, tracking:
    - Yield %: Actual work executed vs sanctioned scope
    - Burst Penalty: Minutes block exceeded sanctioned window
    - DRR: Departmental Reliability Rating (feeds back into AI priority weights)
    """

    DEPARTMENT_METRICS = {
        "Civil (Engineering)": {
            "blocks_granted_month": 34,
            "total_hours_granted": 82.5,
            "km_deep_screened_actual": 18.2,
            "km_deep_screened_target": 19.5,
            "yield_percentage": 93.3,
            "blocks_burst_count": 2,
            "average_burst_minutes": 14.0,
            "drr_score": 92.4,
            "rating": "GRADE A (RELIABLE)",
            "priority_modifier": 1.05,
        },
        "Signal & Telecomm (S&T)": {
            "blocks_granted_month": 28,
            "total_hours_granted": 44.0,
            "points_overhauled_actual": 42,
            "points_overhauled_target": 45,
            "yield_percentage": 93.3,
            "blocks_burst_count": 1,
            "average_burst_minutes": 8.0,
            "drr_score": 95.8,
            "rating": "GRADE A+ (EXEMPLARY)",
            "priority_modifier": 1.10,
        },
        "Electrical (TRD OHE)": {
            "blocks_granted_month": 22,
            "total_hours_granted": 38.0,
            "km_contact_wire_inspected": 64.0,
            "km_contact_wire_target": 75.0,
            "yield_percentage": 85.3,
            "blocks_burst_count": 4,
            "average_burst_minutes": 22.5,
            "drr_score": 81.2,
            "rating": "GRADE B (MONITORING REQUIRED)",
            "priority_modifier": 0.92,
        },
    }

    @classmethod
    def get_scorecard(cls) -> Dict[str, Any]:
        return {
            "evaluation_period": "Current Financial Quarter (2026-Q3)",
            "division": "Prayagraj Division (NCR) & Delhi Division (NR)",
            "department_metrics": cls.DEPARTMENT_METRICS,
            "divisional_yield_average": 90.6,
            "divisional_burst_rate_pct": 9.7,
            "net_punctuality_impact_minutes": -184,
            "ai_policy": "Departments with DRR < 85% incur a 10% penalty on non-critical discretionary block requests.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# =============================================================================
# 5. EMERGENCY BLOCK IMPACT & REROUTING ASSISTANT
# =============================================================================
class EmergencyReroutingAssistant:
    """
    Computes instant freight diversion and passenger train regulation
    when sudden rail fractures, weld breaks, or OHE snaps occur.
    """

    @staticmethod
    def calculate_emergency_reroute(
        section_id: str = "NDLS-CNB-UP",
        incident_type: str = "Rail Fracture (Severe Ultrasonic Break)",
        incident_km: float = 142.8,
        estimated_restoration_minutes: int = 180,
    ) -> Dict[str, Any]:
        return {
            "incident_type": incident_type,
            "section_id": section_id,
            "incident_location": f"KM {incident_km} (Aligarh – Somna Block Section)",
            "estimated_block_duration": f"{estimated_restoration_minutes} minutes",
            "clamped_speed_permissible": "10 km/h with Emergency Fishplate after 30 mins",
            "upstream_trains_affected": [
                {
                    "train_number": "12302",
                    "train_name": "New Delhi - Howrah Rajdhani Express",
                    "status": "Approaching KM 130",
                    "action": "Regulate at Aligarh Jn Platform 1 (Estimated halt: 35 mins)",
                    "priority": "HIGH",
                },
                {
                    "train_number": "12004",
                    "train_name": "Lucknow Shatabdi",
                    "status": "At Ghaziabad",
                    "action": "Reroute via Moradabad - Bareilly - Lucknow chord",
                    "priority": "HIGH",
                },
                {
                    "train_number": "BOXN-7842",
                    "train_name": "Coal Heavy Rake (Singrauli)",
                    "status": "Holding at Khurja",
                    "action": "Divert via Eastern Dedicated Freight Corridor (EDFC) New Khurja Junction",
                    "priority": "FREIGHT_BYPASS",
                },
            ],
            "freight_bypass_route": "EDFC (Eastern Dedicated Freight Corridor) via Dadri - New Khurja - New Kanpur",
            "freight_capacity_retained_pct": 88.0,
            "passenger_delay_penalty_total_mins": 195,
            "emergency_gang_dispatched": "P-Way Aligarh Gang #4 with Emergency Clamp & Weld Kit",
            "eta_gang_arrival_mins": 18,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# =============================================================================
# 6. DIGITAL TWIN STRING DIAGRAM (TIME-DISTANCE MAREY GRAPH)
# =============================================================================
class StringDiagramGenerator:
    """
    Supplies train trajectories (Time vs Distance) and track defect locations
    to render an interactive Time-Distance Marey Graph on HTML5 canvas.
    """

    @staticmethod
    def get_string_diagram_data(section_id: str = "NDLS-CNB-UP") -> Dict[str, Any]:
        stations = [
            {"code": "NDLS", "km": 0.0, "name": "New Delhi"},
            {"code": "GZB", "km": 25.4, "name": "Ghaziabad"},
            {"code": "ALJN", "km": 126.1, "name": "Aligarh"},
            {"code": "TDL", "km": 204.3, "name": "Tundla"},
            {"code": "ETW", "km": 296.0, "name": "Etawah"},
            {"code": "CNB", "km": 435.0, "name": "Kanpur Central"},
        ]

        # Trajectories: series of [time_in_hours, km]
        trajectories = [
            {
                "train_number": "22436",
                "train_name": "Vande Bharat Express",
                "type": "Vande Bharat",
                "color": "#0056B3",
                "points": [[6.0, 0.0], [6.3, 25.4], [7.1, 126.1], [7.8, 204.3], [8.5, 296.0], [9.8, 435.0]],
            },
            {
                "train_number": "12302",
                "train_name": "Howrah Rajdhani",
                "type": "Rajdhani",
                "color": "#DC2626",
                "points": [[6.5, 0.0], [6.85, 25.4], [7.8, 126.1], [8.6, 204.3], [9.4, 296.0], [10.9, 435.0]],
            },
            {
                "train_number": "12004",
                "train_name": "Lucknow Shatabdi",
                "type": "Shatabdi",
                "color": "#D97706",
                "points": [[6.8, 0.0], [7.2, 25.4], [8.3, 126.1], [9.1, 204.3], [10.0, 296.0], [11.5, 435.0]],
            },
            {
                "train_number": "12560",
                "train_name": "Shiv Ganga Express",
                "type": "Superfast",
                "color": "#7C3AED",
                "points": [[7.5, 0.0], [8.0, 25.4], [9.3, 126.1], [10.3, 204.3], [11.4, 296.0], [13.2, 435.0]],
            },
            {
                "train_number": "BOXN-901",
                "train_name": "Coal Heavy Freight",
                "type": "Freight",
                "color": "#475569",
                "points": [[1.0, 0.0], [1.8, 25.4], [4.2, 126.1], [6.2, 204.3], [8.8, 296.0], [12.5, 435.0]],
            },
            {
                "train_number": "BCN-441",
                "train_name": "Covered Foodgrain",
                "type": "Freight",
                "color": "#64748B",
                "points": [[12.0, 0.0], [13.0, 25.4], [15.8, 126.1], [18.0, 204.3], [20.6, 296.0], [24.0, 435.0]],
            },
        ]

        # Defect hotspots along corridor (KM, severity, dept)
        defects = [
            {"km": 42.5, "severity": "P1", "type": "Rail Fracture Weld Flaw", "dept": "Civil", "color": "#DC2626"},
            {"km": 142.8, "severity": "P1", "type": "Ultrasonic IMR Defect", "dept": "Civil", "color": "#DC2626"},
            {"km": 218.4, "severity": "P2", "type": "Point Machine Backlash", "dept": "Signal", "color": "#D97706"},
            {"km": 284.1, "severity": "P2", "type": "OHE Dropper Wear > 20%", "dept": "Electrical", "color": "#D97706"},
            {"km": 378.0, "severity": "P3", "type": "Missing Elastic Rail Clips", "dept": "Civil", "color": "#059669"},
        ]

        # Optimal Shadow Block Window candidate
        recommended_block_box = {
            "start_time_hour": 1.5,
            "end_time_hour": 4.5,
            "start_km": 120.0,
            "end_km": 160.0,
            "label": "AI Recommended Consolidated Mega-Block (3.0 hrs)",
            "conflicts_count": 0,
        }

        return {
            "section_id": section_id,
            "corridor_length_km": 435.0,
            "time_range_hours": [0, 24],
            "stations": stations,
            "trajectories": trajectories,
            "defect_hotspots": defects,
            "recommended_block": recommended_block_box,
        }


# =============================================================================
# 7. MULTI-HORIZON PLANNER (WEEKLY TACTICAL & MONTHLY STRATEGIC)
# =============================================================================
class MultiHorizonPlanner:
    """
    Generates Multi-Horizon schedules:
    - Weekly Tactical Plan: Daily corridor possessions & localized task bundles
    - Monthly Strategic Plan: Heavy BCM/Tamper campaign allocations across divisions
    """

    @staticmethod
    def get_multi_horizon_plans() -> Dict[str, Any]:
        return {
            "weekly_tactical": [
                {
                    "day": "Monday (Day 1)",
                    "section": "NDLS-GZB-DN",
                    "window": "01:30 – 04:30 (Night Shadow)",
                    "departments": ["Civil", "Electrical"],
                    "jobs_consolidated": 5,
                    "allocated_machine": "TW-8W-042 (Tower Wagon)",
                    "status": "CONFIRMED BY DOM",
                },
                {
                    "day": "Tuesday (Day 2)",
                    "section": "GZB-ALJN-UP",
                    "window": "12:45 – 15:15 (Afternoon Lull)",
                    "departments": ["Civil", "Signal"],
                    "jobs_consolidated": 4,
                    "allocated_machine": "TAMPER-09-3X",
                    "status": "APPROVED",
                },
                {
                    "day": "Thursday (Day 4)",
                    "section": "ALJN-TDL-UP",
                    "window": "01:00 – 04:30 (3.5h Mega-Block)",
                    "departments": ["Civil", "Signal", "Electrical"],
                    "jobs_consolidated": 8,
                    "allocated_machine": "BCM-372 + DGS-184",
                    "status": "OPTIMAL CO-ORDINATED",
                },
                {
                    "day": "Saturday (Day 6)",
                    "section": "TDL-CNB-UP",
                    "window": "02:00 – 05:00 (Night Shadow)",
                    "departments": ["Civil"],
                    "jobs_consolidated": 6,
                    "allocated_machine": "BCM-372",
                    "status": "SCHEDULED",
                },
            ],
            "monthly_strategic": [
                {
                    "campaign_id": "CAMP-2026-M09-A",
                    "title": "Deep Screening Corridor Overhaul (KM 100 - KM 220)",
                    "duration_weeks": 3,
                    "total_mega_blocks": 12,
                    "allocated_fleet": ["BCM-372", "TAMPER-09-3X", "DGS-184"],
                    "projected_speed_restoration": "Restore from 100 km/h to full 130 km/h",
                    "target_track_km": 42.5,
                    "economic_savings_crores_inr": 3.8,
                },
                {
                    "campaign_id": "CAMP-2026-M09-B",
                    "title": "TRD 25kV OHE Catenary Renewal & Isolator Upgrade",
                    "duration_weeks": 2,
                    "total_mega_blocks": 8,
                    "allocated_fleet": ["TW-8W-042", "TW-8W-019"],
                    "projected_speed_restoration": "Eliminate critical neutral section sparking",
                    "target_track_km": 35.0,
                    "economic_savings_crores_inr": 1.9,
                },
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
