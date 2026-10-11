import type { NextConfig } from "next";

// The browser only ever calls /api/... on this origin; Next forwards it to the API. That keeps the
// httpOnly refresh cookie same-origin (Path=/api/auth) and means no CORS is needed.
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "");
if (!apiOrigin) {
  throw new Error(
    "API_ORIGIN is not set. Copy apps/web/.env.example to apps/web/.env.local and set it to the API's origin.",
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
  experimental: {
    // Render's free tier can take close to a minute to wake up; the default proxy timeout is 30 s.
    proxyTimeout: 60_000,
  },
};

export default nextConfig;
