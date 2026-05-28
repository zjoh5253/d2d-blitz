import Link from "next/link";
import { CheckCircle2, Zap } from "lucide-react";

const FEATURES = [
  "Unlimited door knock logging",
  "Real-time manager dashboard",
  "Rep leaderboard & conversion stats",
  "Mobile-optimized rep interface",
  "CSV export for visit history",
  "Up to 10 reps per team",
  "Email & magic link login",
  "14-day free trial, no card needed",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="py-20 text-center px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
          <Zap className="w-3.5 h-3.5" />
          Simple, transparent pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
          One plan. Every rep. Zero friction.
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          D2D Blitz is built for door-to-door teams that need to move fast — not spend time on software.
        </p>
      </section>

      {/* Pricing card */}
      <section className="max-w-md mx-auto px-4 pb-24">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Card header */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-8 text-white text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-2">
              Team Plan
            </p>
            <div className="flex items-end justify-center gap-1">
              <span className="text-5xl font-black">$49</span>
              <span className="text-blue-200 mb-2">/mo</span>
            </div>
            <p className="text-blue-200 text-sm mt-1">per team · up to 10 reps</p>
          </div>

          {/* Card body */}
          <div className="px-8 py-7 space-y-5">
            <ul className="space-y-3">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{feat}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="block w-full rounded-xl bg-blue-600 py-3.5 text-center text-base font-bold text-white transition hover:bg-blue-700 active:scale-95"
            >
              Start Free Trial
            </Link>

            <p className="text-center text-xs text-slate-400">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>

        {/* FAQ blurb */}
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 text-center">Common questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "What counts as a 'team'?",
                a: "One manager account plus up to 10 rep accounts. Need more reps? Contact us for a custom quote.",
              },
              {
                q: "What happens after the trial?",
                a: "You'll be prompted to enter a payment method. If you don't, your account pauses — no charges, no data deleted.",
              },
              {
                q: "Can reps log visits from their phone?",
                a: "Yes. The visit logger is mobile-first and works in any browser — no app download needed.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-slate-200 rounded-xl px-5 py-4">
                <p className="font-semibold text-slate-900 text-sm">{q}</p>
                <p className="text-slate-600 text-sm mt-1">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
