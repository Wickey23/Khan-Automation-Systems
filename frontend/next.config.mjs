/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app", permanent: false },
      { source: "/dashboard/calls", destination: "/app/calls", permanent: false },
      { source: "/dashboard/leads", destination: "/app/leads", permanent: false },
      { source: "/dashboard/settings", destination: "/app/settings", permanent: false },
      { source: "/dashboard/billing", destination: "/app/billing", permanent: false },
      { source: "/dashboard/setup", destination: "/app/activation", permanent: false },
      { source: "/dashboard/support", destination: "/app/insights", permanent: false },
      { source: "/dashboard/:path*", destination: "/app", permanent: false }
    ];
  },
  async headers() {
    // Content-Security-Policy for production.
    // NOTE: 'unsafe-inline' on script-src is needed for Next.js inline scripts.
    // Long-term hardening: migrate to nonce-based CSP with
    //   next.config.mjs generateBuildId + middleware-injected nonces.
    // 'unsafe-eval' is NOT included — Next.js 14+ production builds do not need it.
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.khansystems.com https://api.stripe.com https://js.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "upgrade-insecure-requests"
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          // Enforced CSP — blocks actual violations, not just reports.
          { key: "Content-Security-Policy", value: cspDirectives },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), accelerometer=(), gyroscope=()"
          },
          // HSTS: tell browsers this domain is always HTTPS for 180 days.
          // Remove includeSubDomains if subdomain HTTP is needed.
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains"
          }
        ]
      }
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive-synced folders can corrupt persistent webpack cache files.
      // Disable filesystem cache in dev to prevent missing CSS/chunk artifacts.
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
