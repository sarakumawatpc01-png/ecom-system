export const openaiClient = {
  async call(payload: Record<string, unknown>) {
    const apiKey = String(payload.apiKey || '');
    const model = String(payload.model || 'gpt-4o-mini');
    const prompt = String(payload.prompt || '');
    const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.3;
    if (!apiKey) throw new Error('Missing OpenAI API key');
    if (!prompt) throw new Error('Prompt is required');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${body}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
};
