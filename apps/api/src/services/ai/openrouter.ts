export const openrouterClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || '');
    const prompt = String(payload.prompt || '');
    if (!apiKey) throw new Error('Missing OpenRouter API key');
    if (!model) throw new Error('OpenRouter model is required');
    if (!prompt) throw new Error('Prompt is required');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': String(payload.referer || 'https://localhost'),
        'X-Title': String(payload.title || 'ecom-system')
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
