const ensureOk = async (res: Response) => {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

export const apiGet = (baseUrl: string, path: string) =>
  fetch(`${baseUrl}${path}`, { headers: { 'Content-Type': 'application/json' } }).then(ensureOk);
