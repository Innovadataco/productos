/**
 * SPEC-541 (P2) · el input de fecha de nacimiento del perfil acota la edad a 18–100
 * años (Calidad: antes no tenía min/max y guardaba 1900 o fechas futuras). Es «el caso
 * amable»; la defensa real es el servidor (fecha-nacimiento-padre.candado.test.ts).
 * Muere si se quitan min/max del input.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerfilPadreForm } from "./PerfilPadreForm";
import { EDAD_MIN_PADRE, EDAD_MAX_PADRE } from "@/lib/padre/fecha-nacimiento-padre";

function stubFetch() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            if (String(url).startsWith("/api/padre/perfil")) {
                return {
                    ok: true,
                    json: async () => ({
                        perfil: {
                            nombre: "Juan", apellidos: "Pérez", documentoTipo: "CC", documentoNumero: "123",
                            fechaNacimiento: "1990-05-15", telefono: null, paisId: null, ciudadId: null,
                            paisPerfil: null, ciudadPerfil: null,
                        },
                    }),
                };
            }
            if (String(url).startsWith("/api/paises")) return { ok: true, json: async () => ({ paises: [] }) };
            return { ok: true, json: async () => ({}) };
        })
    );
}

function haceAnios(n: number): string {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getUTCFullYear() - n, hoy.getUTCMonth(), hoy.getUTCDate())).toISOString().slice(0, 10);
}

describe("SPEC-541 · el input de fecha de nacimiento del perfil acota 18–100 años", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("pone max = 18 años atrás y min = 100 años atrás", async () => {
        stubFetch();
        render(<PerfilPadreForm />);
        const input = await screen.findByLabelText("Fecha de nacimiento");
        expect(input.getAttribute("max")).toBe(haceAnios(EDAD_MIN_PADRE));
        expect(input.getAttribute("min")).toBe(haceAnios(EDAD_MAX_PADRE));
    });
});
