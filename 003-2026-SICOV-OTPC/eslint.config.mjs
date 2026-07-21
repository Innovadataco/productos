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
];

export default config;
