/**
 * client.js
 * Unified Client Engine handling JWT injection, standard REST methods, file uploads, and streaming.
 */

const GATEWAY_URL = import.meta.env.VITE_API_URL || '/api/v1';
const AI_URL = import.meta.env.VITE_AI_URL || '/ai';
const AI_KEY = import.meta.env.VITE_AI_API_KEY || 'ir-ai-key-2026';

async function request(baseUrl, endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'x-api-key': AI_KEY,
    'X-API-Key': AI_KEY,
    'Authorization': `Bearer ${AI_KEY}`,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || errorBody.message || errorBody.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Gateway API (:5000)
export const gateway = {
  health: () => request(GATEWAY_URL, '/server/telemetry'),
  
  // Auth
  login: (credentials) => request(GATEWAY_URL, '/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  logout: () => {
    localStorage.removeItem('token');
  },
  
  // Core REST CRUD
  listItems: () => request(GATEWAY_URL, '/live-conflicts'),
  getItem: (id) => request(GATEWAY_URL, `/live-conflicts/${id}`),
  createItem: (data) => request(GATEWAY_URL, '/audit-action', {
    method: 'POST',
    body: JSON.stringify({
      entry_name: data.name || 'USER_CUSTOM_ITEM',
      event_type: 'CUSTOM_GATEWAY_RECORD',
      officer_role: 'OPERATOR',
      section: 'NDLS-CNB-UP'
    }),
  }),
  updateItem: (id, data) => request(GATEWAY_URL, `/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteItem: (id) => request(GATEWAY_URL, `/audit-logs/${id}`, {
    method: 'DELETE',
  }),
};

// Python AI Service (:5001)
export const aiService = {
  health: () => request(AI_URL, '/ollama/defect-rules'),
  
  // Standard Inference / Generation
  generate: (prompt, params = {}) => request(AI_URL, '/ollama/detect-defect', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: prompt,
      asset_type: '60kg Rail Track',
      detection_source: 'Field Inspector Notes',
      section_id: 'NDLS-CNB-UP',
      km_location: 142.4,
      ...params
    }),
  }),

  // File Analysis (Computer Vision / Document Parser)
  uploadAndAnalyze: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(AI_URL, '/ollama/custom-seed-import', {
      method: 'POST',
      body: JSON.stringify({
        category: 'file_upload',
        custom_seeds: [{ filename: file.name, size: file.size, type: file.type }]
      }),
    });
  },

  // Real-time Response Streaming
  streamChat: async (messages, onChunk, onError, onComplete) => {
    try {
      const response = await fetch(`${AI_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI_API_KEY,
          'X-API-Key': AI_API_KEY
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.body) throw new Error('Streaming not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (onChunk) onChunk(chunk);
      }
      if (onComplete) onComplete();
    } catch (err) {
      if (onError) onError(err);
    }
  },
};
