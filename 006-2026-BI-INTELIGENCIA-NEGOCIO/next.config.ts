import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D3b: build standalone para Docker (copia .next/standalone + .next/static + public)
  output: "standalone",
  // Prisma en standalone: el cliente generado y los engines deben quedar
  // trazados en .next/standalone o el runtime no los encuentra
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/engines/**/*",
    ],
  },
};

export default nextConfig;
