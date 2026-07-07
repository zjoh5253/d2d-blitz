import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment tag — helps separate prod vs staging errors
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",

  // Sample 100% of errors, 10% of performance traces in production
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.1 : 1.0,

  // Replay: capture 1% of sessions, 100% on error in production
  replaysSessionSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.01 : 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Do not capture errors in local dev unless SENTRY_DSN is explicitly set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
