import type { NextConfig } from "next";

// Defense-in-depth headers applied by every hosting adapter (Vercel,
// Netlify, Render, OpenNext Cloudflare). The CSP keeps the inline theme
// boot script and Next.js bootstrap working while blocking external
// script/object injection; connect-src allows the icon search API and
// data:/blob: fetches used by export flows (DM-SEC-4).
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is required by the React Refresh (Fast Refresh) runtime in
  // `next dev` only; production builds keep it excluded.
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob: https://api.iconify.design",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Required by the OpenNext Cloudflare build; harmless for Node hosting
  // (Vercel, Netlify, Render) which use their own adapters.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
