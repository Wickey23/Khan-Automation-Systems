/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://ai-auto-apply.onrender.com https://api.stripe.com https://js.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com"
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), accelerometer=(), gyroscope=()"
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
