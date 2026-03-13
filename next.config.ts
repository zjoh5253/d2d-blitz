import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
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
