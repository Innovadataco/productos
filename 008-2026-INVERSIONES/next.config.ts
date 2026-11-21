import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de producción liviana (docker-compose.prod.yml llegará en su SPEC).
  output: "standalone",
  poweredByHeader: false,
  // `next dev` no escribe instrucciones para agentes de IA en AGENTS.md (ese archivo tiene dueño).
  agentRules: false,
};

export default nextConfig;
