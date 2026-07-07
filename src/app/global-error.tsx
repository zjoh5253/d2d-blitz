"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>Our team has been notified. Please try again.</p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
