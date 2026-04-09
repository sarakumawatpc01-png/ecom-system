import * as Sentry from '@sentry/node';

let sentryReady = false;

export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return { enabled: false };

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
  });
  sentryReady = true;
  return { enabled: true };
};

export const captureApiError = (error: unknown, context?: Record<string, unknown>) => {
  if (!sentryReady) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setContext(key, (value && typeof value === 'object' ? (value as Record<string, unknown>) : { value }) as any);
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }
    Sentry.captureMessage(typeof error === 'string' ? error : 'Unknown API error');
  });
};
