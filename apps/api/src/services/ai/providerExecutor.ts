import { createHash } from 'crypto';

type AiCallInput = {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
  taskType: string;
  settings?: Record<string, unknown>;
};

type AiCallOutput = {
  provider: string;
  model: string;
  text: string;
  raw: Record<string, unknown>;
};

const toStringRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

export const executeAiProvider = async (input: AiCallInput): Promise<AiCallOutput> => {
  const provider = input.provider.toLowerCase();
  const settings = toStringRecord(input.settings);

  if (provider === 'openai' && input.apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: 'user', content: input.prompt }],
        temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.3
      })
    });
    const raw = (await response.json()) as Record<string, unknown>;
    const content =
      ((raw.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)
        ?.content || '';
    return {
      provider: input.provider,
      model: input.model,
      text: String(content || ''),
      raw
    };
  }

  const digest = createHash('sha256').update(`${input.provider}|${input.model}|${input.prompt}`).digest('hex').slice(0, 16);
  return {
    provider: input.provider,
    model: input.model,
    text: `[${input.taskType}] Generated result (${digest}) for prompt: ${input.prompt.slice(0, 140)}`,
    raw: { simulated: true, provider: input.provider, model: input.model, digest }
  };
};

