export const deepseekClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'deepseek', ok: true };
  }
};
