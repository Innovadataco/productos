/**
 * SPEC-196 (T008): priorización de array `identificadores` sobre campo único `identificador`
 * en el simulador anti-abuso.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminAntiAbusoSimulador } from "./AdminAntiAbusoSimulador";

function mockFetch(capturarPost?: (body: Record<string, unknown>) => void) {
    return vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        if (url === "/api/plataformas") {
            return {
                ok: true,
                status: 200,
                json: async () => ({ plataformas: [{ clave: "whatsapp", nombre: "WhatsApp" }] }),
            } as Response;
        }
        if (url.includes("/api/admin/anti-abuso/simular/sugerencias")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    sugerencias: {
                        escenario: "robot_inundando",
                        n: 50,
                        descripcion: "Sugerencia de prueba",
                        plataforma: "whatsapp",
                    },
                }),
            } as Response;
        }
        if (url === "/api/admin/anti-abuso/simular" && init && (init as RequestInit).method === "POST") {
            const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
            capturarPost?.(body);
            return {
                ok: true,
                status: 201,
                json: async () => ({ runId: "run-abc123" }),
            } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
    });
}

describe("AdminAntiAbusoSimulador (SPEC-196 T008)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("prioriza el array de identificadores sobre el campo único al iniciar", async () => {
        let body: Record<string, unknown> | undefined;
        mockFetch((b) => {
            body = b;
        });

        render(<AdminAntiAbusoSimulador />);

        fireEvent.change(screen.getByLabelText("Identificador objetivo"), {
            target: { value: "objetivo-unico" },
        });
        fireEvent.change(screen.getByLabelText("Identificadores (array separado por coma)"), {
            target: { value: "id-uno, id-dos" },
        });

        fireEvent.click(screen.getByRole("button", { name: /Iniciar simulación/i }));

        await waitFor(() => {
            expect(body).toBeDefined();
        });

        expect(body).toHaveProperty("identificadores", ["id-uno", "id-dos"]);
        expect(body).not.toHaveProperty("identificador");
    });
});
