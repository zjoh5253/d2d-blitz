"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const roles = [
  {
    tab: "Field Rep",
    title: "Close More Deals, Earn More Money",
    benefits: [
      "Track your real-time earnings and see exactly where you stand",
      "Log doors, conversations, and sales instantly from your phone",
      "Compete on live leaderboards and climb the rankings",
      "Never miss a go-back with automatic follow-up tracking",
    ],
  },
  {
    tab: "Field Manager",
    title: "Lead Your Team to Victory",
    benefits: [
      "Monitor team performance with a real-time dashboard",
      "Access governance tools for attendance and compliance",
      "See override earnings and team commission breakdowns",
      "Recruit and onboard new reps through the built-in pipeline",
    ],
  },
  {
    tab: "Market Owner",
    title: "Maximize Your Market's Potential",
    benefits: [
      "View territory P&L and blitz-level profitability",
      "Track recruiting ROI from screening to first sale",
      "Plan blitzes with data-driven territory assignments",
      "Compare performance across multiple field managers",
    ],
  },
  {
    tab: "Admin / Executive",
    title: "Run the Operation with Confidence",
    benefits: [
      "Access national KPIs across all markets at a glance",
      "Configure the commission engine with custom stack rules",
      "Ensure compliance with built-in audit trails",
      "Process payouts and manage deductions at scale",
    ],
  },
];

export function RolesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRole = roles[activeIndex];

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900">
            Built for Every Role
          </h2>
          <p className="mt-4 text-slate-500 text-lg">
            Whether you&apos;re knocking doors or running the operation, D2D
            Blitz has you covered.
          </p>
        </div>

        <div className="flex justify-center mt-10 overflow-x-auto">
          <div className="flex flex-nowrap gap-2 min-w-max px-1">
            {roles.map((role, index) => (
              <button
                key={role.tab}
                onClick={() => setActiveIndex(index)}
                className={
                  index === activeIndex
                    ? "gradient-brand text-white rounded-lg px-5 py-2.5 font-medium text-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg px-5 py-2.5 font-medium text-sm transition-colors"
                }
              >
                {role.tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <h3 className="font-heading text-2xl font-bold text-slate-900 mb-6">
              {activeRole.title}
            </h3>
            <ul className="space-y-3">
              {activeRole.benefits.map((benefit) => (
                <li key={benefit} className="flex flex-row gap-3">
                  <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 text-base">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
