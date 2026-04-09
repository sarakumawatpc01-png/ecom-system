export const imageQueue = {
  async add(name: string, payload: Record<string, unknown>) {
    return { id: 'imageQueue-' + Date.now().toString(), name, payload };
  }
};
