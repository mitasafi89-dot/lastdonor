import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ntnrcedafgmeyajmzvga.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "d1ds6k2agfrpnf.cloudfront.net", // DVIDS CDN
      },
      {
        protocol: "https",
        hostname: "**", // News article images from various sources
      },
    ],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(self)",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' js.stripe.com plausible.io",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https: *.supabase.co dvidshub.net",
            "connect-src 'self' api.stripe.com *.supabase.co *.sentry.io wss://ws-us3.pusher.com",
            "frame-src js.stripe.com",
            "font-src 'self' fonts.gstatic.com",
          ].join("; "),
        },
      ],
    },
    {
      source: "/api/v1/stats",
      headers: [
        {
          key: "Cache-Control",
          value: "s-maxage=300, stale-while-revalidate=600",
        },
      ],
    },
    {
      source: "/api/v1/campaigns",
      headers: [
        {
          key: "Cache-Control",
          value: "s-maxage=60, stale-while-revalidate=600",
        },
      ],
    },
    {
      source: "/api/v1/donations/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store",
        },
      ],
    },
    {
      source: "/api/v1/og/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, s-maxage=86400",
        },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: true,
  },
});
