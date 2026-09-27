/**
 * SPEC-193 Fase 4 — Tests unitarios del tab de logs.
 * Render con datos mock, aplicación de filtros, autorefresco y modal de contexto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { LogsTab } from "./LogsTab";
import type { WorkerLog, NivelLog, Prisma } from "@prisma/client";

function logMock(id: string, nivel: NivelLog, contextoJson: Prisma.JsonValue = null): WorkerLog {
    return {
        id,
        servicio: "pi-app",
        nivel,
        mensaje: `Mensaje ${id}`,
        contextoJson,
        creadoEn: new Date("2026-08-21T05:30:00.000Z"),
    };
}

function mockFetchResponse(items: WorkerLog[], total: number) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ items, total }),
    } as Response;
}

describe("LogsTab", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async () => mockFetchResponse([logMock("l1", "INFO", { key: "value" })], 1));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("renderiza la tabla con datos mock", async () => {
        render(<LogsTab />);

        await waitFor(() => expect(screen.getByText("Mensaje l1")).toBeTruthy());
        const fila = screen.getByText("Mensaje l1").closest("tr");
        expect(fila).toBeTruthy();
        expect(fila?.textContent).toContain("pi-app");
        expect(fila?.textContent).toContain("INFO");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/admin/monitoreo/logs?");
    });

    it("aplicar filtros actualiza la query", async () => {
        render(<LogsTab />);

        await waitFor(() => expect(screen.getByText("Mensaje l1")).toBeTruthy());

        fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "pi-worker" } });
        fireEvent.change(screen.getByLabelText("Nivel"), { target: { value: "ERROR" } });
        fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "timeout" } });

        fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

        await waitFor(() => {
            const calls = fetchMock.mock.calls.map((c) => String(c[0]));
            const last = calls[calls.length - 1];
            expect(last).toContain("servicio=pi-worker");
            expect(last).toContain("nivel=ERROR");
            expect(last).toContain("q=timeout");
        });
    });

    it("autorefresco toggle dispara fetch cada 30 s", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        render(<LogsTab />);

        await waitFor(() => expect(screen.getByText("Mensaje l1")).toBeTruthy());
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: /Autorefresco apagado/ }));
        expect(screen.getByRole("button", { name: /Autorefresco activo/ })).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

        fireEvent.click(screen.getByRole("button", { name: /Autorefresco activo/ }));
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("abre el modal de contexto JSON", async () => {
        render(<LogsTab />);

        await waitFor(() => expect(screen.getByText("Mensaje l1")).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { name: "Ver contexto" }));

        const dialog = await screen.findByRole("dialog", { name: "Contexto del log" });
        expect(dialog).toBeTruthy();

        fireEvent.click(within(dialog).getByRole("button", { name: /Contexto técnico \(debug\)/ }));

        const pre = within(dialog).getByText((_, el) => el?.tagName === "PRE");
        expect(pre.textContent).toContain('"key": "value"');
    });

    /**
     * SPEC-737 · CANDADO de los TRES estados del tab (copy de Diseño FORMA-SPEC737).
     * El defecto: el vacío decía «Ajusta el rango» aunque NO hubiera filtros —
     * culpaba al filtro cuando en realidad no hay WARN+ (sistema sano). Control
     * positivo en cada estado: el mensaje correcto aparece y los otros NO.
     */
    describe("SPEC-737 · estado vacío del tab (3 estados)", () => {
        it("(b) sin filtros + 0 filas: «Todo tranquilo / no está congelada», NO el de filtros", async () => {
            fetchMock.mockImplementation(async () => mockFetchResponse([], 0));
            render(<LogsTab />);

            await screen.findByText("Todo tranquilo — sin avisos ni errores");
            expect(screen.getByText(/no está congelada/i)).toBeTruthy();
            expect(screen.getByText(/Baje el nivel mínimo/i)).toBeTruthy();
            // Control positivo: NO se muestra el de filtro cuando no hay filtros.
            expect(screen.queryByText("No hay logs con estos filtros")).toBeNull();
            // Diseño (cert #700): la NOTA persistente de scope (estado c, >0) NO debe salir
            // acá — el empty-state ya lleva la explicación WARN+; nada de decirlo dos veces.
            expect(screen.queryByText(/Solo se guardan avisos y errores \(WARN\+\)/)).toBeNull();
        });

        it("(a) con filtros + 0 filas: mensaje de FILTRO, NO el de sistema-sano", async () => {
            fetchMock.mockImplementation(async () => mockFetchResponse([], 0));
            render(<LogsTab />);

            // Sin filtros arranca en el estado (b)…
            await screen.findByText("Todo tranquilo — sin avisos ni errores");
            // …y al aplicar un filtro, el mismo 0 pasa a leerse como «de filtro».
            fireEvent.change(screen.getByLabelText("Nivel"), { target: { value: "ERROR" } });
            fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

            await screen.findByText("No hay logs con estos filtros");
            expect(screen.queryByText("Todo tranquilo — sin avisos ni errores")).toBeNull();
        });

        it("(c) con tabla (>0): nota persistente WARN+ y ningún empty-state", async () => {
            render(<LogsTab />); // beforeEach devuelve 1 fila

            await screen.findByText("Mensaje l1");
            expect(screen.getByText(/Solo se guardan avisos y errores \(WARN\+\)/)).toBeTruthy();
            expect(screen.queryByText("Todo tranquilo — sin avisos ni errores")).toBeNull();
            expect(screen.queryByText("No hay logs con estos filtros")).toBeNull();
        });
    });
});
