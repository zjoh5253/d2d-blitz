"use client";

import { useEffect, useState } from "react";
import { formatCount, formatRevenue } from "@/lib/format";

type PublicStats = {
  activeMarkets: number;
  fieldReps: number;
  totalRevenue: number;
  doorsThisMonth: number;
};

const staggerClasses = [
  "animate-stagger-1",
  "animate-stagger-2",
  "animate-stagger-3",
  "animate-stagger-4",
] as const;

export function StatsSection() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((data: Partial<PublicStats>) => {
        if (
          typeof data.activeMarkets === "number" &&
          typeof data.fieldReps === "number" &&
          typeof data.totalRevenue === "number" &&
          typeof data.doorsThisMonth === "number"
        ) {
          setStats(data as PublicStats);
        }
      })
      .catch(() => {
        // leave placeholders on error
      });
  }, []);

  const items = [
    { number: stats ? formatCount(stats.fieldReps) : "—", label: "Active Reps" },
    { number: stats ? String(stats.activeMarkets) : "—", label: "Markets" },
    { number: stats ? formatRevenue(stats.totalRevenue) : "—", label: "Commissions Paid" },
    { number: stats ? `${formatCount(stats.doorsThisMonth)}+` : "—", label: "Doors / Month" },
  ];

  return (
    <section
      style={{
        background:
          "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
      }}
      className="py-24 px-6"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-white text-3xl lg:text-4xl font-bold text-center"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Real reps. Real doors. Real money.
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {items.map(({ number, label }, i) => (
            <div key={label} className="text-center">
              <p
                className={`text-4xl lg:text-5xl font-extrabold text-white animate-count-up ${staggerClasses[i]}`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {number}
              </p>
              <p className="text-blue-200/70 text-sm mt-2">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
