export const deepseekClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || 'deepseek-chat');
    const prompt = String(payload.prompt || '');
    if (!apiKey) throw new Error('Missing DeepSeek API key');
    if (!prompt) throw new Error('Prompt is required');
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
      throw new Error(`DeepSeek request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
