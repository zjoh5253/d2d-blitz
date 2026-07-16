import type { NextConfig } from "next";

// RETIRED 2026-07-16. This deployment (d2d-blitz-navy.vercel.app, built from
// maries-code/d2d-blitz) is superseded by the D2D Blitz team Vercel project
// serving D2D-Blitz/web @ main at https://www.joind2dblitz.com.
//
// Rather than deleting the project — which would strand anyone holding a
// bookmark or a home-screen shortcut on a dead link — every path forwards to
// the same path on the new domain. Both deployments read the SAME Neon
// database, so no data is left behind here; only the code is older.
//
// The catch-all is first, so the legacy path redirects below never match. They
// are kept only as a record of what this app used to rewrite; the new domain
// carries its own copies.
const NEW_ORIGIN = "https://www.joind2dblitz.com";

const nextConfig: NextConfig = {
  redirects: async () => [
    {
      // 307, not 308: browsers cache a permanent redirect indefinitely, which
      // would make this impossible to walk back if the cutover needs reversing.
      source: '/:path*',
      destination: `${NEW_ORIGIN}/:path*`,
      permanent: false,
    },
    {
      source: '/leaderboard',
      destination: '/dashboard/leaderboard',
      permanent: true,
    },
    {
      source: '/admin/touchpoints',
      destination: '/dashboard/admin/carriers',
      permanent: false,
    },
    {
      source: '/touchpoints',
      destination: '/dashboard/admin/carriers',
      permanent: false,
    },
  ],
};

export default nextConfig;
