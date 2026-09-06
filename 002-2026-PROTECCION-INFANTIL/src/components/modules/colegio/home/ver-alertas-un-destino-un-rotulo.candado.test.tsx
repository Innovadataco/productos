/**
 * SPEC-561 · CANDADO: en el inicio del rector, un DESTINO tiene un solo rótulo.
 *
 * El hero y el embudo enlazan ambos a /dashboard/colegio/alertas. Tenían dos
 * rótulos distintos («Ver alertas» vs «Ver avisos nuevos»); Diseño unificó a
 * «Ver alertas» (nombra la sección; «avisos» se confundía con «Notificaciones»,
 * CO-14). El candado ancla por DESTINO, no por texto suelto: junta todos los
 * enlaces a esa ruta en la pantalla y exige que compartan un único rótulo. Muere
 * si vuelve a haber dos rótulos para el mismo destino — también caza la próxima
 * divergencia, no solo esta.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { EmbudoEstado } from "./EmbudoEstado";
import { HeroEstado } from "./HeroEstado";

const DESTINO = "/dashboard/colegio/alertas";

describe("SPEC-561 · un destino, un rótulo (inicio del rector)", () => {
    it("todos los enlaces a /dashboard/colegio/alertas usan el MISMO rótulo", () => {
        // Ambos con «pendiente» → ambos pintan su CTA a alertas.
        const { container } = render(
            <>
                <EmbudoEstado embudo={{ recibidos: 9, cerrados: 4, enRevision: 2, teEsperan: 3 }} />
                <HeroEstado estado="PENDIENTE" />
            </>,
        );
        const rotulos = [...container.querySelectorAll(`a[href="${DESTINO}"]`)].map((a) =>
            (a.textContent ?? "").replace(/\s+/g, " ").trim(),
        );
        // Anti-falso-verde: la pantalla realmente tiene ≥2 enlaces a ese destino.
        expect(rotulos.length, "no se encontraron los enlaces a alertas").toBeGreaterThanOrEqual(2);
        const distintos = new Set(rotulos);
        expect(
            distintos.size,
            `dos rótulos para el mismo destino (${DESTINO}): «${[...distintos].join("» · «")}»`,
        ).toBe(1);
    });
});
