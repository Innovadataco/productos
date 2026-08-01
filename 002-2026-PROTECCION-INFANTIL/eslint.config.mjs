import { createRequire } from "node:module";

import nextConfig from "eslint-config-next";

const require = createRequire(import.meta.url);
// Q-3 (002-PI-056): heredados con acceso directo a Prisma mientras E-8 migra al DAL. La lista solo se encoge.
// Los corchetes de los segmentos dinámicos ([id]) se escapan para que minimatch los trate como literales.
const prismaDirectoAllowlist = require("./scripts/arch/prisma-directo-allowlist.json").archivos.map(
    (p) => p.replace(/\[/g, "[[]"),
);

const config = [
    ...nextConfig,
    {
        name: "proteccion-infantil/ignores",
        ignores: ["design/**"],
    },
    {
        name: "proteccion-infantil/rules",
        rules: {
            // Esta regla es experimental y demasiado estricta para efectos de carga de datos comunes.
            "react-hooks/set-state-in-effect": "off",
        },
    },
    {
        // Frontera del DAL (Q-3): @/lib/prisma solo se importa dentro de src/lib/dal/.
        // Tests y e2e siembran la BD directamente por diseño; los heredados viven en la allowlist (solo se encoge).
        name: "proteccion-infantil/dal-frontera",
        files: ["src/**/*.{ts,tsx}"],
        ignores: [
            "src/lib/dal/**",
            "src/lib/e2e/**",
            "**/*.test.*",
            ...prismaDirectoAllowlist,
        ],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "@/lib/prisma",
                            message:
                                "Acceso directo a Prisma prohibido fuera del DAL: usa un repositorio/servicio de src/lib/dal/ (Q-3). Heredados pendientes de migrar (E-8): scripts/arch/prisma-directo-allowlist.json.",
                        },
                    ],
                },
            ],
        },
    },
];

export default config;
