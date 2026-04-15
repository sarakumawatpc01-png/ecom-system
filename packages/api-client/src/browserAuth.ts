const authTokenKeys = ['access_token', 'auth:token', 'token'];

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  for (const key of authTokenKeys) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
};
