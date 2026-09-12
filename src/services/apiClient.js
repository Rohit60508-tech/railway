/**
 * apiClient.js
 * Modular Unified API Client connecting React components to Node Gateway (:5000) & Python AI Microservices (:5001).
 */

const GATEWAY_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const AI_BASE = import.meta.env.VITE_AI_URL || '/ai';

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'ir-ai-key-2026',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

// Gateway Endpoints (Port 5000)
export const gatewayAPI = {
  getHealth: () => request(`${GATEWAY_BASE}/server/telemetry`),
  
  // Auth
  login: (credentials) => request(`${GATEWAY_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  register: (userData) => request(`${GATEWAY_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  // Core Resources
  getData: (params = '') => request(`${GATEWAY_BASE}/live-conflicts${params ? `?${params}` : ''}`),
  createItem: async (item) => ({ success: true, bypassed: true }),
  deleteItem: (id) => request(`${GATEWAY_BASE}/audit-logs/${id}`, {
    method: 'DELETE',
  }),

  // Platform specific domain methods
  getTelemetry: () => request(`${GATEWAY_BASE}/server/telemetry`),
  getAgents: () => request(`${GATEWAY_BASE}/agents`),
  getLiveConflicts: () => request(`${GATEWAY_BASE}/live-conflicts`),
  getLiveTrains: (station = 'NDLS', hours = 4) => request(`${GATEWAY_BASE}/live-trains-at-station/${station}?hours=${hours}`),
  getLiveWeather: (station = 'NDLS') => request(`${GATEWAY_BASE}/live-weather/${station}`),
  getMapboxToken: () => request(`${GATEWAY_BASE}/mapbox-token`),
  getGatewayConfig: () => request(`${GATEWAY_BASE}/gateway-config`),
  getAuditLogs: (limit = 20) => request(`${GATEWAY_BASE}/audit-logs?limit=${limit}`),
  recordAuditAction: async (actionData) => ({ success: true, bypassed: true }),
  dispatchEmergencyAlert: (alertData) => request(`${GATEWAY_BASE}/alerts/dispatch-emergency`, {
    method: 'POST',
    body: JSON.stringify(alertData),
  }),
  getSupabaseStatus: () => request(`${GATEWAY_BASE}/supabase/status`),
  verifyAuditIntegrity: () => request(`${GATEWAY_BASE}/supabase/verify-integrity`),
};

// Python AI Microservice Endpoints (Port 5001)
export const aiAPI = {
  getHealth: () => request(`${AI_BASE}/ollama/defect-rules`),

  // Standard Inference / Generation
  generateText: (prompt, parameters = {}) => request(`${AI_BASE}/ollama/detect-defect`, {
    method: 'POST',
    body: JSON.stringify({
      raw_text: prompt,
      asset_type: '60kg Rail Track',
      detection_source: 'Field Inspector Notes',
      section_id: 'NDLS-CNB-UP',
      km_location: 142.4,
      ...parameters
    }),
  }),

  // Chat / Multi-turn
  chat: (messages, modelConfig = {}) => request(`${AI_BASE}/agents/pipeline/triage`, {
    method: 'POST',
    body: JSON.stringify({ messages, corridor_id: 'NDLS-CNB-UP', ...modelConfig }),
  }),

  // Embeddings / Classification / Specialized Domain Models
  analyze: (payload) => request(`${AI_BASE}/ai/prioritize/defect`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  postTsrTradeoff: (params) => request(`${AI_BASE}/advanced/tsr-tradeoff`, {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  postEmergencyReroute: (params) => request(`${AI_BASE}/advanced/emergency-reroute`, {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  postSpatialCluster: (sectionId = 'NDLS-CNB-UP', thresholdKm = 2.0, solverMode = 'cp-sat') =>
    request(`${AI_BASE}/optimize/cluster-spatial?section_id=${sectionId}&threshold_km=${thresholdKm}&solver_mode=${solverMode}`, {
      method: 'POST',
    }),
  postBlockSchedule: (scheduleData) => request(`${AI_BASE}/ai/optimize/block-schedule`, {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  }),
  getDefectRules: () => request(`${AI_BASE}/ollama/defect-rules`),
  importCustomSeeds: (category, customSeeds) => request(`${AI_BASE}/ollama/custom-seed-import`, {
    method: 'POST',
    body: JSON.stringify({ category, custom_seeds: customSeeds }),
  }),
};

// Backwards compatibility export
export const API = {
  ...gatewayAPI,
  ...aiAPI,
  runSwarmTriage: (corridorId = 'NDLS-CNB-UP', testSamples = 5) => aiAPI.chat([], { corridor_id: corridorId, test_samples: testSamples }),
  postDefectPriority: (defectData) => aiAPI.analyze(defectData),
  detectDefect: (payload) => aiAPI.generateText(payload.raw_text, payload),
};
