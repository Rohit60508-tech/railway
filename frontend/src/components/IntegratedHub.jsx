import React, { useState, useEffect } from 'react';
import { gatewayAPI, aiAPI } from '../services/apiClient';
import { streamAiChat } from '../services/aiStream';

export default function IntegratedHub() {
  const [gatewayStatus, setGatewayStatus] = useState('checking...');
  const [aiStatus, setAiStatus] = useState('checking...');
  const [prompt, setPrompt] = useState('USFD Flaw transverse crack detected at KM 142.4');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamOutput, setStreamOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Check health of both servers on mount
  useEffect(() => {
    gatewayAPI.getHealth()
      .then((res) => setGatewayStatus(res.status || 'OK'))
      .catch(() => setGatewayStatus('Offline'));

    aiAPI.getHealth()
      .then((res) => setAiStatus(res.status || 'OK'))
      .catch(() => setAiStatus('Offline'));
  }, []);

  const handleRunInference = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setOutput('');
    try {
      const result = await aiAPI.generateText(prompt);
      setOutput(result.text || result.response || JSON.stringify(result, null, 2));
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStream = () => {
    if (!prompt.trim()) return;
    setStreamOutput('');
    setIsStreaming(true);

    streamAiChat(
      [{ role: 'user', content: prompt }],
      (chunk) => {
        setStreamOutput((prev) => prev + chunk);
      },
      (err) => {
        setStreamOutput((prev) => prev + `\n[Stream Error]: ${err.message}`);
        setIsStreaming(false);
      }
    ).finally(() => setIsStreaming(false));
  };

  return (
    <div style={{ maxWidth: 740, margin: '2rem auto', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,51,102,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#003366', marginBottom: '16px' }}>Microservice Hub</h1>
      
      {/* Service Connectivity Indicators */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', padding: '12px 16px', background: '#FAF6EE', borderRadius: 8, border: '1px solid rgba(195,178,150,0.45)' }}>
        <div>Gateway (:5000 /api/v1): <strong style={{ color: gatewayStatus === 'Offline' ? '#DC2626' : '#059669' }}>{gatewayStatus}</strong></div>
        <div>Python AI (:5001 /ai): <strong style={{ color: aiStatus === 'Offline' ? '#DC2626' : '#059669' }}>{aiStatus}</strong></div>
      </div>

      {/* Inference Input */}
      <form onSubmit={handleRunInference} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '16px' }}>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt or query for Python AI..."
          style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '0.65rem 1.4rem', borderRadius: 8, border: 'none', background: '#003366', color: '#FFF', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Processing...' : 'Run Query'}
          </button>

          <button 
            type="button" 
            onClick={handleStartStream}
            disabled={isStreaming}
            style={{ padding: '0.65rem 1.4rem', borderRadius: 8, border: '1px solid #059669', background: 'rgba(5,150,105,0.08)', color: '#059669', fontWeight: '700', cursor: isStreaming ? 'not-allowed' : 'pointer' }}
          >
            {isStreaming ? 'Streaming Chunks...' : 'Stream Response (SSE)'}
          </button>
        </div>
      </form>

      {/* Response Display */}
      {output && (
        <div style={{ marginBottom: '16px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#003366' }}>Standard Inference Output:</strong>
          <pre style={{ background: '#f5f5f5', padding: '1rem', marginTop: '0.5rem', borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: '0.82rem', fontFamily: 'monospace' }}>
            {output}
          </pre>
        </div>
      )}

      {/* Streaming Display */}
      {streamOutput && (
        <div>
          <strong style={{ fontSize: '0.85rem', color: '#059669' }}>Streaming Output (Chunks):</strong>
          <pre style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', padding: '1rem', marginTop: '0.5rem', borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: '0.82rem', fontFamily: 'monospace', color: '#065F46' }}>
            {streamOutput}
          </pre>
        </div>
      )}
    </div>
  );
}
