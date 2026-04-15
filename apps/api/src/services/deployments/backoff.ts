export const withBackoff = async <T>(
  run: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; retryable?: (error: unknown) => boolean }
): Promise<T> => {
  let latest: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      latest = error;
      if (attempt === opts.retries || (opts.retryable && !opts.retryable(error))) throw latest;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw latest;
};
