import Link from "next/link";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { StatsSection } from "@/components/marketing/stats-section";
import { CtaSection } from "@/components/marketing/cta-section";

export const metadata = {
  title: "For Reps — D2D Blitz",
  description:
    "Join a blitz, track every door, and get paid. D2D Blitz is the free platform built for door-to-door sales reps.",
};

export default function ForRepsPage() {
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
            Free for reps
          </div>
          <h1
            className="text-white text-4xl lg:text-5xl font-extrabold"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.02em" }}
          >
            Your doors. Your numbers. Your money.
          </h1>
          <p className="text-blue-200/70 text-lg mt-6 leading-relaxed">
            D2D Blitz gives every field rep one place to find a blitz, log every knock, and watch
            commissions add up in real time. Sign up free and start tracking your hustle today.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="gradient-brand glow-blue text-white font-semibold px-8 py-3 rounded-lg transition-opacity hover:opacity-90"
            >
              Create Your Free Account
            </Link>
            <a
              href="#how-it-works"
              className="border border-white/30 text-white font-semibold px-8 py-3 rounded-lg transition-colors hover:bg-white/10"
            >
              See How It Works
            </a>
          </div>
        </div>
      </div>

      <HowItWorksSection />
      <FeaturesSection />
      <StatsSection />
      <CtaSection />
    </div>
  );
}
