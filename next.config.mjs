/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse + pdfjs use a worker file; bundling with Turbopack produces invalid
  // virtual paths like "(rsc)/node_modules/.../pdf.worker.mjs" and text extraction fails.
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
  },
  async redirects() {
    return [
      // Browsers default to /favicon.ico; we use app/icon.svg instead.
      { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
