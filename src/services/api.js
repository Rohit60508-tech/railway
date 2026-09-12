/**
 * api.js
 * API Client Service connecting React components to Node Gateway (:5000) & Python AI Microservices (:5001).
 */

// Base paths matching Vite proxy setup
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const AI_BASE = import.meta.env.VITE_AI_URL || '/ai';

// Backend Gateway (:5000) status check
export const getGatewayStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}/server/telemetry`, {
      headers: { 'X-API-Key': 'ir-ai-key-2026' }
    });
    if (!res.ok) throw new Error(`Gateway Error: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return { status: 'ONLINE', mode: 'API_GATEWAY_NODE', timestamp: new Date().toISOString() };
  }
};

// Python AI Microservice (:5001) inference prompt
export const sendAiPrompt = async (prompt) => {
  const res = await fetch(`${AI_BASE}/ollama/detect-defect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'ir-ai-key-2026'
    },
    body: JSON.stringify({
      raw_text: prompt,
      asset_type: '60kg Rail Track',
      detection_source: 'Field Inspector Notes',
      section_id: 'NDLS-CNB-UP',
      km_location: 142.4
    }),
  });
  if (!res.ok) throw new Error(`AI Service Error: ${res.statusText}`);
  return await res.json();
};
