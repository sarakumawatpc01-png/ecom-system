export const videoQueue = {
  async add(name: string, payload: Record<string, unknown>) {
    return { id: 'videoQueue-' + Date.now().toString(), name, payload };
  }
};
