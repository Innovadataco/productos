/**
 * CANDADO · SPEC-854 · la pantalla del operador muestra el MENSAJE REAL del error al publicar el enlace,
 * no «[object Object]». El endpoint serializa AppError como `{error:{message,code}}` (errors.ts toJSON);
 * pintar `error` (un OBJETO) daba «[object Object]». Control positivo: un 400 con razón → se ve el texto.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SesionesOperadorClient } from "./SesionesOperadorClient";
import type { CalendarioOperadorDto } from "@/lib/operadores/calendario-operador.service";

const datos: CalendarioOperadorDto = {
    hoy: "2026-10-01",
    bloques: [
        {
            citaId: "cita-1",
            citaRef: "cita-1ab",
            fecha: "2026-10-02",
            minInicio: 600,
            minFin: 650,
            inicioISO: "2026-10-02T15:00:00.000Z",
            finISO: "2026-10-02T15:50:00.000Z",
            modalidad: "VIRTUAL",
            profesionalNombre: "Dra. Prueba",
            enlaceEstado: "sin-enlace",
            enlaceReunion: null,
        },
    ],
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SPEC-854 · el operador ve el mensaje real, no [object Object]", () => {
    it("un 400 con {error:{message}} pinta el texto, no «[object Object]»", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({ error: { message: "El enlace debe empezar con https://", code: "VALIDATION_ERROR" } }),
                { status: 400 },
            ),
        );

        render(<SesionesOperadorClient datos={datos} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "http://no-https.example/x" } });
        fireEvent.click(screen.getByRole("button", { name: /Publicar enlace/i }));

        expect(await screen.findByText("El enlace debe empezar con https://")).toBeTruthy();
        expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    });
});
