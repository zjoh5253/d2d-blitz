import Link from "next/link";
import { Check } from "lucide-react";

export const metadata = {
  title: "Pricing — D2D Blitz",
  description:
    "D2D Blitz is free for field reps. Team and operator pricing is tailored to your organization — book a demo to get a quote.",
};

const repFeatures = [
  "Find and join active blitzes",
  "GPS-tracked door-knock shifts",
  "Log sales, go-backs, and daily reports",
  "Real-time and lifetime earnings visibility",
  "Live leaderboards and performance tiers",
  "Mobile app with offline sync",
];

const teamFeatures = [
  "Everything reps get, for your whole roster",
  "Blitz planning and staffing command center",
  "Automated commission engine and payout batches",
  "Governance tiers, compliance, and audit trails",
  "Territory P&L and profitability reporting",
  "Recruiting pipeline and install reconciliation",
];

export default function PricingPage() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <div
        className="py-16 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
        }}
      >
        <h1
          className="text-white text-3xl lg:text-4xl font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Simple pricing
        </h1>
        <p className="text-blue-200/70 text-lg mt-3 max-w-2xl mx-auto">
          Free for the reps knocking doors. Tailored plans for the teams running the operation.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Reps */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
          <h2
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Reps
          </h2>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900">Free</span>
            <span className="text-slate-500 text-sm">forever</span>
          </div>
          <p className="text-slate-500 text-sm mt-2">
            Everything you need to knock, track, and get paid. No credit card.
          </p>
          <ul className="mt-6 space-y-3 flex-1">
            {repFeatures.map((f) => (
              <li key={f} className="flex gap-3">
                <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600 text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="mt-8 gradient-brand text-white font-semibold rounded-lg px-6 py-3 text-center transition-opacity hover:opacity-90"
          >
            Create Your Free Account
          </Link>
        </div>

        {/* Teams */}
        <div className="bg-slate-900 rounded-2xl shadow-lg p-8 flex flex-col">
          <h2
            className="text-xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Teams
          </h2>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-white">Custom</span>
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Pricing scales with your markets, reps, and carriers. Book a demo for a quote.
          </p>
          <ul className="mt-6 space-y-3 flex-1">
            {teamFeatures.map((f) => (
              <li key={f} className="flex gap-3">
                <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="mt-8 bg-white text-slate-900 font-semibold rounded-lg px-6 py-3 text-center hover:bg-slate-100 transition-colors"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
