export const claudeClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'claude', ok: true };
  }
};
