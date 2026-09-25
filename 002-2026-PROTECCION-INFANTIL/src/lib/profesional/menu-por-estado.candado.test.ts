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

// SPEC-732: «Citaciones» se unificó en «Calendario» — ya no es una ruta operativa aparte.
const OPERATIVAS = [
    "/dashboard/profesional",
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
    it("verificado (habilitado) → inicio · casos · calendario · mi perfil (en ese orden)", () => {
        const pro = { estado: "ACTIVO", habilitado: true };
        // SPEC-732: «Citaciones» se unificó en «Calendario» — un solo ítem operativo del calendario.
        expect(labels(pro)).toEqual(["Inicio", "Casos", "Calendario", "Mi perfil"]);
        // SPEC-685 (PR2-bis): «Mi perfil» del habilitado es su propia pantalla
        // (datos + tarifa + documentos + estado), ya no la ficha de completar.
        expect(hrefs(pro)).toEqual([...OPERATIVAS, "/dashboard/profesional/mi-perfil"]);
    });

    // SPEC-706: «Mi estado» (/perfil-profesional/verificacion) se retiró — su contenido es el
    // ENCABEZADO de la ficha, una sola pantalla. El portero queda con UNA entrada: «Mi ficha».
    it("portero (no habilitado, CUALQUIER estado) → SOLO «Mi ficha», nada operativo", () => {
        for (const pro of NO_HABILITADOS) {
            expect(labels(pro), `estado ${pro.estado}`).toEqual(["Mi ficha"]);
            expect(hrefs(pro)).toEqual(["/perfil-profesional/completar"]);
            expect(tieneOperativa(pro), `estado ${pro.estado} filtró una entrada operativa`).toBe(false);
        }
    });

    it("worker-lag (ajuste del CEO): ACTIVO con habilitado=false → portero, NO operativo", () => {
        const pro = { estado: "ACTIVO", habilitado: false };
        expect(labels(pro)).toEqual(["Mi ficha"]);
        expect(tieneOperativa(pro)).toBe(false);
    });

    it("fail-closed: sin dato (null / undefined / cargando) → portero", () => {
        expect(labels(null)).toEqual(["Mi ficha"]);
        expect(labels(undefined)).toEqual(["Mi ficha"]);
        expect(tieneOperativa(null)).toBe(false);
    });

    it("CONTROL POSITIVO: el mismo usuario, cambiando solo `habilitado`, cambia sus entradas", () => {
        const base = { estado: "ACTIVO" };
        expect(labels({ ...base, habilitado: false })).not.toEqual(labels({ ...base, habilitado: true }));
        // El cambio es exactamente la dimensión operativa: 0 → 3 (SPEC-732 unificó Citaciones en Calendario).
        expect(hrefs({ ...base, habilitado: false }).filter((h) => OPERATIVAS.includes(h)).length).toBe(0);
        expect(hrefs({ ...base, habilitado: true }).filter((h) => OPERATIVAS.includes(h)).length).toBe(3);
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
