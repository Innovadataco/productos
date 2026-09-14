/**
 * CANDADO · SPEC-691 · El menú del profesional muestra EXACTAMENTE las entradas de
 * su estado — la compuerta (MAPA §0, seguridad).
 *
 * Un candado que verifique «hay un menú» pasa con el menú de hoy (el de módulo, que
 * deja a un recién registrado llegar a los flujos de casos de menores). Este afirma
 * la LISTA EXACTA por estado y, sobre todo, que **antes de verificar no hay ninguna
 * entrada operativa** (inicio/citaciones/casos/calendario). Control positivo del
 * CEO: el mismo usuario, cambiando solo `habilitado`, cambia sus entradas.
 *
 * Conducta con el contrato real: se condiciona a `habilitado` de /api/me (SPEC-690),
 * no a `estado` crudo — el ajuste que midió el CEO (worker de vigencia: `ACTIVO` con
 * `habilitado=false` en la ventana antes de que corra → portero, no operativo).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { entradasProfesional, type EstadoProfesionalSesion } from "./menu-por-estado";
import { PROFESIONAL_NAV_ITEMS } from "@/lib/nav-items";

const OPERATIVAS = [
    "/dashboard/profesional",
    "/dashboard/profesional/citaciones",
    "/dashboard/profesional/casos",
    "/dashboard/profesional/calendario",
];

const labels = (pro: EstadoProfesionalSesion) => entradasProfesional(pro).map((e) => e.label);
const hrefs = (pro: EstadoProfesionalSesion) => entradasProfesional(pro).map((e) => e.href);
const tieneOperativa = (pro: EstadoProfesionalSesion) => hrefs(pro).some((h) => OPERATIVAS.includes(h));

// `estado` acompaña al dato real aunque el menú se decida por `habilitado`: así el
// candado documenta cada estado del enum EstadoPerfilProfesional.
const NO_HABILITADOS: { estado: string; habilitado: boolean }[] = [
    { estado: "BORRADOR", habilitado: false },
    { estado: "EN_REVISION", habilitado: false },
    { estado: "VENCIDO", habilitado: false },
    { estado: "SUSPENDIDO", habilitado: false },
    { estado: "RECHAZADO", habilitado: false },
    { estado: "ACTIVO", habilitado: false }, // worker-lag: vigencia vencida, worker sin correr
];

describe("SPEC-691 · el menú del profesional = exactamente las entradas de su estado", () => {
    it("verificado (habilitado) → inicio · citaciones · casos · calendario · mi perfil (en ese orden)", () => {
        const pro = { estado: "ACTIVO", habilitado: true };
        expect(labels(pro)).toEqual(["Inicio", "Citaciones", "Casos", "Calendario", "Mi perfil"]);
        expect(hrefs(pro)).toEqual([...OPERATIVAS, "/perfil-profesional/completar"]);
    });

    it("portero (no habilitado, CUALQUIER estado) → SOLO «Mi ficha» · «Mi estado», nada operativo", () => {
        for (const pro of NO_HABILITADOS) {
            expect(labels(pro), `estado ${pro.estado}`).toEqual(["Mi ficha", "Mi estado"]);
            expect(hrefs(pro)).toEqual(["/perfil-profesional/completar", "/perfil-profesional/verificacion"]);
            expect(tieneOperativa(pro), `estado ${pro.estado} filtró una entrada operativa`).toBe(false);
        }
    });

    it("worker-lag (ajuste del CEO): ACTIVO con habilitado=false → portero, NO operativo", () => {
        const pro = { estado: "ACTIVO", habilitado: false };
        expect(labels(pro)).toEqual(["Mi ficha", "Mi estado"]);
        expect(tieneOperativa(pro)).toBe(false);
    });

    it("fail-closed: sin dato (null / undefined / cargando) → portero", () => {
        expect(labels(null)).toEqual(["Mi ficha", "Mi estado"]);
        expect(labels(undefined)).toEqual(["Mi ficha", "Mi estado"]);
        expect(tieneOperativa(null)).toBe(false);
    });

    it("CONTROL POSITIVO: el mismo usuario, cambiando solo `habilitado`, cambia sus entradas", () => {
        const base = { estado: "ACTIVO" };
        expect(labels({ ...base, habilitado: false })).not.toEqual(labels({ ...base, habilitado: true }));
        // El cambio es exactamente la dimensión operativa: 0 → 4.
        expect(hrefs({ ...base, habilitado: false }).filter((h) => OPERATIVAS.includes(h)).length).toBe(0);
        expect(hrefs({ ...base, habilitado: true }).filter((h) => OPERATIVAS.includes(h)).length).toBe(4);
    });

    it("estructural (I-299): cada entrada está en PROFESIONAL_NAV_ITEMS y tiene page.tsx", () => {
        const APP = path.resolve(process.cwd(), "src", "app");
        const validos = new Set(PROFESIONAL_NAV_ITEMS.map((i) => i.href));
        for (const pro of [{ estado: "ACTIVO", habilitado: true }, { estado: "EN_REVISION", habilitado: false }]) {
            for (const e of entradasProfesional(pro)) {
                expect(validos, `«${e.href}» no está en PROFESIONAL_NAV_ITEMS`).toContain(e.href);
                const page = path.join(APP, e.href.replace(/^\//, ""), "page.tsx");
                expect(fs.existsSync(page), `«${e.href}» no tiene page.tsx (pantalla muerta, I-299)`).toBe(true);
            }
        }
    });
});
