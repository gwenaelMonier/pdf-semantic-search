import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    outputFileTracingIncludes: {
      "/api/presets": ["./presets/**"],
      "/api/presets/[name]": ["./presets/**"],
    },
  },
};

export default nextConfig;
