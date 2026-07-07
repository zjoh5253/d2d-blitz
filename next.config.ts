import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  redirects: async () => [
    {
      source: '/leaderboard',
      destination: '/dashboard/leaderboard',
      permanent: true,
    },
    {
      source: '/admin/touchpoints',
      destination: '/dashboard/admin/carriers',
      permanent: false,
    },
    {
      source: '/touchpoints',
      destination: '/dashboard/admin/carriers',
      permanent: false,
    },
  ],
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (configure in CI/CD env vars)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps — set SENTRY_AUTH_TOKEN in CI
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry CLI output during local builds
  silent: !process.env.CI,

  // Automatically instrument Next.js API routes and middleware
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,

  // Upload source maps only in production builds
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  disableLogger: true,
});
