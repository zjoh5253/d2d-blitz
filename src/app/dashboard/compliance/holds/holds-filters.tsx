"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface PeriodOption {
  value: string;
  label: string;
}

interface HoldsFiltersProps {
  periodOptions: PeriodOption[];
  currentPeriod?: string;
  currentActiveOnly?: boolean;
}

export function HoldsFilters({
  periodOptions,
  currentPeriod,
  currentActiveOnly,
}: HoldsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">Period:</label>
        <select
          value={currentPeriod ?? ""}
          onChange={(e) => updateParam("period", e.target.value || null)}
          className="text-sm border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">All time</option>
          {periodOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active / All tabs */}
      <div className="flex gap-1 border-b border-input">
        {[
          { label: "All", active: !currentActiveOnly },
          { label: "Active Only", active: currentActiveOnly },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() =>
              updateParam("activeOnly", f.label === "Active Only" ? "true" : null)
            }
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              f.active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
