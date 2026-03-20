const steps = [
  {
    number: 1,
    title: "Plan Your Blitz",
    description:
      "Set dates, define territory, arrange housing, and coordinate travel logistics.",
  },
  {
    number: 2,
    title: "Staff Your Team",
    description:
      "Assign reps from your recruiting pipeline and confirm their availability.",
  },
  {
    number: 3,
    title: "Execute in the Field",
    description:
      "Reps track doors knocked, conversations, and sales via the mobile app.",
  },
  {
    number: 4,
    title: "Review & Pay",
    description:
      "Verify installs, calculate commissions automatically, and process payouts.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-secondary py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-slate-900">
            How It Works
          </h2>
          <p className="mt-4 text-slate-500 text-lg">
            Four simple steps from planning to payout.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
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
