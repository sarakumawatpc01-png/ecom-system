export const seoQueue = {
  async add(name: string, payload: Record<string, unknown>) {
    return { id: 'seoQueue-' + Date.now().toString(), name, payload };
  }
};
