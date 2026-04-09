export const emailQueue = {
  async add(name: string, payload: Record<string, unknown>) {
    return { id: 'emailQueue-' + Date.now().toString(), name, payload };
  }
};
