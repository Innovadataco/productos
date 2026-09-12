/**
 * SPEC-652 · CANDADO de conducta: el paso 4 del alta, mientras la suscripción
 * paga esté en pausa, ofrece la PRUEBA GRATIS y NINGÚN control de precio pago.
 *
 * Contexto: SPEC-628 apagó la suscripción paga (precios de siembra) pero solo en
 * `Mi perfil → Suscripción`; el alta —camino OBLIGATORIO— siguió mostrando el
 * selector vivo con precios placeholder a todo el que se registra. Este candado
 * vigila que el arreglo no se deshaga y que no reaparezca por otra pantalla.
 *
 * Muere por MUTACIÓN: si `planesVisiblesEnAlta` deja de filtrar, el selector
 * vuelve a pintar las tarjetas pagas (botón «Elegir») → rojo. Si una página del
 * alta deja de enrutar sus planes por el helper, el escaneo estructural → rojo.
 *
 * fs + render (jsdom), sin base de datos → unit.
 */
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { render, screen } from "@testing-library/react";
import { PlanesSelector } from "@/components/modules/pagos/PlanesSelector";
import { planesVisiblesEnAlta, SUSCRIPCION_PAGA_EN_PAUSA } from "@/lib/pagos/suscripcion-pausa";
import type { PlanSelectorDTO } from "@/lib/pagos/planes-selector.types";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

function plan(over: Partial<PlanSelectorDTO> & { id: string }): PlanSelectorDTO {
    return {
        nombre: "Plan",
        descripcion: null,
        duracion: "MES_6",
        precioBaseCOP: 0,
        precioBaseUSD: 0,
        descuentoAnualPct: null,
        esFreemium: false,
        activo: true,
        ...over,
    };
}

const FREEMIUM = plan({ id: "free", nombre: "Prueba gratis", duracion: "MES_1", precioBaseCOP: 0, esFreemium: true });
const MIXTOS: PlanSelectorDTO[] = [
    FREEMIUM,
    plan({ id: "p6", nombre: "6 meses", duracion: "MES_6", precioBaseCOP: 80_000 }),
    plan({ id: "p12", nombre: "Anual", duracion: "MES_12", precioBaseCOP: 1_000_000 }),
];

describe("SPEC-652 · el alta en pausa: prueba gratis sí, precios pagos no", () => {
    it("planesVisiblesEnAlta: en pausa deja SOLO los freemium; sin pausa, todos", () => {
        expect(planesVisiblesEnAlta(MIXTOS, true).map((p) => p.id)).toEqual(["free"]);
        expect(planesVisiblesEnAlta(MIXTOS, false).map((p) => p.id)).toEqual(["free", "p6", "p12"]);
    });

    it("mientras la pausa esté activa (flag vivo), el alta deja al menos la prueba gratis y nada pago", () => {
        // El candado vigila la CONDUCTA de la pausa. Si se reactiva
        // (SUSCRIPCION_PAGA_EN_PAUSA=false, decisión de Jelkin con precios reales),
        // se revisa en esa SPEC — no es un invariante eterno.
        const visibles = planesVisiblesEnAlta(MIXTOS);
        if (SUSCRIPCION_PAGA_EN_PAUSA) {
            expect(visibles.length).toBeGreaterThan(0);
            expect(visibles.every((p) => p.esFreemium)).toBe(true);
        } else {
            expect(visibles).toEqual(MIXTOS);
        }
    });

    it("render padre: ofrece «Activar prueba gratis» y NINGÚN botón «Elegir» (pausa)", () => {
        render(
            <PlanesSelector
                planes={planesVisiblesEnAlta(MIXTOS, true)}
                usuario={{ id: "u1", rol: "PARENT", nombre: "Ana", email: "ana@correo.co" }}
                color="cielo"
                onSeleccionar={vi.fn()}
                onFreemium={vi.fn()}
                tasaIva={19}
                aplicaIva
            />,
        );
        expect(screen.getByRole("button", { name: /Activar prueba gratis/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Elegir" })).toBeNull();
        // Y ningún rastro del precio placeholder anual.
        expect(screen.queryByText(/1\.?190\.?000|1\.000\.000/)).toBeNull();
        // FORMA guarda #2: con una sola tarjeta, nada de «elige» — no hay selector.
        expect(screen.queryByText("Elige tu plan")).toBeNull();
    });

    it("render colegio: su prueba gratis sembrada lo deja avanzar sin pagos", () => {
        render(
            <PlanesSelector
                planes={planesVisiblesEnAlta(MIXTOS, true)}
                usuario={{ id: "c1", rol: "SCHOOL_ADMIN", nombre: "Rectora", email: "rectora@colegio.co" }}
                color="pino"
                onSeleccionar={vi.fn()}
                onFreemium={vi.fn()}
                tasaIva={19}
                aplicaIva
            />,
        );
        expect(screen.getByRole("button", { name: /Activar prueba gratis/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Elegir" })).toBeNull();
        // FORMA guarda #2, voz usted: tampoco «Elija su plan» con una sola tarjeta.
        expect(screen.queryByText("Elija su plan")).toBeNull();
    });

    it("estructural: las DOS páginas del alta enrutan sus planes por la pausa", () => {
        const padre = fs.readFileSync(path.join(SRC, "app/camino/plan/page.tsx"), "utf-8");
        const colegio = fs.readFileSync(path.join(SRC, "app/camino/colegio/plan/page.tsx"), "utf-8");
        // Si alguien pasa `planes={dtos}` crudo otra vez, el alta vuelve a mostrar
        // precios placeholder y este candado muere.
        expect(padre).toMatch(/planes=\{planesVisiblesEnAlta\(/);
        expect(colegio).toMatch(/planes=\{planesVisiblesEnAlta\(/);
    });
});
