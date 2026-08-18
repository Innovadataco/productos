/**
 * SPEC-173 (T008, H01/H06) — Bandeja de alertas del rector: exactamente 3
 * acciones por tarjeta (Revisar / Resolver aquí / Escalar al Comité), sin
 * Asignar/Cerrar; la barra batch solo ofrece "Revisar en lote"; los chips de
 * estado llevan tooltip en criollo; el modal de escalamiento envía el motivo
 * en el body JSON (bug original: POST sin body contra escalarAlertaSchema →
 * siempre 400).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AlertasColegioPageClient from "./AlertasColegioPageClient";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

function alertaBase(id: string, estadoAlerta: string) {
    return {
        id,
        tipoSujeto: "ESTUDIANTE",
        identificador: "+573001112233",
        relacion: "Estudiante de 8A",
        sujetoNombre: `Sujeto ${id}`,
        categoria: "Acoso",
        estadoReporte: "CLASIFICADO",
        estadoAlerta,
        prioridad: "alta",
        vencimientoSla: new Date(Date.now() + 86400000).toISOString(),
        asignadoA: null,
        creadoEn: new Date().toISOString(),
    };
}

const ITEMS = [
    alertaBase("alerta-nueva-1", "nueva"),
    alertaBase("alerta-vista-2", "vista"),
    alertaBase("alerta-gestionada-3", "gestionada"),
];

function mockFetch(items = ITEMS) {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST" && String(url).includes("/escalar")) {
            return { ok: true, status: 201, json: async () => ({ alerta: { id: "x", estado: "escalada" } }) };
        }
        if (init?.method === "POST" || init?.method === "PATCH") {
            return { ok: true, status: 200, json: async () => ({ alerta: { id: "x", estado: "vista" } }) };
        }
        return { ok: true, status: 200, json: async () => ({ items, total: items.length }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AlertasColegioPageClient", () => {
    it("muestra exactamente las 3 acciones por tarjeta según estado (nueva: Revisar + Resolver + Escalar)", async () => {
        mockFetch();
        render(<AlertasColegioPageClient />);
        await screen.findByText("Sujeto alerta-nueva-1");

        // Solo la tarjeta "nueva" tiene Revisar; Resolver/Escalar en nueva y vista.
        expect(screen.getAllByRole("button", { name: "Revisar" })).toHaveLength(1);
        expect(screen.getAllByRole("button", { name: "Resolver aquí" })).toHaveLength(2);
        expect(screen.getAllByRole("button", { name: "Escalar al Comité" })).toHaveLength(2);

        // Acciones retiradas de la superficie del rector.
        for (const nombre of ["Asignar", "Reasignar", "Desasignar", "Cerrar", "Marcar vista", "Marcar gestionada"]) {
            expect(screen.queryByRole("button", { name: nombre })).toBeNull();
        }
    });

    it("la barra batch solo ofrece 'Revisar en lote' y hace POST {ids, accion:'vista'}", async () => {
        const fetchMock = mockFetch();
        render(<AlertasColegioPageClient />);
        await screen.findByText("Sujeto alerta-nueva-1");

        fireEvent.click(screen.getByLabelText("Seleccionar alerta alerta-nueva-1"));
        fireEvent.click(screen.getByLabelText("Seleccionar alerta alerta-vista-2"));

        const barra = screen.getByText("2 seleccionadas").closest("div[class*='glass']")!;
        expect(within(barra as HTMLElement).getByRole("button", { name: "Revisar en lote" })).toBeTruthy();
        expect(within(barra as HTMLElement).getAllByRole("button")).toHaveLength(1);
        for (const nombre of ["Escalar", "Cerrar", "Asignar", "Desasignar", "Marcar gestionada"]) {
            expect(within(barra as HTMLElement).queryByRole("button", { name: nombre })).toBeNull();
        }

        fireEvent.click(within(barra as HTMLElement).getByRole("button", { name: "Revisar en lote" }));
        await waitFor(() => {
            const post = fetchMock.mock.calls.find(
                (c) => c[1]?.method === "POST" && String(c[0]).endsWith("/api/colegio/alertas")
            );
            expect(post).toBeTruthy();
            expect(JSON.parse(String(post![1]!.body))).toEqual({
                ids: ["alerta-nueva-1", "alerta-vista-2"],
                accion: "vista",
            });
        });
    });

    it("los chips de estado llevan tooltip en criollo", async () => {
        mockFetch();
        render(<AlertasColegioPageClient />);
        await screen.findByText("Sujeto alerta-nueva-1");

        expect(screen.getByTitle("Recién llegada, nadie la ha revisado")).toBeTruthy();
        expect(screen.getByTitle("Ya la vi, pendiente de actuar")).toBeTruthy();
        expect(screen.getByTitle("La resolví yo en el colegio, sin comité")).toBeTruthy();
    });

    it("Escalar al Comité abre modal y envía el motivo en el body JSON", async () => {
        const fetchMock = mockFetch();
        render(<AlertasColegioPageClient />);
        await screen.findByText("Sujeto alerta-nueva-1");

        fireEvent.click(screen.getAllByRole("button", { name: "Escalar al Comité" })[0]!);
        const dialog = await screen.findByRole("dialog");

        // Sin motivo no se puede enviar.
        expect(
            (within(dialog).getByRole("button", { name: "Escalar al Comité" }) as HTMLButtonElement).disabled
        ).toBe(true);

        fireEvent.change(within(dialog).getByLabelText("Motivo del escalamiento"), {
            target: { value: "  Acumula tres reportes de acoso  " },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Escalar al Comité" }));

        await waitFor(() => {
            const post = fetchMock.mock.calls.find((c) => String(c[0]).includes("/escalar"));
            expect(post).toBeTruthy();
            expect(post![1]!.method).toBe("POST");
            // El motivo viaja recortado (trim) en el body.
            expect(JSON.parse(String(post![1]!.body))).toEqual({ motivo: "Acumula tres reportes de acoso" });
        });
    });
});
