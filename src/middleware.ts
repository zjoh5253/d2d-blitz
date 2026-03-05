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
  { prefix: "/dashboard/installs", roles: ["ADMIN"] },
  { prefix: "/dashboard/compensation", roles: ["ADMIN"] },
  { prefix: "/dashboard/governance", roles: ["ADMIN", "FIELD_MANAGER"] },
  { prefix: "/dashboard/compliance", roles: ["ADMIN", "FIELD_MANAGER"] },
  { prefix: "/dashboard/inbound", roles: ["ADMIN", "CALL_CENTER"] },
  { prefix: "/dashboard/reports", roles: ["ADMIN", "EXECUTIVE"] },
  { prefix: "/dashboard/manager", roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
