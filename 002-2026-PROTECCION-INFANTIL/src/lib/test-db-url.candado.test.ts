/**
 * SPEC-817 · CANDADO de la resolución de DATABASE_URL por worktree. PURO (sin BD): por eso vive en la lane
 * unit y NO dispara el globalSetup de integración.
 *
 * Afirma (no confía) las condiciones del veredicto A del CEO:
 *  - CI-SAFETY: si el entorno PROVEE DATABASE_URL (el caso de CI), se respeta TAL CUAL y la derivación NO se
 *    dispara. Los seis jobs de CI pasan la misma base → todos resuelven la misma; la derivación no corre ahí.
 *  - Imposibilidad estructural: dos worktrees distintos → dos bases distintas (no pueden compartir).
 *  - EXPLOTA, nunca cae al compartido: sin poder derivar, lanza ruidosamente (un fallback a 5433 reconectaría
 *    a todos a I-439 en silencio).
 *  - El nombre derivado pasa la guardia de BD de prueba SPEC-770 — que mira el SUFIJO `_test`, no el nombre
 *    exacto. Se afirma importando la MISMA función de la guardia (si alguien la cambia a exacto, cae acá).
 */
import { describe, it, expect } from "vitest";
import {
    discriminadorWorktree,
    nombreBasePorWorktree,
    resolverDatabaseUrl,
    BASE_COMPARTIDA_LEGADO,
} from "./test-db-url";
import { esBaseDeDatosDePrueba } from "./e2e/guardia-base-de-datos";

const sep = "/";
const rutaDe = (worktree: string) =>
    `${sep}Users${sep}x${sep}${worktree}${sep}002-2026-PROTECCION-INFANTIL${sep}src${sep}lib${sep}test-db-url.ts`;
const RUTA_W1 = rutaDe(".worktrees" + sep + "pi-825"); // …/.worktrees/pi-825/002-…
const RUTA_W2 = rutaDe(".worktrees" + sep + "pi-830");
const RUTA_MAIN = rutaDe("productos");
const CI_URL = "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil_test";

describe("SPEC-817 · CI-safety: el DATABASE_URL del entorno se respeta; la derivación no se dispara", () => {
    it("entorno presente → origen 'entorno' y url TAL CUAL (no la pisa)", () => {
        const r = resolverDatabaseUrl({ DATABASE_URL: CI_URL });
        expect(r.origen).toBe("entorno");
        expect(r.url).toBe(CI_URL);
    });

    it("en CI el job e2e y los otros cinco resuelven la MISMA base (mismo valor del entorno → respetado)", () => {
        // Tras la edición de ci.yml, los 6 jobs ponen DATABASE_URL = la base de servicio `_test`.
        const otrosCinco = resolverDatabaseUrl({ DATABASE_URL: CI_URL });
        const jobE2e = resolverDatabaseUrl({ DATABASE_URL: CI_URL });
        expect(otrosCinco.url).toBe(jobE2e.url);
        expect(otrosCinco.origen).toBe("entorno");
        expect(jobE2e.origen).toBe("entorno");
    });

    it("no pisa un DATABASE_URL externo arbitrario (lo devuelve byte a byte)", () => {
        const externo = "postgresql://quien:sea@otro-host:6000/otra_base_test";
        expect(resolverDatabaseUrl({ DATABASE_URL: externo }).url).toBe(externo);
    });

    it("vacío o whitespace NO cuenta como provisto → deriva (no es un entorno real)", () => {
        expect(resolverDatabaseUrl({ DATABASE_URL: "" }).origen).toBe("derivada");
        expect(resolverDatabaseUrl({ DATABASE_URL: "   " }).origen).toBe("derivada");
    });
});

describe("SPEC-817 · derivación por worktree (régimen local, sin DATABASE_URL)", () => {
    it("sin entorno → origen 'derivada', la base termina en _test y NO es la compartida", () => {
        const r = resolverDatabaseUrl({});
        expect(r.origen).toBe("derivada");
        expect(r.url).toMatch(/_test$/);
        expect(r.url.endsWith(`/${BASE_COMPARTIDA_LEGADO}`)).toBe(false);
    });

    it("INJECTIVA: dos worktrees distintos → dos bases distintas (imposibilidad estructural de compartir)", () => {
        const w1 = nombreBasePorWorktree(discriminadorWorktree(RUTA_W1));
        const w2 = nombreBasePorWorktree(discriminadorWorktree(RUTA_W2));
        const main = nombreBasePorWorktree(discriminadorWorktree(RUTA_MAIN));
        expect(new Set([w1, w2, main]).size).toBe(3);
    });

    it("el nombre derivado pasa la guardia SPEC-770 (que mira el SUFIJO `_test`, no el nombre exacto)", () => {
        expect(esBaseDeDatosDePrueba(nombreBasePorWorktree(discriminadorWorktree(RUTA_W1)))).toBe(true);
        expect(esBaseDeDatosDePrueba(nombreBasePorWorktree(discriminadorWorktree(RUTA_MAIN)))).toBe(true);
    });

    it("la base derivada NUNCA es la compartida pelada `proteccion_infantil_test`", () => {
        expect(nombreBasePorWorktree(discriminadorWorktree(RUTA_W1))).not.toBe(BASE_COMPARTIDA_LEGADO);
    });

    it("control positivo RUIDOSO: sin poder derivar EXPLOTA (no cae al compartido, en silencio)", () => {
        expect(() => discriminadorWorktree("/tmp/sin-producto/x.ts")).toThrow(/No puedo derivar/i);
    });
});
