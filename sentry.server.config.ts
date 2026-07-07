import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.APP_ENV ?? "development",

  // Capture all errors on the server; sample 10% of traces in production
  tracesSampleRate: process.env.APP_ENV === "production" ? 0.1 : 1.0,

  enabled: !!process.env.SENTRY_DSN,
});
