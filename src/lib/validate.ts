import { NextResponse } from "next/server"
import { z, ZodSchema } from "zod"

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse }

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns a typed data object on success, or a 400 NextResponse on failure.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten() },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: result.data }
}

/**
 * Parse and validate URL search params against a Zod schema.
 * Returns a typed data object on success, or a 400 NextResponse on failure.
 */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid query parameters", issues: result.error.flatten() },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: result.data }
}

// ─── Shared enum schemas ───────────────────────────────────────────────────

export const SaleStatusSchema = z.enum([
  "SUBMITTED",
  "PENDING_INSTALL",
  "INSTALLED",
  "VERIFIED",
  "CANCELLED",
  "DISPUTED",
])

export const CommissionStatusSchema = z.enum([
  "ELIGIBLE",
  "PENDING",
  "ON_HOLD",
  "PAID",
])

export const InstallRecordStatusSchema = z.enum([
  "MATCHED",
  "UNMATCHED",
  "DISPUTED",
])

export const DoorKnockDispositionSchema = z.enum([
  "PENDING",
  "NOT_HOME",
  "GO_BACK",
  "SOLD",
  "NOT_INTERESTED",
])

export const LeaderboardPeriodSchema = z.enum([
  "week",
  "month",
  "season",
  "lifetime",
])

export const optionalId = z.string().min(1).optional()
