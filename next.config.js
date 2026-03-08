/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Prevent webpack from bundling the pdf worker
    config.resolve.alias["pdfjs-dist/build/pdf.worker.mjs"] = false;
    config.resolve.alias["pdfjs-dist/build/pdf.worker.min.mjs"] = false;
    return config;
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'",
        },
      ],
    },
  ],
};

module.exports = nextConfig;
