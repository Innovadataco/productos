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
        // E-8 (002-PI-056): formateo determinista + límites. `eslint --fix` deja el repo
        // en el formato canónico (indent 4, comillas dobles, punto y coma).
        name: "proteccion-infantil/formato-limites",
        rules: {
            semi: ["error", "always"],
            quotes: ["error", "double", { avoidEscape: true }],
            indent: ["error", 4, { SwitchCase: 1 }],
            // 36 funciones sobre 20 al activar (2026-08-02): ratchet visible hasta
            // bajarlas; subir este número rompe el gate cuando se convierta en error.
            complexity: ["warn", 20],
        },
    },
    {
        // E-8: techo de tamaño. Los 5 ofensores heredados quedan exentos con ratchet
        // (la lista solo se encoge; un archivo nuevo sobre 500 líneas rompe el gate).
        name: "proteccion-infantil/max-lines",
        files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs}"],
        ignores: [
            "**/*.test.*",
            "src/app/dashboard/admin/colegios/ColegiosPageClient.tsx",
            "src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx",
            // SPEC-571: el ofensor heredado `operadores/gestion/page.tsx` se dividió
            // (guardia de rol) en wrapper de servidor + este client; el contenido
            // grande —el mismo— vive ahora acá. No es deuda nueva: es el mismo archivo
            // renombrado por el split; el registro no crece.
            "src/app/dashboard/admin/operadores/gestion/GestionClient.tsx",
            "src/app/dashboard/circulo-confianza/page.tsx",
            "src/components/modules/ia/IaModelSelector.tsx",
            // SPEC-245 (002-PI-148): ofensor heredado >500 líneas; el ratchet solo se encoge,
            // pero el archivo ya excedía el techo antes de los métodos de esta spec.
            "src/lib/dal/repositories/pagos-repository.ts",
        ],
        rules: {
            "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
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
