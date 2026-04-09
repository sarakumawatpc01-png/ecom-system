export const sarvamClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || 'sarvam-m');
    const prompt = String(payload.prompt || '');
    const endpoint = String(payload.endpoint || process.env.SARVAM_API_BASE || 'https://api.sarvam.ai/v1/chat/completions');
    if (!apiKey) throw new Error('Missing Sarvam API key');
    if (!prompt) throw new Error('Prompt is required');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Sarvam request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
