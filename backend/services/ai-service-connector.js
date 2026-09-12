/**
 * ai-service-connector.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central orchestrator connecting Node.js backend to Python AI microservices.
 * Supports dual-mode execution:
 *   1. High-performance REST API calls to FastAPI inference daemon (Port 5000)
 *   2. Resilient Child Process fallback running python_runner.py if daemon is offline
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { spawn } = require('child_process');
const AI_CONFIG = require('../config/ai-config');
const AIApiClient = require('./python-bridge/ai_api_client');
const ResultParser = require('./python-bridge/result_parser');

class AIServiceConnector {
  constructor(options = {}) {
    this.config = { ...AI_CONFIG, ...options };
    this.client = new AIApiClient({
      baseUrl: this.config.apiBaseUrl,
      timeoutMs: this.config.timeoutMs,
    });
    this.isRestAvailable = null;
    this.lastHealthCheck = null;
  }

  /**
   * Executes a Python script command directly via child_process as fallback.
   */
  async _executePythonCLI(command, payload = {}) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.config.pythonPath;
      const scriptPath = this.config.pythonBridgeScript;
      const payloadStr = JSON.stringify(payload);

      const args = [scriptPath, command, '--input', payloadStr];
      const child = spawn(pythonExe, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process (${pythonExe}): ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Find JSON line from stdout, scanning from bottom up to ignore any preceding log messages
            const lines = stdoutData.trim().split('\n');
            let parsed = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                try {
                  parsed = JSON.parse(line);
                  break;
                } catch (_) {}
              }
            }
            if (!parsed) {
              parsed = JSON.parse(stdoutData.trim());
            }
            resolve(parsed.data || parsed);
          } catch (e) {
            reject(new Error(`Failed to parse CLI output from ${command}: ${e.message}\nOutput was: ${stdoutData}`));
          }
        } else {
          const errDetail = stderrData.trim() || stdoutData.trim() || `Exit code ${code}`;
          reject(new Error(`Python CLI error in ${command} (exit ${code}): ${errDetail}`));
        }
      });
    });
  }

  /**
   * Dual-mode executor: tries REST first, falls back to Python CLI runner.
   */
  async _execute(restCall, cliCommand, cliPayload) {
    if (this.config.executionStrategy === 'CLI_ONLY') {
      return this._executePythonCLI(cliCommand, cliPayload);
    }

    try {
      const result = await restCall();
      this.isRestAvailable = true;
      return result;
    } catch (restErr) {
      if (this.config.executionStrategy === 'REST_ONLY') {
        throw restErr;
      }
      // Log warning and gracefully fall back to local Python CLI execution
      console.warn(`[AIServiceConnector] REST failed (${restErr.message}). Falling back to Python CLI runner for '${cliCommand}'...`);
      this.isRestAvailable = false;
      return this._executePythonCLI(cliCommand, cliPayload);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Defect Priority Operations
  // ──────────────────────────────────────────────────────────────────────────

  async prioritizeDefect(defectData) {
    const raw = await this._execute(
      () => this.client.prioritizeDefect(defectData),
      'prioritize_defect',
      defectData
    );
    return ResultParser.parsePriorityResult(raw);
  }

  async prioritizeBatch(defects, sortByPriority = true) {
    const raw = await this._execute(
      () => this.client.prioritizeBatch(defects, sortByPriority),
      'prioritize_batch',
      { defects, sort_by_priority: sortByPriority }
    );
    return ResultParser.parseBatchPriorityResult(raw);
  }

  async getModelInfo() {
    return this._execute(
      () => this.client.getModelInfo(),
      'model_info',
      {}
    );
  }

  async triggerRetraining(samples = 3000, modelType = 'RandomForest') {
    return this.client.triggerRetraining(samples, modelType);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Traffic & Corridor Operations
  // ──────────────────────────────────────────────────────────────────────────

  async getSectionOccupancy(sectionId, startTime = null, endTime = null) {
    const raw = await this._execute(
      () => this.client.getSectionOccupancy(sectionId, startTime, endTime),
      'calculate_occupancy',
      { section_id: sectionId, start_time: startTime, end_time: endTime }
    );
    return ResultParser.parseOccupancyResult(raw);
  }

  async findCorridorSlots(sectionId, durationMinutes = 120, searchStart = null, searchEnd = null) {
    const raw = await this._execute(
      () => this.client.getAvailableSlots(sectionId, durationMinutes, searchStart, searchEnd),
      'find_slots',
      { section_id: sectionId, duration_minutes: durationMinutes, start_time: searchStart, end_time: searchEnd }
    );
    return ResultParser.parseSlotsResult(raw);
  }

  async getBestMaintenanceSlots(sectionId, durationMinutes = 120, topK = 10, searchStart = null, searchEnd = null) {
    const raw = await this._execute(
      () => this.client.getBestSlots(sectionId, durationMinutes, topK, searchStart, searchEnd),
      'predict_best_slots',
      { section_id: sectionId, duration_minutes: durationMinutes, top_k: topK, search_start: searchStart, search_end: searchEnd }
    );
    return ResultParser.parseSlotsResult(raw);
  }

  async getTrafficForecast(sectionId, date, horizonHours = 24) {
    return this._execute(
      () => this.client.getTrafficForecast(sectionId, date, horizonHours),
      'traffic_forecast',
      { section_id: sectionId, date, horizon_hours: horizonHours }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Block Optimization Operations
  // ──────────────────────────────────────────────────────────────────────────

  async optimizeSchedule(tasks, slots, teams = null, autoBundle = true) {
    const raw = await this._execute(
      () => this.client.optimizeSchedule(tasks, slots, teams, autoBundle),
      'optimize_schedule',
      { tasks, slots, teams, auto_bundle: autoBundle }
    );
    return ResultParser.parseOptimizationResult(raw);
  }

  async bundleTasks(tasks) {
    const raw = await this._execute(
      () => this.client.bundleTasks(tasks),
      'bundle_tasks',
      { tasks }
    );
    return ResultParser.parseBundleResult(raw);
  }

  async checkDepartmentCompatibility(dept1, dept2) {
    return this._executePythonCLI('check_compatibility', { dept1, dept2 });
  }

  async getOptimizationConstraints() {
    return this.client.getConstraints();
  }

  async post(path, body) {
    return this.client.post(path, body);
  }

  async get(path, queryParams = {}) {
    return this.client.get(path, queryParams);
  }

  async delete(path) {
    return this.client.delete(path);
  }

  async validateSchedule(schedule) {
    return this.client.validateSchedule(schedule);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Health & Readiness
  // ──────────────────────────────────────────────────────────────────────────

  async checkHealth() {
    try {
      const restHealth = await this.client.getHealth();
      this.isRestAvailable = true;
      return {
        mode: 'REST_DAEMON',
        server: restHealth,
      };
    } catch (err) {
      this.isRestAvailable = false;
      const cliHealth = await this._executePythonCLI('health', {});
      return {
        mode: 'FALLBACK_CHILD_PROCESS',
        server: cliHealth,
        restError: err.message,
      };
    }
  }
}

// Global connector singleton
const aiServiceConnector = new AIServiceConnector();

module.exports = {
  AIServiceConnector,
  aiServiceConnector,
};
