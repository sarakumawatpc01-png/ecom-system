export const openaiClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'openai', ok: true };
  }
};
