export const claudeClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || 'claude-3-5-sonnet-20240620');
    const prompt = String(payload.prompt || '');
    if (!apiKey) throw new Error('Missing Claude API key');
    if (!prompt) throw new Error('Prompt is required');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: typeof payload.max_tokens === 'number' ? payload.max_tokens : 1024,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Claude request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
