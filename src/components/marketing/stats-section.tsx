const stats = [
  { number: "2,400+", label: "Active Reps", stagger: "animate-stagger-1" },
  { number: "38", label: "Markets", stagger: "animate-stagger-2" },
  { number: "$12M+", label: "Commissions Paid", stagger: "animate-stagger-3" },
  { number: "150K+", label: "Doors / Month", stagger: "animate-stagger-4" },
];

export function StatsSection() {
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
          Trusted by Teams Nationwide
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {stats.map(({ number, label, stagger }) => (
            <div key={label} className="text-center">
              <p
                className={`text-4xl lg:text-5xl font-extrabold text-white animate-count-up ${stagger}`}
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
