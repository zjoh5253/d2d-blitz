import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = ["/login", "/register"];
const PUBLIC_PREFIXES = ["/api/auth"];

const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/recruiting", roles: ["ADMIN", "RECRUITER"] },
  { prefix: "/dashboard/markets", roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"] },
  { prefix: "/dashboard/blitzes", roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"] },
  { prefix: "/dashboard/reps", roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"] },
  { prefix: "/dashboard/onboarding", roles: ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"] },
  { prefix: "/dashboard/installs", roles: ["ADMIN"] },
  { prefix: "/dashboard/compensation", roles: ["ADMIN"] },
  { prefix: "/dashboard/governance", roles: ["ADMIN", "FIELD_MANAGER"] },
  { prefix: "/dashboard/compliance/holds", roles: ["ADMIN", "EXECUTIVE"] },
  { prefix: "/dashboard/compliance", roles: ["ADMIN", "FIELD_MANAGER"] },
  { prefix: "/dashboard/inbound", roles: ["ADMIN", "CALL_CENTER"] },
  // Sales & Activity CSV report — managers need it too, so it's opened up
  // wider than the exec-only financial reports. Must precede the generic
  // /dashboard/reports rule below (first prefix match wins).
  {
    prefix: "/dashboard/reports/sales-activity",
    roles: ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"],
  },
  { prefix: "/dashboard/reports", roles: ["ADMIN", "EXECUTIVE"] },
  // More specific manager sub-routes first (first match wins): owners edit manager
  // rates, managers edit rep pay.
  { prefix: "/dashboard/manager/manager-rates", roles: ["ADMIN", "MARKET_OWNER"] },
  { prefix: "/dashboard/manager/rep-pay", roles: ["ADMIN", "FIELD_MANAGER"] },
  { prefix: "/dashboard/manager", roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"] },
  // Mobile-web rep experience. Admins/managers can access for QA.
  { prefix: "/rep", roles: ["FIELD_REP", "ADMIN", "FIELD_MANAGER"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/rep")) {
    return NextResponse.next();
  }

  const useSecureCookie = req.nextUrl.protocol === "https:";
  const cookieName = useSecureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = token.role as string;

  const matchedRoute = ROLE_PROTECTED_ROUTES.find((route) =>
    pathname.startsWith(route.prefix)
  );

  if (matchedRoute && !matchedRoute.roles.includes(userRole)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // FIELD_REPs landing on /dashboard root get bounced straight to the Leads
  // Map — their primary working screen. Admin/manager dashboard sub-routes
  // still work for them if they navigate there directly (per the role table).
  if (userRole === "FIELD_REP" && pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/rep/leads?view=map", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/rep/:path*", "/login", "/register"],
};
