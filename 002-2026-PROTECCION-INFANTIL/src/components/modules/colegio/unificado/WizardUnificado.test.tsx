import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WizardUnificado } from "./WizardUnificado";

/**
 * SPEC-146 (T005, FR-008) — WizardUnificado: render de las 3 secciones del
 * mockup §5.3, validación de fila (marca y NO guarda), guardado exitoso con
 * toast §4.8 y navegación a la vista del curso.
 */

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function fetchBase() {
    return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/colegio/profesores")) return jsonResponse({ items: [] });
        if (url.includes("/api/plataformas")) return jsonResponse({ plataformas: [] });
        if (url.includes("/api/colegio/cursos/unificado")) {
            return jsonResponse(
                { curso: { id: "curso-1", nombre: "8° B" }, resumen: { estudiantesCreados: 1, identificadoresCreados: 0, profesorCreado: false } },
                201
            );
        }
        return jsonResponse({}, 404);
    });
}

async function llenarCursoYEstudiante() {
    fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "8° B" } });
    fireEvent.change(screen.getByLabelText("Nombre del estudiante 1"), { target: { value: "María" } });
    fireEvent.change(screen.getByLabelText("Apellidos del estudiante 1"), { target: { value: "Gómez" } });
}

describe("WizardUnificado", () => {
    beforeEach(() => {
        mockPush.mockClear();
        vi.stubGlobal("fetch", fetchBase());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza las 3 secciones del mockup §5.3 con pasos y Guardar todo sticky", () => {
        render(<WizardUnificado />);
        expect(screen.getByRole("heading", { name: "Nuevo curso" })).toBeTruthy();
        expect(screen.getByRole("button", { name: /1\. Datos del curso/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /2\. Estudiantes/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /3\. Identificadores digitales/ })).toBeTruthy();
        expect(screen.getByLabelText("Progreso")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Guardar todo →" })).toBeTruthy();
        expect(screen.getByText(/Solo nombre y apellidos son obligatorios/)).toBeTruthy();
        // Terminología §3: jamás "alumno" ni "carga masiva".
        expect(document.body.textContent ?? "").not.toMatch(/alumno/i);
        expect(document.body.textContent ?? "").not.toMatch(/carga masiva/i);
    });

    it("la sección 3 viene colapsada y marcada opcional; con ?modo=excel la 2 abre el importador", () => {
        render(<WizardUnificado modoExcelInicial />);
        const seccion3 = screen.getByRole("button", { name: /3\. Identificadores digitales/ });
        expect(seccion3.getAttribute("aria-expanded")).toBe("false");
        expect(screen.getByText("opcional")).toBeTruthy();
        expect(screen.getByText("Arrastre su Excel o haga clic aquí")).toBeTruthy();
    });

    it("fila sin apellidos: la marca con mensaje humano y NO guarda (fetch jamás llamado)", async () => {
        const fetchMock = fetchBase();
        vi.stubGlobal("fetch", fetchMock);
        render(<WizardUnificado />);

        fireEvent.change(screen.getByLabelText("Nombre *"), { target: { value: "8° B" } });
        fireEvent.change(screen.getByLabelText("Nombre del estudiante 1"), { target: { value: "María" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar todo →" }));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText("Falta el apellido")).toBeTruthy();
        expect(screen.getByText(/No pudimos guardar/)).toBeTruthy();
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/colegio/cursos/unificado"))).toBe(false);
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("guardado exitoso: 1 request con el payload, toast §4.8 y navegación al curso", async () => {
        const fetchMock = fetchBase();
        vi.stubGlobal("fetch", fetchMock);
        render(<WizardUnificado />);
        await llenarCursoYEstudiante();

        fireEvent.click(screen.getByRole("button", { name: "Guardar todo →" }));

        expect(await screen.findByText("¡Listo! Curso 8° B creado con 1 estudiantes 🎉")).toBeTruthy();

        const llamada = fetchMock.mock.calls.find(([url]) => String(url) === "/api/colegio/cursos/unificado");
        expect(llamada).toBeTruthy();
        const cuerpo = JSON.parse(String((llamada![1] as unknown as RequestInit).body));
        expect(cuerpo.curso).toEqual({ nombre: "8° B" });
        expect(cuerpo.estudiantes).toEqual([{ nombre: "María", apellidos: "Gómez" }]);
        expect(cuerpo.identificadores).toEqual([]);

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/colegio/cursos/curso-1"), { timeout: 2000 });
    });

    it("error del servidor: toast ámbar con el motivo humano", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/api/colegio/profesores")) return jsonResponse({ items: [] });
            if (url.includes("/api/plataformas")) return jsonResponse({ plataformas: [] });
            return jsonResponse({ error: { message: "Ya existe un curso con ese nombre" } }, 409);
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<WizardUnificado />);
        await llenarCursoYEstudiante();

        fireEvent.click(screen.getByRole("button", { name: "Guardar todo →" }));

        expect(await screen.findByText(/No pudimos guardar\. Ya existe un curso con ese nombre/)).toBeTruthy();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
