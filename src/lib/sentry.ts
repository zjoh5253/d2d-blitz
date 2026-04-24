import * as Sentry from "@sentry/nextjs";

/**
 * Captures an error to Sentry from an API route catch block.
 * Call this before returning a 500 response so the error is tracked
 * even though it was caught (and therefore not auto-captured by the SDK).
 */
export function captureApiError(
  error: unknown,
  context?: string,
  extra?: Record<string, unknown>
) {
  Sentry.captureException(error, {
    tags: context ? { route: context } : undefined,
    extra,
  });
}
