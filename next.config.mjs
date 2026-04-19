/** @type {import('next').NextConfig} */
const nextConfig = {
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
