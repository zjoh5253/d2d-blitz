import Link from "next/link";

export const metadata = {
  title: "About — D2D Blitz",
  description:
    "D2D Blitz is the platform built for door-to-door sales — helping reps track every knock and get paid, and helping operators run world-class blitz campaigns.",
};

export default function AboutPage() {
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
          About D2D Blitz
        </h1>
        <p className="text-blue-200/70 text-lg mt-3 max-w-2xl mx-auto">
          The platform built for the people who knock.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-slate-600 leading-relaxed text-lg">
          Door-to-door sales runs on hustle — but the tools never kept up. Reps couldn&apos;t see
          what they&apos;d earned until payday. Managers ran blitzes on spreadsheets. Commissions
          took weeks to reconcile. We built D2D Blitz to fix that.
        </p>

        <h2
          className="text-xl font-bold text-slate-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          What we do
        </h2>
        <p className="text-slate-600 leading-relaxed">
          D2D Blitz is one platform for the whole operation. Reps find blitzes, track every door
          with GPS, log their sales, and watch commissions add up in real time — on web or mobile,
          even offline. Operators plan campaigns, staff their teams, automate commissions and
          payouts, and keep the whole business compliant and profitable.
        </p>

        <h2
          className="text-xl font-bold text-slate-900 mt-10 mb-4"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Who it&apos;s for
        </h2>
        <p className="text-slate-600 leading-relaxed">
          From the first-day rep knocking their first door to the market owner running dozens of
          reps across multiple carriers, D2D Blitz gives everyone the same source of truth — real
          numbers, updated in real time.
        </p>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="gradient-brand text-white font-semibold rounded-lg px-6 py-3 transition-opacity hover:opacity-90"
          >
            Get Started Free
          </Link>
          <Link
            href="/contact"
            className="border border-slate-300 text-slate-700 font-semibold rounded-lg px-6 py-3 hover:bg-slate-50 transition-colors"
          >
            Talk to Our Team
          </Link>
        </div>
      </div>
    </div>
  );
}
