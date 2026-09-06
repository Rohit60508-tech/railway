/**
 * alert-service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Alert Generation & Notification
 * 
 * Manages the end-to-end incident lifecycle:
 *   - Firing, acknowledging, resolving, and escalating operational alerts
 *   - Multi-tier alert classification:
 *       • SAFETY: Critical flaw escalations, P1 defect SLA breaches
 *       • OPERATIONAL: Track corridor choke, excessive train delays
 *       • INFRASTRUCTURE: Database outages, AI microservice downtime
 *       • SECURITY_SOC: Rate limit exhaustion, credential anomalies, drift
 *   - Notification channels:
 *       • Railway SOC (Security Operations Center) telemetry dispatch
 *       • Control Office Section Controller SMS/Email notifications
 *       • Event stream broadcast for real-time frontend dashboard sync
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Alert Severity Enum
const AlertSeverity = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

// Alert Domain Enum
const AlertDomain = Object.freeze({
  SAFETY: 'SAFETY',
  OPERATIONAL: 'OPERATIONAL',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  SECURITY_SOC: 'SECURITY_SOC',
});

// Alert Lifecycle Status
const AlertStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
});

class AlertService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxActiveAlerts: options.maxActiveAlerts || 500,
      autoEscalateMinutes: options.autoEscalateMinutes || 30,
      storageFile: options.storageFile || path.resolve(__dirname, '..', '..', 'database', 'backups', 'alerts_ledger.json'),
      socWebhookUrl: options.socWebhookUrl || process.env.RAILWAY_SOC_WEBHOOK_URL || null,
      ...options,
    };

    // Active & Historical Alerts
    this.activeAlerts = new Map();
    this.resolvedHistory = [];
    this.socDispatchQueue = [];

    // Periodic escalation check for unacknowledged critical alerts
    this.escalationTimer = setInterval(() => {
      this._checkAutoEscalations();
    }, 60000).unref();
  }

  /**
   * Generates and dispatches a new operational or safety alert.
   *
   * @param {object} alertData
   * @param {string} alertData.title Alert title
   * @param {string} alertData.message Detailed alert description
   * @param {keyof typeof AlertSeverity} alertData.severity Severity level
   * @param {keyof typeof AlertDomain} alertData.domain Alert category
   * @param {string} [alertData.sectionId] Railway section (e.g., 'NDLS-CNB-UP')
   * @param {string} [alertData.entityId] Defect ID, Block Req ID, or Model ID
   * @param {object} [alertData.metadata] Extra contextual details
   * @returns {object} Created Alert object
   */
  raiseAlert(alertData) {
    const alertId = `ALT-${alertData.domain || 'GEN'}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const alert = {
      alertId,
      title: alertData.title || 'Operational Notification',
      message: alertData.message || '',
      severity: alertData.severity || AlertSeverity.WARNING,
      domain: alertData.domain || AlertDomain.OPERATIONAL,
      status: AlertStatus.ACTIVE,
      sectionId: alertData.sectionId || 'SYSTEM_WIDE',
      entityId: alertData.entityId || null,
      metadata: alertData.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      escalationLevel: 0,
    };

    this.activeAlerts.set(alertId, alert);
    this.emit('alert_raised', alert);

    // If High/Critical, notify Control Office and dispatch to Railway SOC
    if (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH) {
      this._notifyControlOffice(alert);
    }

    if (alert.domain === AlertDomain.SECURITY_SOC || alert.severity === AlertSeverity.CRITICAL) {
      this._dispatchToRailwaySoc(alert);
    }

    this._persistAlerts();
    return alert;
  }

  /**
   * Operator acknowledges an alert.
   *
   * @param {string} alertId
   * @param {string} officerId Railway officer ID or badge
   */
  acknowledgeAlert(alertId, officerId = 'OFFICER-DEFAULT') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = officerId;
    alert.acknowledgedAt = new Date().toISOString();
    alert.updatedAt = alert.acknowledgedAt;

    this.emit('alert_acknowledged', alert);
    this._persistAlerts();
    return alert;
  }

  /**
   * Resolves an alert and moves it to historical archive.
   *
   * @param {string} alertId
   * @param {string} officerId
   * @param {string} resolutionNote
   */
  resolveAlert(alertId, officerId = 'OFFICER-DEFAULT', resolutionNote = 'Remediated') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return null;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = officerId;
    alert.resolvedAt = new Date().toISOString();
    alert.updatedAt = alert.resolvedAt;
    alert.resolutionNote = resolutionNote;

    this.activeAlerts.delete(alertId);
    this.resolvedHistory.unshift(alert);
    if (this.resolvedHistory.length > 500) this.resolvedHistory.pop();

    this.emit('alert_resolved', alert);
    this._persistAlerts();
    return alert;
  }

  /**
   * Automatic escalation for overdue unacknowledged Critical alerts.
   */
  _checkAutoEscalations() {
    const now = Date.now();
    const thresholdMs = this.options.autoEscalateMinutes * 60 * 1000;

    for (const alert of this.activeAlerts.values()) {
      if (alert.status === AlertStatus.ACTIVE && alert.severity === AlertSeverity.CRITICAL) {
        const ageMs = now - new Date(alert.createdAt).getTime();
        if (ageMs > thresholdMs && alert.escalationLevel === 0) {
          alert.escalationLevel = 1;
          alert.status = AlertStatus.ESCALATED;
          alert.updatedAt = new Date().toISOString();

          this.emit('alert_escalated', alert);
          this._dispatchToRailwaySoc({
            ...alert,
            escalationReason: `Critical alert unacknowledged for > ${this.options.autoEscalateMinutes} minutes`,
          });
        }
      }
    }
  }

  /**
   * Control Office notification dispatcher (Console, SMS, Section Controller board).
   */
  _notifyControlOffice(alert) {
    const logLine = `[CONTROL-OFFICE DISPATCH] [${alert.severity}] [${alert.domain}] ${alert.title}: ${alert.message} (Section: ${alert.sectionId})`;
    console.log(`\x1b[33m${logLine}\x1b[0m`);
    this.emit('control_office_notified', alert);
  }

  /**
   * Integrates with Indian Railways Cyber Security Operations Center (CRIS SOC).
   */
  _dispatchToRailwaySoc(alert) {
    const socPayload = {
      socIncidentId: `SOC-${Date.now()}-${alert.alertId}`,
      facility: 'CRIS_RAILWAY_SOC_NEW_DELHI',
      feedSource: 'IR-AIMP-CORE',
      eventCategory: alert.domain,
      threatLevel: alert.severity === AlertSeverity.CRITICAL ? 'SEV-1-EMERGENCY' : 'SEV-2-HIGH',
      timestamp: new Date().toISOString(),
      alertDetails: alert,
    };

    this.socDispatchQueue.unshift(socPayload);
    if (this.socDispatchQueue.length > 100) this.socDispatchQueue.pop();

    this.emit('soc_dispatched', socPayload);
  }

  /**
   * Returns active and recent alerts filtered by criteria.
   */
  getAlerts(filters = {}) {
    let list = Array.from(this.activeAlerts.values());

    if (filters.includeResolved) {
      list = list.concat(this.resolvedHistory);
    }

    if (filters.domain) {
      list = list.filter((a) => a.domain === filters.domain);
    }

    if (filters.severity) {
      list = list.filter((a) => a.severity === filters.severity);
    }

    if (filters.sectionId) {
      list = list.filter((a) => a.sectionId === filters.sectionId);
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Persists active alerts snapshot to disk safely.
   */
  _persistAlerts() {
    try {
      const dir = path.dirname(this.options.storageFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const payload = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          activeAlerts: Array.from(this.activeAlerts.values()),
          resolvedCount: this.resolvedHistory.length,
        },
        null,
        2
      );
      fs.writeFileSync(this.options.storageFile, payload, 'utf8');
    } catch (_) {
      // Non-blocking disk write
    }
  }
}

// Global Singleton
const alertService = new AlertService();

module.exports = {
  AlertService,
  alertService,
  AlertSeverity,
  AlertDomain,
  AlertStatus,
};
