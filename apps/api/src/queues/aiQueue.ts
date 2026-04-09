export const aiQueue = {
  async add(name: string, payload: Record<string, unknown>) {
    return { id: 'aiQueue-' + Date.now().toString(), name, payload };
  }
};
