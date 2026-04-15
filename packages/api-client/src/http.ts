export type ApiGetOptions = {
  token?: string;
  headers?: Record<string, string>;
};

const ensureOk = async (res: Response) => {
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await res.json().catch((error) => ({ message: `HTTP ${res.status}: Failed to parse response (${String(error)})` }))
      : { message: `HTTP ${res.status}` };
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
