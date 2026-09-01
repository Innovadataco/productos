import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D3b: build standalone para Docker (copia .next/standalone + .next/static + public)
  output: "standalone",
};

export default nextConfig;
