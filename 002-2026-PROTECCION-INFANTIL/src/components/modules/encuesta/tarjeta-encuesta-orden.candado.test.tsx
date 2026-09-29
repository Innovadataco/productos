/**
 * CANDADO · SPEC-784 — INVARIANTE del punto de entrada: en el panel del padre, la vía de REPORTE va
 * SIEMPRE ANTES que la tarjeta de la encuesta.
 *
 * El gate desapareció (Diseño eligió tarjeta, no compuerta) — bien, la cosa peligrosa no se construye.
 * Pero eso dejó la invariante «nunca sobre el reporte» sin ningún mecanismo salvo el orden de render,
 * que es CONVENCIÓN, no garantía: cualquiera reordena los bloques del panel por una razón sensata y
 * empuja «Reportar un riesgo» bajo el pliegue, en el peor momento para un padre que entra a denunciar.
 *
 * Este candado deriva del ÁRBOL DE RENDER real (monta `DashboardUsuarioClient`) y afirma que el enlace
 * de reporte PRECEDE a la tarjeta. Control positivo por MUTACIÓN: invertí el orden en el componente y
 * este test cae (verificado al escribirlo). Unit (jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({ user: { id: "u1", rol: "PARENT" }, isLoading: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// Stubs de los hijos pesados: no importan a este candado y evitan fetches paralelos.
vi.mock("@/components/modules/MisReportesList", () => ({ MisReportesList: () => <div>mis-reportes</div> }));
vi.mock("@/components/modules/ConsultaEnriquecidaClient", () => ({ ConsultaEnriquecidaClient: () => <div>consulta</div> }));

import { DashboardUsuarioClient } from "@/components/modules/DashboardUsuarioClient";

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const body = url.includes("/api/encuesta")
                ? { data: { pendientes: [{ solicitudId: "s1", franjaInicio: new Date().toISOString() }] } }
                : { items: [] };
            return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        }),
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-784 · la tarjeta de encuesta NUNCA precede a la vía de reporte", () => {
    it("en el panel del padre, «Reportar un riesgo» aparece ANTES que la tarjeta de la encuesta", async () => {
        render(<DashboardUsuarioClient />);

        const reportar = await screen.findByRole("link", { name: /reportar un riesgo/i });
        const cta = await screen.findByRole("link", { name: /contar cómo me fue/i });
        const tarjeta = cta.closest("section");
        expect(tarjeta, "la tarjeta debe existir cuando hay una encuesta pendiente").not.toBeNull();

        // `reportar.compareDocumentPosition(tarjeta)` con el bit FOLLOWING ⇒ la tarjeta va DESPUÉS de
        // reportar en el orden del documento. Si alguien invierte el orden, el bit cae y el test falla.
        const pos = reportar.compareDocumentPosition(tarjeta!);
        expect(pos & Node.DOCUMENT_POSITION_FOLLOWING, "la tarjeta de encuesta quedó ANTES o encima de la vía de reporte").toBeTruthy();
    });

    it("sin encuesta pendiente, la tarjeta no aparece (no mendiga) y el reporte sigue presente", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ data: { pendientes: [] }, items: [] }), { status: 200 })),
        );
        render(<DashboardUsuarioClient />);
        expect(await screen.findByRole("link", { name: /reportar un riesgo/i })).toBeTruthy();
        await waitFor(() => {
            expect(screen.queryByRole("link", { name: /contar cómo me fue/i })).toBeNull();
        });
    });
});
