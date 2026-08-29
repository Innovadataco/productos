/**
 * SPEC-222 (002-PI-123): tests unitarios del bloque "Tu top 5 hoy".
 * Sin base de datos: el componente recibe props y emite callbacks.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TopDecisiones } from "./TopDecisiones";
import type { TopDecision } from "./tipos";

function decision(overrides: Partial<TopDecision> = {}): TopDecision {
    return {
        id: "rec-1",
        titulo: "Llamar al Colegio San José",
        descripcion: "Suscripción colegio vence en 6 días",
        categoria: "renovacion",
        prioridad: 85,
        generadaEn: "2026-08-24T08:00:00.000Z",
        expiraEn: "2026-08-31T04:59:59.000Z",
        sujetoTipo: "Suscripcion",
        sujetoId: "sus-1",
        accionSugerida: "llamar",
        contacto: { telefono: "+573001112233", email: "rector@test.co" },
        ...overrides,
    };
}

describe("TopDecisiones", () => {
    it("renderiza las cards con título, descripción y categoría", () => {
        render(
            <TopDecisiones
                bloque={{ data: [decision(), decision({ id: "rec-2", titulo: "Segunda", prioridad: 50 })], cargando: false, error: null }}
                onResolver={vi.fn().mockResolvedValue(undefined)}
            />
        );
        expect(screen.getByText("Llamar al Colegio San José")).toBeTruthy();
        expect(screen.getAllByText("Suscripción colegio vence en 6 días")).toHaveLength(2);
        expect(screen.getAllByText("renovacion")).toHaveLength(2);
        expect(screen.getByText("Segunda")).toBeTruthy();
    });

    it("estado vacío neutral sin recomendaciones", () => {
        render(<TopDecisiones bloque={{ data: [], cargando: false, error: null }} onResolver={vi.fn()} />);
        expect(screen.getByText("Sin decisiones pendientes hoy.")).toBeTruthy();
    });

    it("muestra enlaces tel:/mailto: cuando hay contacto y los oculta sin él", () => {
        const { rerender } = render(
            <TopDecisiones bloque={{ data: [decision()], cargando: false, error: null }} onResolver={vi.fn()} />
        );
        expect(screen.getByText("Llamar").closest("a")?.getAttribute("href")).toBe("tel:+573001112233");
        expect(screen.getByText("Escribir").closest("a")?.getAttribute("href")).toBe("mailto:rector@test.co");

        rerender(
            <TopDecisiones
                bloque={{ data: [decision({ contacto: null })], cargando: false, error: null }}
                onResolver={vi.fn()}
            />
        );
        expect(screen.queryByText("Llamar")).toBeNull();
        expect(screen.queryByText("Escribir")).toBeNull();
    });

    it("'Marcar como aplicada' llama onResolver con APLICADA", async () => {
        const onResolver = vi.fn().mockResolvedValue(undefined);
        render(<TopDecisiones bloque={{ data: [decision()], cargando: false, error: null }} onResolver={onResolver} />);

        fireEvent.click(screen.getByText("Marcar como aplicada"));
        await waitFor(() => expect(onResolver).toHaveBeenCalledWith("rec-1", "APLICADA"));
    });

    it("'Ignorar' llama onResolver con IGNORADA", async () => {
        const onResolver = vi.fn().mockResolvedValue(undefined);
        render(<TopDecisiones bloque={{ data: [decision()], cargando: false, error: null }} onResolver={onResolver} />);

        fireEvent.click(screen.getByText("Ignorar"));
        await waitFor(() => expect(onResolver).toHaveBeenCalledWith("rec-1", "IGNORADA"));
    });

    it("muestra el estado de carga y el error sin romper", () => {
        const { rerender } = render(
            <TopDecisiones bloque={{ data: null, cargando: true, error: null }} onResolver={vi.fn()} />
        );
        expect(screen.getByText("Cargando decisiones...")).toBeTruthy();

        rerender(<TopDecisiones bloque={{ data: null, cargando: false, error: "fallo" }} onResolver={vi.fn()} />);
        expect(screen.getByText(/fallo/)).toBeTruthy();
    });
});
