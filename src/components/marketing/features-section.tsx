import { MapPin, Footprints, DollarSign, Trophy, CalendarClock, TrendingUp } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Find Your Next Blitz",
    description:
      "Browse active campaigns and see your market, carrier, dates, and housing before you commit.",
  },
  {
    icon: Footprints,
    title: "Every Knock Counts",
    description:
      "GPS-tracked shifts log your doors, miles, and hours automatically. Your hustle, on the record.",
  },
  {
    icon: DollarSign,
    title: "Real-Time Earnings",
    description:
      "Watch commissions build with every verified install — eligible, pending, and paid, plus your lifetime total.",
  },
  {
    icon: Trophy,
    title: "Climb the Leaderboard",
    description:
      "Live rankings by verified installs. Week, month, season, or lifetime — see exactly where you stand.",
  },
  {
    icon: CalendarClock,
    title: "Never Lose a Deal",
    description:
      "Go-back reminders and 48-hour / 24-hour / install-day nudges keep every customer on track to a paid install.",
  },
  {
    icon: TrendingUp,
    title: "Level Up Your Tier",
    description:
      "Hit your install-rate targets and unlock a higher commission multiplier. Your performance sets your pay rate.",
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
            Everything a rep needs to knock more and earn more
          </h2>
          <p className="text-slate-500 text-lg mt-4 leading-relaxed">
            From your first blitz to payday, D2D Blitz tracks the work so you can focus on the doors.
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
