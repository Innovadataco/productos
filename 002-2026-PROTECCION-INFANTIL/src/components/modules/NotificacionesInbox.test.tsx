/**
 * SPEC-415 · el badge de notificaciones no puede decir «no hay» cuando lo que
 * pasó es «no pude preguntar».
 *
 * Antes, un fallo de `cargarResumen` dejaba el contador en 0 y el badge oculto:
 * indistinguible de "no tengo nada nuevo". En este producto un aviso puede ser
 * el de un caso del hijo de quien mira.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NotificacionesInbox } from "./NotificacionesInbox";

function montar(cargarResumen: () => Promise<{ noLeidas: number }>) {
    return render(
        <NotificacionesInbox
            variant="padre"
            cargarResumen={cargarResumen}
            cargarListado={async () => ({ items: [] })}
            onMarcarLeida={async () => {}}
            onMarcarTodasLeidas={async () => {}}
        />
    );
}

describe("NotificacionesInbox · SPEC-415", () => {
    it("si el resumen FALLA, el badge dice que no se pudo consultar", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        montar(async () => {
            throw new Error("red caída");
        });
        const boton = await screen.findByRole("button", {
            name: /no se pudo consultar si hay nuevas/i,
        });
        expect(boton).toBeDefined();
        // Y se ve: una marca, no el silencio de "cero".
        expect(screen.getByTitle(/No se pudo consultar/i).textContent).toBe("?");
    });

    it("cero no leídas NO se confunde con el fallo: sin marca y sin aviso", async () => {
        montar(async () => ({ noLeidas: 0 }));
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Notificaciones" })).toBeDefined();
        });
        expect(screen.queryByTitle(/No se pudo consultar/i)).toBeNull();
    });

    it("con no leídas muestra el número, como siempre", async () => {
        montar(async () => ({ noLeidas: 3 }));
        const boton = await screen.findByRole("button", { name: /3 no leídas/i });
        expect(boton).toBeDefined();
        expect(screen.getByText("3")).toBeDefined();
    });

    it("el fallo queda registrado en consola, no solo en pantalla", async () => {
        const espia = vi.spyOn(console, "error").mockImplementation(() => {});
        montar(async () => {
            throw new Error("500");
        });
        await waitFor(() => expect(espia).toHaveBeenCalled());
        expect(String(espia.mock.calls[0][0])).toContain("NotificacionesInbox");
    });
});
