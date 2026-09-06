/**
 * ai-config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration settings for communication between Node.js backend
 * and Python AI microservices (REST API & child-process runner).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');

const AI_CONFIG = {
  // Python Runtime Path
  pythonPath: process.env.PYTHON_PATH || 'python',

  // Python Script Bridge Path
  pythonBridgeScript: path.resolve(__dirname, '..', 'services', 'python-bridge', 'python_runner.py'),

  // AI Inference REST Service
  apiBaseUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001',
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '15000', 10),

  // Strategy: 'REST_FIRST' (tries HTTP port 5001, falls back to python CLI if down)
  // Options: 'REST_FIRST', 'REST_ONLY', 'CLI_ONLY'
  executionStrategy: process.env.AI_EXECUTION_STRATEGY || 'REST_FIRST',

  // API Route Endpoints
  endpoints: {
    health: '/api/v1/health',
    healthModels: '/api/v1/health/models',
    healthDatabase: '/api/v1/health/database',

    priorityDefect: '/api/v1/prioritize/defect',
    priorityBatch: '/api/v1/prioritize/batch',
    priorityModelInfo: '/api/v1/priority/model-info',
    priorityRetrain: '/api/v1/priority/retrain',

    trafficOccupancy: '/api/v1/traffic/occupancy',
    trafficSlots: '/api/v1/traffic/slots',
    trafficBestSlots: '/api/v1/traffic/best-slots',
    trafficForecast: '/api/v1/traffic/forecast',

    optimizerSchedule: '/api/v1/optimize/schedule',
    optimizerBundle: '/api/v1/optimize/bundle',
    optimizerConstraints: '/api/v1/optimize/constraints',
    optimizerValidate: '/api/v1/optimize/validate',
  },

  // Retries & Resilience
  retryAttempts: 2,
  retryDelayMs: 500,
};

module.exports = AI_CONFIG;
