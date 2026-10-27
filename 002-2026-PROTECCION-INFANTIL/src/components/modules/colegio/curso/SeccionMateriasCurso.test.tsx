/**
 * SPEC-379 (D3 · candado UI) — "toda materia con profesor, sin excepción".
 * Antes el label decía "(opcional)" y ofrecía "Sin profesor asignado"; el
 * rector solo se enteraba con el 400 al guardar. Este test afirma:
 *   1. El label ya no dice "opcional".
 *   2. NO existe la opción "Sin profesor asignado".
 *   3. El botón "Asignar" está DESHABILITADO hasta elegir materia + profesor.
 *   4. Con materia sin profesor se muestra el hint accionable.
 *
 * El candado del SERVIDOR (SPEC-344) sigue: este test no lo reemplaza.
 */
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SeccionMateriasCurso from "./SeccionMateriasCurso";

const MATERIAS_MOCK = [
    { id: "m1", nombre: "Matemáticas", estado: "activo" },
    { id: "m2", nombre: "Lengua", estado: "activo" },
];

const PROFESORES_MOCK = {
    items: [
        { id: "p1", nombre: "Ana", apellidos: "Ruiz", estado: "activo" },
    ],
};

const VINCULOS_MOCK: unknown[] = [];

function mockFetch() {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (typeof url !== "string") return Promise.reject(new Error("URL inesperada"));
        if (url.startsWith("/api/colegio/materias")) {
            return Promise.resolve({ ok: true, json: async () => ({ materias: MATERIAS_MOCK }) });
        }
        if (url.startsWith("/api/colegio/profesores")) {
            return Promise.resolve({ ok: true, json: async () => PROFESORES_MOCK });
        }
        if (url.includes("/materias") && (url.match(/cursos\/[^/]+\/materias/) || url.includes("materias"))) {
            return Promise.resolve({ ok: true, json: async () => ({ items: VINCULOS_MOCK }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("SeccionMateriasCurso — SPEC-379 D3 (candado UI)", () => {
    beforeEach(() => { mockFetch(); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it("el label del profesor ya no dice '(opcional)'", async () => {
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        // El Select del profesor se busca por su label; no debe traer "(opcional)".
        await waitFor(() => expect(screen.getByText(/^Profesor a cargo$/)).toBeDefined());
        expect(screen.queryByText(/opcional/i)).toBeNull();
    });

    it("NO ofrece 'Sin profesor asignado' como opción del select", async () => {
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        await waitFor(() => expect(screen.getByText(/^Profesor a cargo$/)).toBeDefined());
        // No hay opción con esa etiqueta.
        expect(screen.queryByText(/Sin profesor asignado/i)).toBeNull();
    });

    it("el botón Asignar arranca DESHABILITADO y sigue así con solo la materia", async () => {
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        await waitFor(() => expect(screen.getByText("Matemáticas")).toBeDefined());

        const boton = screen.getByRole("button", { name: /^asignar$/i }) as HTMLButtonElement;
        expect(boton.disabled, "sin nada elegido, no se puede asignar").toBe(true);

        // Elegir materia SIN profesor: sigue deshabilitado y aparece el hint.
        const materiaSelect = screen.getByRole("combobox", { name: /^Materia$/i }) as HTMLSelectElement;
        fireEvent.change(materiaSelect, { target: { value: "m1" } });

        await waitFor(() => {
            expect(boton.disabled, "materia sí, profesor no → todavía no").toBe(true);
        });
        expect(screen.getByText(/Toda materia debe llevar un profesor/i)).toBeDefined();
    });

    it("al elegir materia + profesor, el botón se HABILITA y el hint desaparece", async () => {
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        await waitFor(() => expect(screen.getByText("Matemáticas")).toBeDefined());

        const boton = screen.getByRole("button", { name: /^asignar$/i }) as HTMLButtonElement;
        const materiaSelect = screen.getByRole("combobox", { name: /^Materia$/i }) as HTMLSelectElement;
        const profesorSelect = screen.getByRole("combobox", { name: /^Profesor a cargo$/i }) as HTMLSelectElement;

        fireEvent.change(materiaSelect, { target: { value: "m1" } });
        fireEvent.change(profesorSelect, { target: { value: "p1" } });

        await waitFor(() => expect(boton.disabled).toBe(false));
        expect(screen.queryByText(/Toda materia debe llevar un profesor/i)).toBeNull();
    });

    it("sin profesores en el colegio, la opción vacía guía al rector a crear uno primero", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation((url: string) => {
                if (url.startsWith("/api/colegio/materias")) return Promise.resolve({ ok: true, json: async () => ({ materias: MATERIAS_MOCK }) });
                if (url.startsWith("/api/colegio/profesores")) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
                return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
            })
        );
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        await waitFor(() => expect(screen.getByText(/Primero cree un profesor/i)).toBeDefined());
    });
});

/**
 * SPEC-914 (CANDADO que muere con el defecto): crear materia NUEVA desde el detalle
 * del curso. Antes solo se podía asignar del catálogo; sin materias el selector decía
 * «Sin materias disponibles» y no había cómo crearla. El modal debe rendir input +
 * «Crear materia», postear a POST /api/colegio/materias, refrescar el catálogo y
 * preseleccionar la nueva; y mostrar el error del 409 (nombre duplicado).
 */
describe("SeccionMateriasCurso — SPEC-914 (crear materia nueva)", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    /** Mock stateful: el catálogo crece al postear; GET refleja el estado vivo. */
    function mockCrear(opts?: { postResponse?: { ok: boolean; status?: number; body: unknown } }) {
        let catalogo = [...MATERIAS_MOCK];
        const fetchMock = vi.fn().mockImplementation((url: string, init?: { method?: string }) => {
            if (url.startsWith("/api/colegio/materias")) {
                if (init?.method === "POST") {
                    const resp = opts?.postResponse ?? { ok: true, status: 201, body: { materia: { id: "m3", nombre: "Física" } } };
                    if (resp.ok) catalogo = [...catalogo, { id: "m3", nombre: "Física", estado: "activo" }];
                    return Promise.resolve({ ok: resp.ok, status: resp.status ?? 201, json: async () => resp.body });
                }
                return Promise.resolve({ ok: true, json: async () => ({ materias: catalogo }) });
            }
            if (url.startsWith("/api/colegio/profesores")) {
                return Promise.resolve({ ok: true, json: async () => PROFESORES_MOCK });
            }
            return Promise.resolve({ ok: true, json: async () => ({ materias: [] }) });
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    it("rinde el input de materia nueva y el botón «Crear materia»", async () => {
        mockCrear();
        render(<SeccionMateriasCurso cursoId="c1" onAviso={() => {}} />);
        await waitFor(() => expect(screen.getByText("Matemáticas")).toBeDefined());
        expect(screen.getByLabelText(/Cree una materia nueva/i)).toBeDefined();
        expect(screen.getByRole("button", { name: /^crear materia$/i })).toBeDefined();
    });

    it("al crear: postea a /api/colegio/materias, refresca el catálogo y preselecciona la nueva", async () => {
        const fetchMock = mockCrear();
        const onAviso = vi.fn();
        render(<SeccionMateriasCurso cursoId="c1" onAviso={onAviso} />);
        await waitFor(() => expect(screen.getByText("Matemáticas")).toBeDefined());

        fireEvent.change(screen.getByLabelText(/Cree una materia nueva/i), { target: { value: "Física" } });
        fireEvent.click(screen.getByRole("button", { name: /^crear materia$/i }));

        // POST con el nombre al endpoint del catálogo.
        await waitFor(() => {
            const post = fetchMock.mock.calls.find((c) => c[0] === "/api/colegio/materias" && c[1]?.method === "POST");
            expect(post, "debe postear a /api/colegio/materias").toBeTruthy();
            expect(JSON.parse(post![1].body)).toEqual({ nombre: "Física" });
        });
        // Refresca el catálogo (otra GET a materias) y preselecciona la nueva en el dropdown.
        await waitFor(() => {
            const materiaSelect = screen.getByRole("combobox", { name: /^Materia$/i }) as HTMLSelectElement;
            expect(materiaSelect.value).toBe("m3");
        });
        expect(onAviso).toHaveBeenCalledWith(expect.stringMatching(/creada/i), "exito");
    });

    it("maneja el 409 (nombre duplicado): avisa con el mensaje del endpoint y no preselecciona", async () => {
        mockCrear({ postResponse: { ok: false, status: 409, body: { error: { message: "Ya existe una materia con ese nombre" } } } });
        const onAviso = vi.fn();
        render(<SeccionMateriasCurso cursoId="c1" onAviso={onAviso} />);
        await waitFor(() => expect(screen.getByText("Matemáticas")).toBeDefined());

        fireEvent.change(screen.getByLabelText(/Cree una materia nueva/i), { target: { value: "Matemáticas" } });
        fireEvent.click(screen.getByRole("button", { name: /^crear materia$/i }));

        await waitFor(() => expect(onAviso).toHaveBeenCalledWith("Ya existe una materia con ese nombre", "error"));
        const materiaSelect = screen.getByRole("combobox", { name: /^Materia$/i }) as HTMLSelectElement;
        expect(materiaSelect.value).toBe("");
    });
});
