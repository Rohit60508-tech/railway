/**
 * aiStream.js
 * Streaming Handler for AI responses (real-time token generation via Server-Sent Events / ReadableStream)
 */

export async function streamAiChat(messages, onChunk, onError) {
  const AI_BASE = import.meta.env.VITE_AI_URL || '/ai';
  try {
    const response = await fetch(`${AI_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'ir-ai-key-2026'
      },
      body: JSON.stringify({ messages, stream: true }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`AI Streaming Error (${response.status}): ${errText}`);
    }

    if (!response.body) throw new Error('ReadableStream not supported.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (onChunk) onChunk(chunk);
    }
  } catch (err) {
    if (onError) onError(err);
  }
}
