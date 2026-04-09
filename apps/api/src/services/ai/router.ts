export const routerClient = {
  async call(_payload: Record<string, unknown>) {
    return { provider: 'router', ok: true };
  }
};
