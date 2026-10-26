/**
 * SPEC-912 · CANDADO UI — «Editar» de la cuenta del comité postea el email NUEVO.
 *
 * El defecto: la tarjeta solo creaba/reenviaba; no había forma de cambiar el email del
 * registro. Este candado muere con el defecto: si no hay «Editar», o no revela el input
 * pre-cargado, o «Guardar» no hace PATCH con el email nuevo, el test cae.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ComiteCuentaCard } from "./ComiteCuentaCard";

const CUENTA = {
    id: "c1",
    email: "viejo@colegio.test",
    estado: "activo",
    debeCambiarPassword: false,
    ultimaSesion: null,
    creadoEn: new Date("2026-01-01").toISOString(),
};

describe("SPEC-912 · ComiteCuentaCard editar email", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("«Editar» revela el input pre-cargado y «Guardar» hace PATCH con el email nuevo", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ cuenta: { ...CUENTA, email: "nuevo@colegio.test" }, invitacionEnviada: false }),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<ComiteCuentaCard cuenta={CUENTA} />);

        // Sin editar: no hay input de email a la vista.
        expect(screen.queryByLabelText(/Email institucional/i)).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /^Editar$/i }));

        const input = screen.getByLabelText(/Email institucional/i) as HTMLInputElement;
        expect(input.value).toBe("viejo@colegio.test"); // pre-cargado con el email actual

        fireEvent.change(input, { target: { value: "nuevo@colegio.test" } });
        fireEvent.click(screen.getByRole("button", { name: /^Guardar$/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/colegio/comite/cuenta");
        expect(opts.method).toBe("PATCH");
        expect(JSON.parse(String(opts.body))).toEqual({ email: "nuevo@colegio.test" });

        // La tarjeta se refresca con el email nuevo devuelto por el server.
        await waitFor(() => expect(screen.queryByText("nuevo@colegio.test")).not.toBeNull());
    });
});
