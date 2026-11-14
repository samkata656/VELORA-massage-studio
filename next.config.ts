import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Booking data changes constantly; pages render per request (Cache Components off).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
