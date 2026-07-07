/* Stat formatting helpers shared across marketing + auth surfaces. */

/** Compact a count into K/M notation (e.g. 2400 -> "2.4K", 1_200_000 -> "1.2M"). */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Format a revenue figure with a leading "$" and trailing "+" for K/M values. */
export function formatRevenue(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K+`;
  return `$${n}`;
}
