import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Default false — Stripe Dashboard webhook URL must be without a trailing slash (e.g. …/api/webhooks/stripe). */
  trailingSlash: false,
  async redirects() {
    return [
      { source: "/refund", destination: "/", permanent: true },
    ];
  },
  /** Sinch `callbackUrl` can use `/api/webhooks/sinch` — same handler as Phaxio-era path. */
  async rewrites() {
    return [
      { source: "/api/webhooks/sinch", destination: "/api/webhooks/phaxio" },
    ];
  },
};

export default nextConfig;
