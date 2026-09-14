/**
 * CANDADO · SPEC-693 (I-416) · La cola «Documentos nuevos» respeta la FORMA (§1).
 *
 * Reglas que no se pueden romper (Diseño):
 *   · dos pestañas, «Documentos nuevos» con subtítulo «De profesionales que ya están atendiendo»;
 *   · la fila dice «Reemplazó {requisito}» (nombre del PARÁMETRO) e insignia «Atendiendo»;
 *   · si la verificación vence en ≤30 días, línea ÁMBAR (nunca rubí, D-120);
 *   · nunca la palabra «renovación» (FORMA §0);
 *   · vacía, copy DISTINTA de «Cola vacía».
 *
 * Conducta con dato real: se moquea el fetch de las dos colas y se RENDERIZA. Muta por
 * remoción de cualquiera de esas piezas.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { VerificacionColasClient } from "./VerificacionColasClient";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const DIA = 86_400_000;
function okJson(obj: unknown) {
    return { ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) };
}

function stubFetch(renovaciones: unknown[]) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            const u = String(url);
            if (u.includes("/renovaciones")) return okJson({ data: renovaciones });
            return okJson({ data: [] }); // cola de solicitudes: vacía
        }),
    );
}

const RENOV_VENCE_PRONTO = {
    profesionalId: "p1",
    nombreVisible: "Ana Ruiz",
    email: "ana@x.local",
    tituloProfesional: "Psicología",
    ciudadNombre: "Bogotá",
    venceEn: new Date(Date.now() + 10 * DIA).toISOString(), // ≤30 días
    requisitos: [
        {
            clave: "tarjeta",
            nombre: "Tarjeta profesional",
            vigente: { extension: "pdf", subidoEn: new Date(Date.now() - 200 * DIA).toISOString() },
            nuevo: { extension: "pdf", subidoEn: new Date(Date.now() - 2 * DIA).toISOString() },
        },
    ],
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe("SPEC-693 · cola «Documentos nuevos» (FORMA §1)", () => {
    it("dos pestañas; la segunda con su subtítulo; el nombre es «documento nuevo», no «renovación»", async () => {
        stubFetch([RENOV_VENCE_PRONTO]);
        render(<VerificacionColasClient />);
        expect(screen.getByRole("tab", { name: /Solicitudes nuevas/i })).toBeTruthy();
        expect(screen.getByRole("tab", { name: /Documentos nuevos/i })).toBeTruthy();
        expect(screen.getByText(/De profesionales que ya están atendiendo/i)).toBeTruthy();
        await waitFor(() => expect(screen.getByText(/Reemplazó/i)).toBeTruthy());
        expect(document.body.textContent ?? "").not.toMatch(/renovaci|renovar/i);
    });

    it("la fila dice «Reemplazó {requisito}» (del parámetro) e insignia «Atendiendo»", async () => {
        stubFetch([RENOV_VENCE_PRONTO]);
        render(<VerificacionColasClient />);
        await waitFor(() => expect(screen.getByText(/Reemplazó/i)).toBeTruthy());
        expect(screen.getByText(/Tarjeta profesional/i)).toBeTruthy();
        expect(screen.getAllByText(/Atendiendo/i).length).toBeGreaterThan(0);
    });

    it("verificación que vence en ≤30 días → línea ÁMBAR, nunca rubí (D-120)", async () => {
        stubFetch([RENOV_VENCE_PRONTO]);
        render(<VerificacionColasClient />);
        const linea = await screen.findByText(/Su verificación vence el/i);
        expect(linea.className).toMatch(/ambar/);
        expect(linea.className).not.toMatch(/rubi/);
    });

    it("sin línea ámbar cuando la verificación NO vence pronto (control positivo del umbral)", async () => {
        stubFetch([{ ...RENOV_VENCE_PRONTO, venceEn: new Date(Date.now() + 200 * DIA).toISOString() }]);
        render(<VerificacionColasClient />);
        await waitFor(() => expect(screen.getByText(/Reemplazó/i)).toBeTruthy());
        expect(screen.queryByText(/Su verificación vence el/i)).toBeNull();
    });

    it("vacía: copy DISTINTA de «Cola vacía» de la otra pestaña", async () => {
        stubFetch([]);
        render(<VerificacionColasClient />);
        await waitFor(() =>
            expect(screen.getByText(/Ningún documento esperando revisión/i)).toBeTruthy(),
        );
    });
});
