export type ApiGetOptions = {
  token?: string;
  headers?: Record<string, string>;
};

const ensureOk = async (res: Response) => {
  if (!res.ok) {
    const payload = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(String(payload?.message || `HTTP ${res.status}`));
  }
  return res.json();
};

export const apiGet = (baseUrl: string, path: string, options: ApiGetOptions = {}) =>
  fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(ensureOk);
