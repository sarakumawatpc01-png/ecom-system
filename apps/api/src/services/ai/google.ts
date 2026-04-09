export const googleClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'google', ok: true };
  }
};
