import { Zap, Trophy, DollarSign, MapPin, UserPlus, Smartphone } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Blitz Command Center",
    description:
      "Create, staff, and manage time-boxed door-to-door campaigns with military precision.",
  },
  {
    icon: Trophy,
    title: "Real-Time Leaderboards",
    description:
      "Podium-style rankings with market filters that drive healthy competition.",
  },
  {
    icon: DollarSign,
    title: "Commission Engine",
    description:
      "Auto-calculate earnings with configurable stacks, overrides, and payout batches.",
  },
  {
    icon: MapPin,
    title: "Field Intelligence",
    description:
      "Territory management and geographic targeting to maximize door coverage.",
  },
  {
    icon: UserPlus,
    title: "Recruiting Pipeline",
    description:
      "Kanban-style pipeline from initial screening to fully onboarded field rep.",
  },
  {
    icon: Smartphone,
    title: "Mobile Companion",
    description:
      "Track doors knocked, conversations, and sales on the go with our native app.",
  },
];

const staggerClasses = [
  "animate-stagger-1",
  "animate-stagger-2",
  "animate-stagger-3",
  "animate-stagger-4",
  "animate-stagger-5",
  "animate-stagger-6",
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="gradient-mesh py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <h2
            className="font-heading font-bold text-3xl md:text-4xl text-slate-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Everything you need to run world-class blitz campaigns
          </h2>
          <p className="text-slate-500 text-lg mt-4 leading-relaxed">
            From planning to payout, D2D Blitz handles every step.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className={`bg-white rounded-xl p-6 shadow-sm card-hover border border-slate-100 animate-scale-in ${staggerClasses[i]}`}
            >
              {/* Icon container */}
              <div className="w-12 h-12 rounded-lg flex items-center justify-center gradient-brand mb-4">
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Title */}
              <h3
                className="text-lg font-semibold text-slate-900 mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
