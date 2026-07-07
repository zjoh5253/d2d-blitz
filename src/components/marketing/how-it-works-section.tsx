const steps = [
  {
    number: 1,
    title: "Sign Up Free",
    description: "Create your account in minutes. Free for reps — no credit card.",
  },
  {
    number: 2,
    title: "Complete Your Profile",
    description:
      "Sign your rep agreement, GPS consent, and tax docs so you're cleared to earn from day one.",
  },
  {
    number: 3,
    title: "Find a Blitz",
    description:
      "Join an active campaign and get your market, carrier, dates, and housing sorted in one place.",
  },
  {
    number: 4,
    title: "Track Every Door",
    description:
      "Log knocks, sales, and daily numbers from the field — web or mobile, even offline.",
  },
  {
    number: 5,
    title: "Get Paid",
    description:
      "Commissions calculate automatically and land in transparent payout batches. No guessing what you're owed.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-secondary py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900">
            From sign-up to payday
          </h2>
          <p className="mt-4 text-slate-500 text-lg">
            Five steps to turn doors into a paycheck.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mt-16">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col">
              <div className="w-12 h-12 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-lg mb-4">
                {step.number}
              </div>
              <h3 className="font-heading text-lg font-semibold text-slate-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
