export const openrouterClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'openrouter', ok: true };
  }
};
