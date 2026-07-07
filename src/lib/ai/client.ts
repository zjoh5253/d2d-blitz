import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client for server-side AI features (install-report
// parsing, etc.). Reads ANTHROPIC_API_KEY from the environment.
//
// Set ANTHROPIC_API_KEY in .env(.local). Optionally override the model with
// ANTHROPIC_MODEL (defaults to the most capable model). For a cheaper run on
// high volume, set ANTHROPIC_MODEL=claude-sonnet-4-6 or claude-haiku-4-5.

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — required for AI install-report parsing"
    );
  }
  cached = new Anthropic();
  return cached;
}

// Default to the most capable model; override per the env var above.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function isAIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
