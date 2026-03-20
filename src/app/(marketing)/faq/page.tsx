import { FaqAccordion } from "@/components/marketing/faq-accordion";

const gettingStarted = [
  {
    question: "What is D2D Blitz?",
    answer: "D2D Blitz is an all-in-one platform for managing door-to-door sales operations. It covers everything from blitz campaign planning and rep staffing to real-time performance tracking, leaderboards, and commission payouts."
  },
  {
    question: "How do I sign up?",
    answer: "Contact your market owner or field manager to get an invitation. Once invited, you'll receive an email with a link to create your account and set up your profile."
  },
  {
    question: "What roles are available in the platform?",
    answer: "D2D Blitz supports four main roles: Field Rep, Field Manager, Market Owner, and Admin/Executive. Each role has tailored dashboards and permissions based on their responsibilities."
  }
];

const forReps = [
  {
    question: "How do I track my daily activity?",
    answer: "Use the D2D Blitz mobile app to log doors knocked, conversations held, and sales made in real time. Your activity automatically syncs to the leaderboard and your personal dashboard."
  },
  {
    question: "How are my commissions calculated?",
    answer: "Commissions are calculated automatically based on your market's commission stack configuration. This includes base commissions, overrides, bonuses, and any applicable deductions. You can view your estimated earnings in real time."
  },
  {
    question: "How do leaderboards work?",
    answer: "Leaderboards rank reps by performance metrics like sales, doors knocked, and close rate. Rankings update in real time and can be filtered by market, blitz, or time period."
  },
  {
    question: "Is there a mobile app?",
    answer: "Yes! The D2D Blitz mobile companion app is available for iOS and Android. It lets you track activity, view your earnings, check leaderboard rankings, and manage go-backs — all from the field."
  }
];

const forManagers = [
  {
    question: "How do I create a blitz campaign?",
    answer: "Navigate to the Blitz Command Center from your dashboard. Click 'Create Blitz' and fill in the details — dates, territory, housing, and travel logistics. Then staff it by assigning reps from your pipeline."
  },
  {
    question: "How does the recruiting pipeline work?",
    answer: "The recruiting pipeline is a kanban-style board that tracks candidates from initial screening through interview, offer, and onboarding stages. Drag and drop candidates between stages as they progress."
  },
  {
    question: "Can I see real-time team performance?",
    answer: "Absolutely. Your manager dashboard shows live metrics for all reps on your team, including doors knocked, conversations, sales, and close rates. You can drill down into individual rep performance at any time."
  }
];

const billing = [
  {
    question: "How does the payout process work?",
    answer: "After a blitz concludes, installs are verified during the review period. Once verified, commissions are calculated automatically and batched for payout. Admins can process payouts directly from the platform."
  },
  {
    question: "What about deductions?",
    answer: "Deductions for housing, travel, or other expenses can be configured per blitz. These are automatically subtracted from commission payouts, and reps can see a full breakdown of their earnings and deductions."
  }
];

const technical = [
  {
    question: "Is my data secure?",
    answer: "Yes. D2D Blitz uses industry-standard 256-bit encryption for all data in transit and at rest. We follow SOC 2 compliance standards and conduct regular security audits."
  },
  {
    question: "What browsers are supported?",
    answer: "D2D Blitz works on all modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, we recommend using the latest version of your preferred browser."
  }
];

export default function FaqPage() {
  return (
    <div className="pt-24">
      {/* Hero banner */}
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
          Frequently Asked Questions
        </h1>
        <p className="text-blue-200/70 text-lg mt-3 max-w-2xl mx-auto">
          Everything you need to know about D2D Blitz.
        </p>
      </div>

      {/* FAQ sections */}
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Getting Started
          </h2>
          <FaqAccordion items={gettingStarted} />
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            For Field Reps
          </h2>
          <FaqAccordion items={forReps} />
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            For Managers
          </h2>
          <FaqAccordion items={forManagers} />
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Billing & Payments
          </h2>
          <FaqAccordion items={billing} />
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Technical
          </h2>
          <FaqAccordion items={technical} />
        </section>
      </div>
    </div>
  );
}
