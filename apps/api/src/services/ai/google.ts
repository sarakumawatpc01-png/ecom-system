export const googleClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || 'gemini-1.5-flash');
    const prompt = String(payload.prompt || '');
    if (!apiKey) throw new Error('Missing Google API key');
    if (!prompt) throw new Error('Prompt is required');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3
        }
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google AI request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
