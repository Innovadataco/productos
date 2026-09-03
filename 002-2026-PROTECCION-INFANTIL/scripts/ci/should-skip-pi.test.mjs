/**
 * SPEC-374 · La decisión de correr la suite de PI queda fijada por tests.
 *
 * Los 9 casos cubren:
 *   (a) PR de otro producto → skip=true (el caso del radicado y de idc-67/PIWEB)
 *   (b) PR de PI → skip=false (no relajamos nada)
 *   (c) raíz compartida (workflow del monorepo) → skip=false
 *   (d,e) doc-only dentro de PI → skip=true
 *   (f) 007-PIWEB → skip=true (el caso concreto del CEO)
 *   (g) mixto BI+PI → skip=false
 *   (h) otro proyecto entero → skip=true
 *   (i) workflow ajeno (bi.yml) → skip=true
 */
import { describe, it, expect } from "vitest";
import { afectaAPI, deberSaltar } from "./should-skip-pi.mjs";

describe("afectaAPI · qué archivo dispara la suite de PI (SPEC-374)", () => {
    it("cualquier .ts/.tsx bajo 002-2026-PROTECCION-INFANTIL/ dispara", () => {
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL/src/lib/x.ts")).toBe(true);
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL/src/app/api/y/route.ts")).toBe(true);
    });

    it("doc-only en PI (docs/, specs/, *.md) NO dispara", () => {
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL/docs/architecture.md")).toBe(false);
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL/specs/374-x/spec.md")).toBe(false);
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL/README.md")).toBe(false);
    });

    it("los 2 workflows compartidos del monorepo disparan", () => {
        expect(afectaAPI(".github/workflows/ci.yml")).toBe(true);
        expect(afectaAPI(".github/workflows/verificar-base-pr.yml")).toBe(true);
    });

    it("workflows específicos de otros productos NO disparan", () => {
        expect(afectaAPI(".github/workflows/bi.yml")).toBe(false);
        expect(afectaAPI(".github/workflows/bi-006.yml")).toBe(false);
    });

    it("otros productos hermanos (BI, PIWEB, SICOV, SARLAFT) NO disparan", () => {
        expect(afectaAPI("006-2026-BI-INTELIGENCIA-NEGOCIO/src/app/page.tsx")).toBe(false);
        expect(afectaAPI("007-2026-PIWEB/index.html")).toBe(false);
        expect(afectaAPI("003-2026-SICOV-OTPC/src/x.ts")).toBe(false);
        expect(afectaAPI("004-2026-SARLAFT/x.md")).toBe(false);
    });

    it("docs raíz (AGENTS.md, README.md, .gitignore) NO disparan", () => {
        expect(afectaAPI("AGENTS.md")).toBe(false);
        expect(afectaAPI("README.md")).toBe(false);
        expect(afectaAPI(".gitignore")).toBe(false);
    });

    it("un nombre coincidencia (prefijo similar) NO dispara — solo el prefijo exacto", () => {
        // Contrafixture: si algún día apareciera `002-2026-PROTECCION-INFANTIL-DEMO/`
        // (o similar), no debe contarse como parte de PI.
        expect(afectaAPI("002-2026-PROTECCION-INFANTIL-DEMO/x.ts")).toBe(false);
    });
});

describe("deberSaltar · decisión sobre la lista completa (SPEC-374)", () => {
    it("(a) PR de otro producto: solo archivos ajenos → skip=true", () => {
        // El escenario que motivó la spec (Kimi/BI-006).
        expect(deberSaltar([
            "006-2026-BI-INTELIGENCIA-NEGOCIO/src/app/dashboard/page.tsx",
            "006-2026-BI-INTELIGENCIA-NEGOCIO/prisma/schema.prisma",
        ])).toBe(true);
    });

    it("(b) PR de PI: código de PI → skip=false", () => {
        expect(deberSaltar([
            "002-2026-PROTECCION-INFANTIL/src/lib/routing/guardias.ts",
        ])).toBe(false);
    });

    it("(c) PR que toca la raíz compartida (workflow del monorepo) → skip=false", () => {
        expect(deberSaltar([
            ".github/workflows/ci.yml",
        ])).toBe(false);
    });

    it("(d) PR doc-only en PI (docs/) → skip=true", () => {
        expect(deberSaltar([
            "002-2026-PROTECCION-INFANTIL/docs/architecture/02-roles-capacidades.md",
        ])).toBe(true);
    });

    it("(e) PR solo del README de PI → skip=true", () => {
        expect(deberSaltar([
            "002-2026-PROTECCION-INFANTIL/README.md",
        ])).toBe(true);
    });

    it("(f) PR del sitio 007-PIWEB (caso vivo del CEO) → skip=true", () => {
        expect(deberSaltar([
            "007-2026-PIWEB/index.html",
            "007-2026-PIWEB/README.md",
        ])).toBe(true);
    });

    it("(g) PR mixto: cambios en BI y en PI → skip=false (PI manda)", () => {
        // Un solo archivo de PI en la mezcla ya obliga a correr la suite: no
        // relajamos por mezcla, no relajamos por proporciones.
        expect(deberSaltar([
            "006-2026-BI-INTELIGENCIA-NEGOCIO/src/app/x.tsx",
            "002-2026-PROTECCION-INFANTIL/src/lib/y.ts",
        ])).toBe(false);
    });

    it("(h) PR entero de otro proyecto (SARLAFT doc + código) → skip=true", () => {
        expect(deberSaltar([
            "004-2026-SARLAFT/README.md",
            "004-2026-SARLAFT/src/main.py",
        ])).toBe(true);
    });

    it("(i) PR que solo toca el workflow ajeno de BI → skip=true", () => {
        // bi.yml es el CI propio de BI: cambiar su reparto NO puede requerir la
        // suite de PI (si fuera ci.yml, sí — ver (c)).
        expect(deberSaltar([
            ".github/workflows/bi.yml",
        ])).toBe(true);
    });

    it("lista vacía → skip=true (por definición: no hay nada que validar)", () => {
        expect(deberSaltar([])).toBe(true);
    });
});
