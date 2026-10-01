/**
 * SPEC-789 · La decisión de correr `test-e2e` en un PR queda fijada por tests.
 *
 * La suite corre en un PR SI Y SOLO SI el diff puede romper el ARNÉS: esquema,
 * siembra o la propia suite. (En push a `main`/`workflow_dispatch` corre siempre,
 * pero eso vive en el `if:` del job por `github.event_name`, no en este módulo.)
 */
import { describe, it, expect } from "vitest";
import { puedeRomperArnesE2E, deberCorrerE2E } from "./should-run-e2e-pi.mjs";

const PI = "002-2026-PROTECCION-INFANTIL/";

describe("puedeRomperArnesE2E · qué archivo obliga a correr la suite (SPEC-789)", () => {
    it("ESQUEMA: schema.prisma y migrations/ disparan", () => {
        expect(puedeRomperArnesE2E(`${PI}prisma/schema.prisma`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}prisma/migrations/20260929_x/migration.sql`)).toBe(true);
    });

    it("SIEMBRA: seed.ts (bajo prisma/) y los seed-e2e-* disparan", () => {
        expect(puedeRomperArnesE2E(`${PI}prisma/seed.ts`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}scripts/seed-e2e-cuentas-calidad.ts`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}scripts/seed-e2e-multi-tenant.ts`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}scripts/seed-e2e-credenciales-roles.ts`)).toBe(true);
    });

    it("ARNÉS: ensure-pgboss y .env.test disparan", () => {
        expect(puedeRomperArnesE2E(`${PI}scripts/ensure-pgboss.mjs`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}.env.test`)).toBe(true);
    });

    it("SUITE: tests/e2e/** y playwright.config.ts disparan", () => {
        expect(puedeRomperArnesE2E(`${PI}tests/e2e/cita/enlace.spec.ts`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}tests/e2e/global-setup.ts`)).toBe(true);
        expect(puedeRomperArnesE2E(`${PI}playwright.config.ts`)).toBe(true);
    });

    it("código de PI que NO es arnés (src/, componentes) NO dispara", () => {
        expect(puedeRomperArnesE2E(`${PI}src/lib/routing/guardias.ts`)).toBe(false);
        expect(puedeRomperArnesE2E(`${PI}src/app/api/reportes/route.ts`)).toBe(false);
        expect(puedeRomperArnesE2E(`${PI}src/components/modules/Foo.tsx`)).toBe(false);
    });

    it("doc/spec de PI NO dispara", () => {
        expect(puedeRomperArnesE2E(`${PI}specs/789-x/spec.md`)).toBe(false);
        expect(puedeRomperArnesE2E(`${PI}docs/architecture/00-INDICE.md`)).toBe(false);
    });

    it("scripts de PI que NO son del arnés NO disparan", () => {
        // Contraprueba de que el prefijo es ESPECÍFICO, no "cualquier script".
        expect(puedeRomperArnesE2E(`${PI}scripts/arch/arch-check.mjs`)).toBe(false);
        expect(puedeRomperArnesE2E(`${PI}scripts/ci/should-run-e2e-pi.mjs`)).toBe(false);
    });

    it("el esquema/siembra de OTRO producto NO dispara (debe vivir bajo la carpeta de PI)", () => {
        expect(puedeRomperArnesE2E("006-2026-BI-INTELIGENCIA-NEGOCIO/prisma/schema.prisma")).toBe(false);
        expect(puedeRomperArnesE2E("006-2026-BI-INTELIGENCIA-NEGOCIO/tests/e2e/x.spec.ts")).toBe(false);
    });

    it("prefijo similar (PI-DEMO) NO dispara — solo la carpeta exacta", () => {
        expect(puedeRomperArnesE2E("002-2026-PROTECCION-INFANTIL-DEMO/prisma/schema.prisma")).toBe(false);
    });
});

describe("deberCorrerE2E · decisión sobre la lista completa (SPEC-789)", () => {
    it("PR que toca el esquema → corre", () => {
        expect(deberCorrerE2E([`${PI}prisma/schema.prisma`])).toBe(true);
    });

    it("PR que toca solo src/ de PI → NO corre (es donde ahorramos los ~19 min)", () => {
        expect(deberCorrerE2E([
            `${PI}src/lib/x.ts`,
            `${PI}src/app/api/y/route.ts`,
        ])).toBe(false);
    });

    it("PR mixto: un archivo de arnés en la mezcla ya obliga a correr", () => {
        expect(deberCorrerE2E([
            `${PI}src/lib/x.ts`,
            `${PI}tests/e2e/cita/enlace.spec.ts`,
        ])).toBe(true);
    });

    it("PR doc-only de PI → NO corre", () => {
        expect(deberCorrerE2E([`${PI}specs/789-x/spec.md`])).toBe(false);
    });

    it("PR de otro producto → NO corre (should-skip ya lo salta; acá también false)", () => {
        expect(deberCorrerE2E([
            "006-2026-BI-INTELIGENCIA-NEGOCIO/prisma/schema.prisma",
        ])).toBe(false);
    });

    it("lista vacía → NO corre", () => {
        expect(deberCorrerE2E([])).toBe(false);
    });
});
