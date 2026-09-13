/**
 * frontend/components/shared-live-sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIVERSAL REAL-TIME DATA SYNC SERVICE & EVENT BROADCASTER
 *
 * Provides periodic, lightweight background synchronization across all pages
 * for live train movements, database audit logs, requested maintenance windows,
 * and AI traffic agent metrics.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  class UniversalLiveSync {
    constructor() {
      this.listeners = new Map();
      this.pollIntervalMs = 5000; // 5 second polling interval
      this.timer = null;
      this.lastTrainCount = 0;
      this.lastConflictCount = 0;
      this.init();
    }

    init() {
      console.log('⚡ [Real-Time Sync] Initializing global live data listener...');
      this.startPolling();
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(cb => {
          try { cb(data); } catch (err) { console.warn(`[Real-Time Sync] Error in listener for ${event}:`, err); }
        });
      }
    }

    async fetchAllLiveData() {
      try {
        // 1. Fetch Live Requested Windows & Conflicts
        const conflictRes = await fetch('/api/v1/live-conflicts').catch(() => null);
        if (conflictRes && conflictRes.ok) {
          const conflicts = await conflictRes.json();
          this.emit('conflicts_updated', conflicts);
          if (conflicts.length !== this.lastConflictCount) {
            this.lastConflictCount = conflicts.length;
            this.emit('conflict_count_changed', conflicts.length);
          }
        }

        // 2. Fetch Live Traffic Agent Corridor Occupancy
        const trafficRes = await fetch('/api/v1/agents/traffic-forecast/live').catch(() => null);
        if (trafficRes && trafficRes.ok) {
          const traffic = await trafficRes.json();
          this.emit('traffic_forecast_updated', traffic);
        }

        // 3. Fetch Live System & Database Status
        const statusRes = await fetch('/api/v1/supabase/status').catch(() => null);
        if (statusRes && statusRes.ok) {
          const status = await statusRes.json();
          this.emit('database_status_updated', status);
        }
      } catch (e) {
        console.warn('⚡ [Real-Time Sync] Background poll error:', e);
      }
    }

    startPolling() {
      if (this.timer) clearInterval(this.timer);
      this.fetchAllLiveData();
      this.timer = setInterval(() => this.fetchAllLiveData(), this.pollIntervalMs);
    }

    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  window.IR_LIVE_SYNC = new UniversalLiveSync();
})();
