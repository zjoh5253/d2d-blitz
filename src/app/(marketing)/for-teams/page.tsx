import Link from "next/link";
import {
  LayoutDashboard,
  Calculator,
  ShieldCheck,
  BarChart3,
  Users,
  FileCheck,
} from "lucide-react";

export const metadata = {
  title: "For Teams — D2D Blitz",
  description:
    "Run your door-to-door operation with confidence: blitz planning, an automated commission engine, governance, territory P&L, and reconciliation — all in one platform.",
};

const capabilities = [
  {
    icon: LayoutDashboard,
    title: "Blitz Command Center",
    description:
      "Plan, staff, and run time-boxed campaigns end to end — dates, territory, housing, travel, and rep assignments in one place.",
  },
  {
    icon: Calculator,
    title: "Commission Engine",
    description:
      "Auto-calculate rep pay, manager overrides, and market-owner spreads with configurable stack rules, then batch payouts with deductions.",
  },
  {
    icon: ShieldCheck,
    title: "Governance & Compliance",
    description:
      "Performance tiers with commission multipliers, automatic compliance holds for missing daily reports, and full audit trails.",
  },
  {
    icon: BarChart3,
    title: "Territory P&L",
    description:
      "See blitz-level profitability and market P&L, and compare performance across managers and markets at a glance.",
  },
  {
    icon: Users,
    title: "Recruiting Pipeline",
    description:
      "Move candidates from first screen to fully onboarded rep, and measure recruiting ROI all the way to first sale.",
  },
  {
    icon: FileCheck,
    title: "Install Reconciliation",
    description:
      "Match carrier install records to rep sales, flag exceptions, and get 24-hour alerts on anything left unreconciled.",
  },
];

export default function ForTeamsPage() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <div
        className="py-20 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center bg-blue-500/10 border border-blue-400/20 text-blue-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            For managers, market owners & operators
          </div>
          <h1
            className="text-white text-4xl lg:text-5xl font-extrabold"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.02em" }}
          >
            Dominate the field. Own your numbers.
          </h1>
          <p className="text-blue-200/70 text-lg mt-6 leading-relaxed">
            The all-in-one platform for running door-to-door sales teams — from blitz planning and
            commissions to governance, profitability, and reconciliation.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/contact"
              className="gradient-brand glow-blue text-white font-semibold px-8 py-3 rounded-lg transition-opacity hover:opacity-90"
            >
              Book a Demo
            </Link>
            <Link
              href="/pricing"
              className="border border-white/30 text-white font-semibold px-8 py-3 rounded-lg transition-colors hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <section className="gradient-mesh py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className="font-heading font-bold text-3xl md:text-4xl text-slate-900"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Everything you need to run world-class blitz campaigns
            </h2>
            <p className="text-slate-500 text-lg mt-4 leading-relaxed">
              From planning to payout, D2D Blitz handles every step of the operation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white rounded-xl p-6 shadow-sm card-hover border border-slate-100"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center gradient-brand mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3
                  className="text-lg font-semibold text-slate-900 mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-brand py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-white text-3xl lg:text-4xl font-bold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            See D2D Blitz in action.
          </h2>
          <p className="text-blue-100/80 text-lg mt-4 max-w-2xl mx-auto">
            Book a walkthrough and we&apos;ll show you how top operators run their blitzes, pay their
            reps, and protect their margins.
          </p>
          <div className="mt-8">
            <Link
              href="/contact"
              className="bg-white text-blue-600 font-semibold rounded-lg px-8 py-3 hover:bg-blue-50 transition-colors duration-200 shadow-lg inline-block"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
