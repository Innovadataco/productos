import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportExcel } from "./ImportExcel";

/**
 * SPEC-146 (T005, FR-008) — ImportExcel: dropzone → dry-run → vista previa §5.4
 * ("N estudiantes listos", "M filas con problemas" con motivo) y "Guardar solo
 * los N correctos" (el archivo nunca se rechaza entero).
 */

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const RESULTADO_DRY_RUN = {
    filasValidas: [
        { fila: 2, estudiante: { nombre: "María", apellidos: "Gómez" }, acudiente: null, identificador: { tipo: "telefono", valor: "+573001234567", etiquetaRelacion: "ESTUDIANTE", plataformaId: null } },
        { fila: 3, estudiante: { nombre: "Carlos", apellidos: "Ruiz" }, acudiente: null, identificador: null },
        { fila: 4, estudiante: { nombre: "Ana", apellidos: "Torres" }, acudiente: null, identificador: null },
        { fila: 5, estudiante: { nombre: "Luis", apellidos: "Pérez" }, acudiente: null, identificador: null },
    ],
    problemas: [{ fila: 6, campos: ["apellidos_alumno"], mensaje: "Falta el apellido del estudiante" }],
    resumen: { estudiantes: 4, identificadores: 1, conProblemas: 1, total: 5 },
};

async function subirArchivo(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]')!;
    const archivo = new File(["contenido"], "lista.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [archivo] } });
    await waitFor(() => expect(screen.getByText(/Vista previa/)).toBeTruthy());
}

describe("ImportExcel", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza el dropzone y el enlace de plantilla", () => {
        render(<ImportExcel onAceptar={() => undefined} />);
        expect(screen.getByText("Arrastra tu Excel o haz click aquí")).toBeTruthy();
        const plantilla = screen.getByRole("link", { name: "Descargar plantilla Excel" });
        expect(plantilla.getAttribute("href")).toBe("/api/colegio/cursos/unificado/plantilla");
    });

    it("vista previa §5.4: N listos, M con problemas (motivo por fila) y 'Guardar solo los N correctos'", async () => {
        const onAceptar = vi.fn();
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(RESULTADO_DRY_RUN));
        vi.stubGlobal("fetch", fetchMock);
        const { container } = render(<ImportExcel onAceptar={onAceptar} />);

        await subirArchivo(container);

        expect(screen.getByText("✓ 4 estudiantes listos para crear")).toBeTruthy();
        expect(screen.getByText("⚠ 1 filas con problemas:")).toBeTruthy();
        expect(screen.getByText(/Fila 6 — Falta el apellido del estudiante/)).toBeTruthy();

        // El dry-run fue multipart con el archivo, sin persistir nada.
        const llamada = fetchMock.mock.calls[0];
        expect(String(llamada[0])).toBe("/api/colegio/cursos/unificado/validar");
        expect((llamada[1] as unknown as RequestInit).body).toBeInstanceOf(FormData);

        fireEvent.click(screen.getByRole("button", { name: "Guardar solo los 4 correctos" }));
        expect(onAceptar).toHaveBeenCalledWith(RESULTADO_DRY_RUN.filasValidas);
    });

    it("'Corregir en Excel y reintentar' vuelve al dropzone sin guardar nada", async () => {
        const onAceptar = vi.fn();
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(RESULTADO_DRY_RUN)));
        const { container } = render(<ImportExcel onAceptar={onAceptar} />);
        await subirArchivo(container);

        fireEvent.click(screen.getByRole("button", { name: "Corregir en Excel y reintentar" }));
        expect(screen.getByText("Arrastra tu Excel o haz click aquí")).toBeTruthy();
        expect(onAceptar).not.toHaveBeenCalled();
    });

    it("error del servidor (archivo ilegible): mensaje humano, sin vista previa", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => jsonResponse({ error: { message: "Columna requerida faltante: grado" } }, 400))
        );
        const { container } = render(<ImportExcel onAceptar={() => undefined} />);
        const input = container.querySelector('input[type="file"]')!;
        fireEvent.change(input, { target: { files: [new File(["x"], "lista.csv", { type: "text/csv" })] } });

        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
        expect(screen.getByText(/Columna requerida faltante/)).toBeTruthy();
        expect(screen.queryByText(/Vista previa/)).toBeNull();
    });
});
