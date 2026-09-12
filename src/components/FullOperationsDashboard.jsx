import React, { useState, useEffect } from 'react';
import { gateway, aiService } from '../services/client';
import { useServiceHealth } from '../hooks/useServices';

export default function FullOperationsDashboard() {
  const { status, checkHealth } = useServiceHealth();

  // Gateway state
  const [items, setItems] = useState([
    { id: '1', name: 'Sanctioned Corridor Possession Slot #102' },
    { id: '2', name: 'USFD Ultrasonic Flaw Audit Record #409' }
  ]);
  const [newItemText, setNewItemText] = useState('');

  // AI state
  const [prompt, setPrompt] = useState('USFD Flaw transverse crack detected at KM 142.4');
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState(null);

  // Load items from gateway
  useEffect(() => {
    if (status.gateway === 'online') {
      gateway.listItems()
        .then((res) => {
          if (Array.isArray(res)) setItems(res);
          else if (res && res.conflicts) setItems(res.conflicts.map((c, i) => ({ id: String(i + 1), name: `${c.train_name || 'Train'} Conflict at ${c.section_id || 'Corridor'}` })));
        })
        .catch(console.error);
    }
  }, [status.gateway]);

  // Handle Gateway Create
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    try {
      const created = await gateway.createItem({ name: newItemText });
      const newItem = { id: String(Date.now()), name: newItemText };
      setItems((prev) => [...prev, newItem]);
      setNewItemText('');
    } catch (err) {
      alert(`Create failed: ${err.message}`);
    }
  };

  // Handle Gateway Delete
  const handleDeleteItem = async (id) => {
    try {
      await gateway.deleteItem(id).catch(() => {});
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Handle AI Chat Streaming
  const handleStreamAI = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    setStreamedText('');
    setIsStreaming(true);

    await aiService.streamChat(
      [{ role: 'user', content: prompt }],
      (chunk) => setStreamedText((prev) => prev + chunk),
      (err) => setStreamedText(`Error: ${err.message}`),
      () => setIsStreaming(false)
    );
  };

  // Handle AI File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await aiService.uploadAndAnalyze(file);
      setFileAnalysis(result);
    } catch (err) {
      alert(`File analysis failed: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'Inter, system-ui, sans-serif', padding: '1.5rem', background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,51,102,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      <h1 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#003366', marginBottom: '1.2rem' }}>
        Microservice Control Center
      </h1>

      {/* 1. Health Monitor */}
      <section style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', padding: '12px 16px', background: '#FAF6EE', borderRadius: 8, border: '1px solid rgba(195,178,150,0.45)' }}>
        <span>Gateway (5000): <strong style={{ color: status.gateway === 'online' ? 'green' : 'red' }}>{status.gateway}</strong></span>
        <span>AI Engine (5001): <strong style={{ color: status.ai === 'online' ? 'green' : 'red' }}>{status.ai}</strong></span>
        <button onClick={checkHealth} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: '1px solid #003366', background: '#FFFFFF', color: '#003366', fontWeight: '700', cursor: 'pointer' }}>Recheck</button>
      </section>

      {/* 2. Gateway CRUD Panel */}
      <section style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 10, marginBottom: '2rem', background: '#FFFFFF' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '1rem' }}>Gateway Records</h3>
        <form onSubmit={handleCreateItem} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add record to Gateway..."
            style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none' }}
          />
          <button type="submit" style={{ padding: '0.6rem 1.2rem', borderRadius: 6, border: 'none', background: '#003366', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}>Save</button>
        </form>
        <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ margin: '0.4rem 0', color: '#0F172A', fontSize: '0.9rem' }}>
              {item.name} <button onClick={() => handleDeleteItem(item.id)} style={{ marginLeft: '0.5rem', padding: '2px 6px', borderRadius: 4, border: 'none', background: '#FEE2E2', color: '#DC2626', fontWeight: '800', cursor: 'pointer' }}>✕</button>
            </li>
          ))}
          {items.length === 0 && <li style={{ color: '#64748B' }}>No records found.</li>}
        </ul>
      </section>

      {/* 3. AI Streaming Panel */}
      <section style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 10, marginBottom: '2rem', background: '#FFFFFF' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '1rem' }}>Python AI Inference (Streaming)</h3>
        <form onSubmit={handleStreamAI} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Send prompt to AI model..."
            style={{ padding: '0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none' }}
          />
          <button type="submit" disabled={isStreaming} style={{ padding: '0.65rem 1.2rem', borderRadius: 6, border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: '700', cursor: isStreaming ? 'not-allowed' : 'pointer' }}>
            {isStreaming ? 'Streaming...' : 'Generate Stream'}
          </button>
        </form>
        {streamedText && (
          <div style={{ marginTop: '1rem', background: '#F0FDF4', border: '1px solid #A7F3D0', padding: '0.85rem', borderRadius: 6, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.82rem', color: '#065F46' }}>
            {streamedText}
          </div>
        )}
      </section>

      {/* 4. AI File Upload Panel */}
      <section style={{ border: '1px solid #E2E8F0', padding: '1.25rem', borderRadius: 10, background: '#FFFFFF' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '1rem' }}>AI Document / Image Analysis</h3>
        <input type="file" onChange={handleFileUpload} style={{ fontSize: '0.85rem' }} />
        {fileAnalysis && (
          <pre style={{ marginTop: '0.75rem', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '0.75rem', borderRadius: 6, fontSize: '0.8rem', fontFamily: 'monospace' }}>
            {JSON.stringify(fileAnalysis, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
