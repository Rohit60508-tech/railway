"""
corridor_availability.py
─────────────────────────────────────────────────────────────────────────────
CorridorAvailabilityCalculator: Scans sectional train timetables, detects headway
gaps, and computes clean maintenance window opportunities at 15-minute granularity.
Enforces safety buffers, headway clearing times, and section clearing margins.
─────────────────────────────────────────────────────────────────────────────
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from shared.logger import get_logger
from shared.utils import coerce_iso_date

logger = get_logger("corridor_availability")


class CorridorAvailabilityCalculator:
    """
    Identifies available maintenance corridor slots along railway track sections
    between scheduled passenger, express, and freight train movements.
    """

    def __init__(
        self,
        granularity_minutes: int = 15,
        min_headway_buffer_minutes: int = 15,
        clearing_time_minutes: int = 10,
    ):
        self.granularity_minutes = granularity_minutes
        self.min_headway_buffer_minutes = min_headway_buffer_minutes
        self.clearing_time_minutes = clearing_time_minutes

    def calculate_open_intervals(
        self,
        train_events: List[Dict[str, Any]],
        search_start: datetime,
        search_end: datetime,
        min_duration_minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Scans train passage intervals and finds continuous intervals of unobstructed track.

        :param train_events: List of dicts with train_number, entry_time, exit_time
        :param search_start: Start of planning window
        :param search_end: End of planning window
        :param min_duration_minutes: Minimum viable window duration in minutes
        :return: List of open intervals with start_time, end_time, duration_minutes
        """
        search_start = coerce_iso_date(search_start) or datetime.now(timezone.utc)
        search_end = coerce_iso_date(search_end) or (search_start + timedelta(days=1))

        # Filter and normalize events within search horizon
        normalized_events: List[Tuple[datetime, datetime, str, str]] = []
        for ev in train_events:
            entry = coerce_iso_date(ev.get("entry_time") or ev.get("departure_time"))
            exit_ = coerce_iso_date(ev.get("exit_time") or ev.get("arrival_time"))
            train_no = str(ev.get("train_number", "UNKNOWN"))
            train_type = str(ev.get("train_type", "PASSENGER"))

            if entry and exit_ and exit_ > entry:
                # Add safety buffers: track is blocked from (entry - buffer) to (exit + clearing)
                buffered_start = max(search_start, entry - timedelta(minutes=self.min_headway_buffer_minutes))
                buffered_end = min(search_end, exit_ + timedelta(minutes=self.clearing_time_minutes))
                if buffered_end > search_start and buffered_start < search_end:
                    normalized_events.append((buffered_start, buffered_end, train_no, train_type))

        # Sort train intervals by entry time
        normalized_events.sort(key=lambda x: x[0])

        # Merge overlapping occupied periods
        merged_blocks: List[Tuple[datetime, datetime]] = []
        for b_start, b_end, _, _ in normalized_events:
            if not merged_blocks:
                merged_blocks.append((b_start, b_end))
            else:
                prev_start, prev_end = merged_blocks[-1]
                if b_start <= prev_end:
                    merged_blocks[-1] = (prev_start, max(prev_end, b_end))
                else:
                    merged_blocks.append((b_start, b_end))

        # Complement of merged blocks gives free intervals
        open_intervals: List[Dict[str, Any]] = []
        cursor = search_start

        for block_start, block_end in merged_blocks:
            if block_start > cursor:
                gap_duration = (block_start - cursor).total_seconds() / 60.0
                if gap_duration >= min_duration_minutes:
                    open_intervals.append({
                        "start_time": cursor,
                        "end_time": block_start,
                        "duration_minutes": int(gap_duration),
                        "preceding_train": None,
                        "succeeding_train": None,
                    })
            cursor = max(cursor, block_end)

        if cursor < search_end:
            tail_duration = (search_end - cursor).total_seconds() / 60.0
            if tail_duration >= min_duration_minutes:
                open_intervals.append({
                    "start_time": cursor,
                    "end_time": search_end,
                    "duration_minutes": int(tail_duration),
                    "preceding_train": None,
                    "succeeding_train": None,
                })

        return open_intervals

    def discretize_slots(
        self,
        interval: Dict[str, Any],
        required_duration_minutes: int = 120,
    ) -> List[Dict[str, Any]]:
        """
        Breaks down a large free interval into discrete starting slots using
        the configured time slot granularity (e.g. 15-minute steps).
        """
        start: datetime = interval["start_time"]
        end: datetime = interval["end_time"]
        req_td = timedelta(minutes=required_duration_minutes)
        step_td = timedelta(minutes=self.granularity_minutes)

        slots: List[Dict[str, Any]] = []
        curr = start

        while curr + req_td <= end:
            slot_end = curr + req_td
            slots.append({
                "slot_start": curr,
                "slot_end": slot_end,
                "duration_minutes": required_duration_minutes,
                "parent_interval_duration_minutes": interval["duration_minutes"],
                "leading_slack_minutes": int((curr - start).total_seconds() / 60.0),
                "trailing_slack_minutes": int((end - slot_end).total_seconds() / 60.0),
            })
            curr += step_td

        return slots
