"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Zap, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "FAQ", href: "/faq" },
];

export function MarketingNav() {
  const { status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className={cn(
          "backdrop-blur-md bg-white/80 transition-shadow duration-200",
          scrolled && "shadow-sm"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Wordmark */}
            <Link href="/" className="flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
                >
                  <Zap className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <span
                  className="text-slate-900 text-xl font-bold tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  D2D Blitz
                </span>
              </div>
            </Link>

            {/* Center: Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Right: CTAs */}
            <div className="hidden md:flex items-center gap-3">
              {status === "loading" && (
                <div className="skeleton w-20 h-8 rounded-md" />
              )}
              {status === "authenticated" && (
                <Link
                  href="/dashboard"
                  className="gradient-brand text-white text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
              )}
              {status === "unauthenticated" && (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/login"
                    className="gradient-brand text-white text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile: Hamburger */}
            <button
              className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-lg md:hidden">
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-3 py-2.5 rounded-md transition-colors"
              >
                {link.label}
              </a>
            ))}

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
              {status === "loading" && (
                <div className="skeleton w-full h-10 rounded-lg" />
              )}
              {status === "authenticated" && (
                <Link
                  href="/dashboard"
                  onClick={closeMobile}
                  className="gradient-brand text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-opacity hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
              )}
              {status === "unauthenticated" && (
                <>
                  <Link
                    href="/login"
                    onClick={closeMobile}
                    className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-3 py-2.5 rounded-md transition-colors text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/login"
                    onClick={closeMobile}
                    className="gradient-brand text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-opacity hover:opacity-90"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
