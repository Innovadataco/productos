import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: [
      "legacy-sistema-original/**",
      "api/**",
      "web/**",
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
    ],
  },
  {
    // setState tras await dentro de un efecto es un patrón válido de data-fetching (alineado con 002).
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
];

export default config;
