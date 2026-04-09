import { routerClient } from './router';

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

const extractTextFromResponse = (raw: Record<string, unknown>) => {
  const openAiContent =
    ((raw.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined)
      ?.content;
  if (typeof openAiContent === 'string' && openAiContent.trim()) return openAiContent.trim();

  const claudeText = (raw.content as Array<Record<string, unknown>> | undefined)?.[0]?.text;
  if (typeof claudeText === 'string' && claudeText.trim()) return claudeText.trim();

  const geminiParts = (
    ((raw.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as Record<string, unknown> | undefined)
      ?.parts as Array<Record<string, unknown>> | undefined
  )?.[0]?.text;
  if (typeof geminiParts === 'string' && geminiParts.trim()) return geminiParts.trim();

  return '';
};

export const executeAiProvider = async (input: AiCallInput): Promise<AiCallOutput> => {
  const settings = toStringRecord(input.settings);
  const raw = await routerClient.call({
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
    prompt: input.prompt,
    ...settings
  });
  const text = extractTextFromResponse(raw);
  if (!text) {
    throw new Error(`Empty AI response from provider ${input.provider}`);
  }
  return {
    provider: input.provider,
    model: input.model,
    text,
    raw
  };
};
