export const sarvamClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'sarvam', ok: true };
  }
};
