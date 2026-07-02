import Link from "next/link";
import { Mail, LifeBuoy, CalendarCheck } from "lucide-react";

export const metadata = {
  title: "Contact — D2D Blitz",
  description:
    "Get in touch with D2D Blitz. Book a demo for your team, reach support, or send us a note.",
};

const channels = [
  {
    icon: CalendarCheck,
    title: "Book a demo",
    description:
      "Running a team? See how D2D Blitz handles blitzes, commissions, and compliance for your operation.",
    action: { label: "Email sales", href: "mailto:sales@d2dblitz.com" },
  },
  {
    icon: LifeBuoy,
    title: "Support",
    description:
      "Already using D2D Blitz and need a hand? Our support team is here to help you and your reps.",
    action: { label: "Email support", href: "mailto:support@d2dblitz.com" },
  },
  {
    icon: Mail,
    title: "General inquiries",
    description: "Questions, partnerships, or anything else — drop us a line and we'll get back to you.",
    action: { label: "Email us", href: "mailto:hello@d2dblitz.com" },
  },
];

export default function ContactPage() {
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
          Get in touch
        </h1>
        <p className="text-blue-200/70 text-lg mt-3 max-w-2xl mx-auto">
          Whether you&apos;re a rep with a question or an operator ready for a demo, we&apos;d love
          to hear from you.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {channels.map(({ icon: Icon, title, description, action }) => (
          <div
            key={title}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col"
          >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center gradient-brand mb-4">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h2
              className="text-lg font-semibold text-slate-900 mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {title}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed flex-1">{description}</p>
            <a
              href={action.href}
              className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {action.label} →
            </a>
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <p className="text-slate-500 text-sm">
          Looking to start knocking?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Create your free rep account
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
