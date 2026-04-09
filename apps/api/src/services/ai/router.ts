import { claudeClient } from './claude';
import { deepseekClient } from './deepseek';
import { googleClient } from './google';
import { openaiClient } from './openai';
import { openrouterClient } from './openrouter';
import { sarvamClient } from './sarvam';

export const routerClient = {
  async call(payload: Record<string, unknown>) {
    const provider = String(payload.provider || '').toLowerCase();
    if (!provider) throw new Error('Provider is required');
    if (provider === 'openai') return openaiClient.call(payload);
    if (provider === 'openrouter') return openrouterClient.call(payload);
    if (provider === 'claude' || provider === 'anthropic') return claudeClient.call(payload);
    if (provider === 'deepseek') return deepseekClient.call(payload);
    if (provider === 'google') return googleClient.call(payload);
    if (provider === 'sarvam') return sarvamClient.call(payload);
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
};
