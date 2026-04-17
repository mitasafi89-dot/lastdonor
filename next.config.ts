import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      'date-fns',
      'recharts',
      'motion',
    ],
  },
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
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "www.twincities.com",
      },
      {
        // News article images from any domain (resolved by image-resolver.ts)
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
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
            "script-src 'self' 'unsafe-inline' js.stripe.com plausible.io",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https: *.supabase.co dvidshub.net img.youtube.com",
            "connect-src 'self' api.stripe.com *.supabase.co *.sentry.io wss://ws-us3.pusher.com",
            "frame-src 'self' https://js.stripe.com https://www.youtube-nocookie.com https://youtube-nocookie.com https://www.youtube.com https://youtube.com",
            "font-src 'self' fonts.gstatic.com",
          ].join("; "),
        },
      ],
    },
    {
      // Immutable static assets (hashed filenames)
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      // Public static assets (images, fonts)
      source: "/:path(images|fonts)/:file*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=604800, stale-while-revalidate=86400",
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
