import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de producción liviana (docker-compose.prod.yml llegará en su SPEC).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
