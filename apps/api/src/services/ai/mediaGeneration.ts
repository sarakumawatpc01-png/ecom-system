type ProviderInput = {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
  settings?: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export const generateImageWithProvider = async (input: ProviderInput): Promise<{ mediaUrl: string; raw: Record<string, unknown> }> => {
  const provider = input.provider.toLowerCase();
  const settings = asRecord(input.settings);

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model || 'gpt-image-1',
        prompt: input.prompt,
        size: typeof settings.size === 'string' ? settings.size : '1024x1024'
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI image generation failed: ${response.status} ${body}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;
    const url = ((raw.data as Array<Record<string, unknown>> | undefined)?.[0]?.url as string | undefined) || '';
    if (!url) throw new Error('OpenAI image response missing url');
    return { mediaUrl: url, raw };
  }

  if (provider === 'google') {
    const endpoint = String(settings.imagen_endpoint || process.env.GOOGLE_IMAGEN_ENDPOINT || '');
    if (!endpoint) throw new Error('Google image generation requires settings.imagen_endpoint or GOOGLE_IMAGEN_ENDPOINT');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: input.model, prompt: input.prompt })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google image generation failed: ${response.status} ${body}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;
    const url = String(raw.url || raw.output_url || '');
    if (!url) throw new Error('Google image response missing url');
    return { mediaUrl: url, raw };
  }

  throw new Error(`Unsupported image generation provider: ${input.provider}`);
};

export const generateVideoWithProvider = async (input: ProviderInput): Promise<{ mediaUrl: string; raw: Record<string, unknown> }> => {
  const provider = input.provider.toLowerCase();
  const settings = asRecord(input.settings);

  if (provider === 'google') {
    const endpoint = String(settings.veo_endpoint || process.env.GOOGLE_VEO_ENDPOINT || '');
    if (!endpoint) throw new Error('Google video generation requires settings.veo_endpoint or GOOGLE_VEO_ENDPOINT');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: input.model, prompt: input.prompt, duration_seconds: settings.duration_seconds || 8 })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google video generation failed: ${response.status} ${body}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;
    const url = String(raw.url || raw.output_url || raw.video_url || '');
    if (!url) throw new Error('Google video response missing url');
    return { mediaUrl: url, raw };
  }

  throw new Error(`Unsupported video generation provider: ${input.provider}`);
};

