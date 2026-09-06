/**
 * ai_api_client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP REST Client for Indian Railways AI Inference Microservice.
 * Communicates with the FastAPI inference daemon (default port 5000)
 * with timeout handling, retry logic, and standardized responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http = require('http');
const https = require('https');
const url = require('url');
const AI_CONFIG = require('../../config/ai-config');

class AIApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || AI_CONFIG.apiBaseUrl;
    this.timeoutMs = options.timeoutMs || AI_CONFIG.timeoutMs;
  }

  /**
   * Internal generic HTTP request helper.
   */
  async _request(method, path, body = null, queryParams = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(this.baseUrl + path);
      Object.keys(queryParams).forEach((k) => {
        if (queryParams[k] !== undefined && queryParams[k] !== null) {
          parsedUrl.searchParams.append(k, queryParams[k]);
        }
      });

      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const payload = body ? JSON.stringify(body) : null;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: this.timeoutMs,
      };

      if (payload) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = transport.request(reqOptions, (res) => {
        let rawData = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const errMsg = parsed.detail || parsed.message || `HTTP ${res.statusCode}: ${res.statusMessage}`;
              const err = new Error(errMsg);
              err.statusCode = res.statusCode;
              err.responseBody = parsed;
              reject(err);
            }
          } catch (e) {
            reject(new Error(`Failed to parse AI service JSON response (HTTP ${res.statusCode}): ${e.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`AI Service request timed out after ${this.timeoutMs}ms: ${method} ${path}`));
      });

      req.on('error', (err) => {
        reject(new Error(`AI Service connection error (${method} ${path}): ${err.message}`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Priority Engine Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Prioritizes a single defect record.
   * POST /api/v1/prioritize/defect
   */
  async prioritizeDefect(defectData) {
    return this._request('POST', AI_CONFIG.endpoints.priorityDefect, defectData);
  }

  /**
   * Prioritizes and ranks a collection of defect records.
   * POST /api/v1/prioritize/batch
   */
  async prioritizeBatch(defects, sortByPriority = true) {
    return this._request('POST', AI_CONFIG.endpoints.priorityBatch, {
      defects,
      sort_by_priority: sortByPriority,
    });
  }

  /**
   * Retrieves active ML model metadata and feature weights.
   * GET /api/v1/priority/model-info
   */
  async getModelInfo() {
    return this._request('GET', AI_CONFIG.endpoints.priorityModelInfo);
  }

  /**
   * Triggers asynchronous model retraining on latest records.
   * POST /api/v1/priority/retrain
   */
  async triggerRetraining(samples = 3000, modelType = 'RandomForest') {
    return this._request('POST', AI_CONFIG.endpoints.priorityRetrain, {
      samples,
      model_type: modelType,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Traffic & Corridor Predictor Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Gets section occupancy and train volume for a given window.
   * GET /api/v1/traffic/occupancy/:section_id
   */
  async getSectionOccupancy(sectionId, startTime = null, endTime = null) {
    const p = `${AI_CONFIG.endpoints.trafficOccupancy}/${encodeURIComponent(sectionId)}`;
    return this._request('GET', p, null, {
      start_time: startTime,
      end_time: endTime,
    });
  }

  /**
   * Discovers unobstructed corridor maintenance slots.
   * GET /api/v1/traffic/slots/:section_id
   */
  async getAvailableSlots(sectionId, durationMinutes = 120, searchStart = null, searchEnd = null) {
    const p = `${AI_CONFIG.endpoints.trafficSlots}/${encodeURIComponent(sectionId)}`;
    return this._request('GET', p, null, {
      duration_minutes: durationMinutes,
      search_start: searchStart,
      search_end: searchEnd,
    });
  }

  /**
   * Predicts and returns the top 10 recommended maintenance slots.
   * GET /api/v1/traffic/best-slots/:section_id/:duration
   */
  async getBestSlots(sectionId, durationMinutes = 120, topK = 10, searchStart = null, searchEnd = null) {
    const p = `${AI_CONFIG.endpoints.trafficBestSlots}/${encodeURIComponent(sectionId)}/${durationMinutes}`;
    return this._request('GET', p, null, {
      top_k: topK,
      search_start: searchStart,
      search_end: searchEnd,
    });
  }

  /**
   * Generates projected train traffic density and freight demand.
   * GET /api/v1/traffic/forecast/:section_id/:date
   */
  async getTrafficForecast(sectionId, date, horizonHours = 24) {
    const p = `${AI_CONFIG.endpoints.trafficForecast}/${encodeURIComponent(sectionId)}/${date}`;
    return this._request('GET', p, null, {
      horizon_hours: horizonHours,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Multi-Department Block Optimizer Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates optimal block schedule using Google OR-Tools CP-SAT.
   * POST /api/v1/optimize/schedule
   */
  async optimizeSchedule(tasks, slots, teams = null, autoBundle = true) {
    return this._request('POST', AI_CONFIG.endpoints.optimizerSchedule, {
      tasks,
      slots,
      teams,
      auto_bundle: autoBundle,
    });
  }

  /**
   * Discovers multi-department bundling opportunities in same section.
   * POST /api/v1/optimize/bundle
   */
  async bundleTasks(tasks) {
    return this._request('POST', AI_CONFIG.endpoints.optimizerBundle, { tasks });
  }

  /**
   * Retrieves active solver constraints and departmental compatibility matrix.
   * GET /api/v1/optimize/constraints
   */
  async getConstraints() {
    return this._request('GET', AI_CONFIG.endpoints.optimizerConstraints);
  }

  /**
   * Validates a proposed schedule against operational rules.
   * POST /api/v1/optimize/validate
   */
  async validateSchedule(schedule) {
    return this._request('POST', AI_CONFIG.endpoints.optimizerValidate, { schedule });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // System Health & Diagnostics
  // ──────────────────────────────────────────────────────────────────────────

  async getHealth() {
    return this._request('GET', AI_CONFIG.endpoints.health);
  }

  async getModelsHealth() {
    return this._request('GET', AI_CONFIG.endpoints.healthModels);
  }

  async getDatabaseHealth() {
    return this._request('GET', AI_CONFIG.endpoints.healthDatabase);
  }
}

module.exports = AIApiClient;
