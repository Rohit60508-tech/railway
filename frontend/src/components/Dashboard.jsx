import React, { useState, useEffect } from 'react';

const GATEWAY_URL = import.meta.env.VITE_API_URL || '/api/v1';
const AI_URL = import.meta.env.VITE_AI_URL || '/ai/api/v1';
const AI_KEY = import.meta.env.VITE_AI_API_KEY || 'ir-ai-key-2026';

export default function Dashboard() {
  const [defects, setDefects] = useState([]);
  const [description, setDescription] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Fetch existing defects from Node Gateway (:5000)
  useEffect(() => {
    fetch(`${GATEWAY_URL}/defects`)
      .then((res) => res.json())
      .then((data) => setDefects(data.defects || data.items || (Array.isArray(data) ? data : [])))
      .catch((err) => console.log('Gateway fetch notice:', err.message));
  }, []);

  // 2. Submit defect to Python AI Microservice (:5001) for priority scoring
  const handleAnalyzeDefect = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setAiAnalysis(null);

    try {
      const endpoint = `${AI_URL}/agents/defect_priority_agent/run`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI_KEY,
        },
        body: JSON.stringify({
          payload: {
            text: description,
            description: description,
            input: description
          }
        }),
      });

      if (!res.ok) {
        const errDetail = await res.json().catch(() => ({}));
        throw new Error(errDetail.detail || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      console.error('AI Agent execution failed:', err);
      setAiAnalysis({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif', color: '#0F172A' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#003366', marginBottom: '20px' }}>
        IR AI Maintenance Dashboard
      </h1>

      {/* Defect Analysis Input */}
      <section style={{ marginBottom: '32px', border: '1px solid #CBD5E1', padding: '20px', borderRadius: '10px', background: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#003366', marginBottom: '12px' }}>
          Report & Prioritize Track/Rolling Stock Defect
        </h3>
        <form onSubmit={handleAnalyzeDefect}>
          <textarea
            rows={3}
            style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #94A3B8', fontSize: '0.9rem', outline: 'none' }}
            placeholder="E.g., Severe rail crack observed near KM 142 on NDLS-CNB section..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '12px', padding: '10px 20px', borderRadius: '6px', border: 'none',
              background: 'linear-gradient(135deg, #003366 0%, #0056B3 100%)', color: '#FFFFFF',
              fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Analyzing with AI Agent...' : 'Analyze Defect Priority'}
          </button>
        </form>

        {aiAnalysis && (
          <div style={{ marginTop: '20px', background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0369A1' }}>AI Priority Evaluation:</h4>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.82rem', fontFamily: 'monospace', color: '#0C4A6E' }}>
              {JSON.stringify(aiAnalysis, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Gateway Records List */}
      <section style={{ border: '1px solid #CBD5E1', padding: '20px', borderRadius: '10px', background: '#FFFFFF' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#003366', marginBottom: '12px' }}>
          Active Defects in Ledger
        </h3>
        {defects.length === 0 ? (
          <p style={{ color: '#666' }}>No defects loaded from backend gateway.</p>
        ) : (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {defects.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '6px', fontSize: '0.9rem' }}>
                {item.title || item.description || item.name || JSON.stringify(item)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
