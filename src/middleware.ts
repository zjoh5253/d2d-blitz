import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes accessible without authentication
const PUBLIC_ROUTES = ["/login", "/register"];
const PUBLIC_PREFIXES = ["/api/auth"];

// Role-based route protection map
const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/recruiting", roles: ["ADMIN", "RECRUITER"] },
  {
    prefix: "/dashboard/markets",
    roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
  },
  {
    prefix: "/dashboard/blitzes",
    roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
  },
  {
    prefix: "/dashboard/reps",
    roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
  },
  { prefix: "/dashboard/installs", roles: ["ADMIN"] },
  { prefix: "/dashboard/compensation", roles: ["ADMIN"] },
  {
    prefix: "/dashboard/governance",
    roles: ["ADMIN", "FIELD_MANAGER"],
  },
  {
    prefix: "/dashboard/compliance",
    roles: ["ADMIN", "FIELD_MANAGER"],
  },
  // /dashboard/leaderboard - all authenticated users (no role restriction)
  { prefix: "/dashboard/inbound", roles: ["ADMIN", "CALL_CENTER"] },
  { prefix: "/dashboard/reports", roles: ["ADMIN", "EXECUTIVE"] },
  {
    prefix: "/dashboard/manager",
    roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
  },
];

export default auth((req: NextRequest & { auth: unknown }) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Allow public prefixes (e.g. /api/auth/*)
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow exact public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Only protect /dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (req as any).auth as {
    user?: { id: string; role: string };
  } | null;

  // Not authenticated - redirect to login
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role;

  // Check role-based route protection (most specific prefix wins)
  const matchedRoute = ROLE_PROTECTED_ROUTES.find((route) =>
    pathname.startsWith(route.prefix)
  );

  if (matchedRoute && !matchedRoute.roles.includes(userRole)) {
    // Authenticated but lacks required role - redirect to dashboard root
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/api/auth/:path*",
  ],
};
