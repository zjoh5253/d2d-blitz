import Link from "next/link";
import { Zap } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="bg-[#0F172A] text-white">
      <div className="max-w-7xl mx-auto py-16 px-6">
        <div className="mb-12">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Zap className="h-6 w-6 text-blue-400" />
            <span className="text-xl font-bold text-white">D2D Blitz</span>
          </Link>
          <p className="mt-3 text-slate-400 text-sm">
            Powering America's top door-to-door sales teams.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-0">
              {[
                { label: "Features", href: "#" },
                { label: "How It Works", href: "#" },
                { label: "Mobile App", href: "#" },
                { label: "Pricing", href: "#" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-0">
              {[
                { label: "About", href: "#" },
                { label: "Careers", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Contact", href: "#" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-0">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Connect
            </h3>
            <ul className="space-y-0">
              {[
                { label: "Twitter", href: "#" },
                { label: "LinkedIn", href: "#" },
                { label: "Support", href: "#" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto py-6 px-6">
          <p className="text-slate-500 text-sm">
            © 2024 D2D Blitz. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
