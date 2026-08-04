import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeccionCurso } from "./SeccionCurso";
import type { CursoForm, ProfesorNuevoForm } from "./tipos";

/**
 * SPEC-146 (T005) — SeccionCurso: datos del curso + profesor titular existente
 * (selector same-tenant) o nuevo inline ("+ Nuevo" — FR-007).
 */

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function Harness() {
    const [curso, setCurso] = useState<CursoForm>({ nombre: "", grado: "", anioLectivo: "", profesorTitularId: "" });
    const [modo, setModo] = useState<"existente" | "nuevo">("existente");
    const [profesorNuevo, setProfesorNuevo] = useState<ProfesorNuevoForm>({ nombre: "", apellidos: "" });
    return (
        <SeccionCurso
            curso={curso}
            onCursoChange={setCurso}
            modoProfesor={modo}
            onModoProfesorChange={setModo}
            profesorNuevo={profesorNuevo}
            onProfesorNuevoChange={setProfesorNuevo}
        />
    );
}

describe("SeccionCurso", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza nombre, grado, año y el selector de profesor con los existentes", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => jsonResponse({ items: [{ id: "prof-1", nombre: "María", apellidos: "López" }] }))
        );
        render(<Harness />);
        expect(screen.getByLabelText("Nombre *")).toBeTruthy();
        expect(screen.getByLabelText("Grado")).toBeTruthy();
        expect(screen.getByLabelText("Año lectivo")).toBeTruthy();

        await waitFor(() => expect(screen.getByRole("option", { name: "María López" })).toBeTruthy());
        fireEvent.change(screen.getByLabelText("Profesor titular"), { target: { value: "prof-1" } });
        expect((screen.getByLabelText("Profesor titular") as HTMLSelectElement).value).toBe("prof-1");
    });

    it("'+ Nuevo' muestra el alta inline y se puede volver a la lista", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [] })));
        render(<Harness />);

        fireEvent.click(screen.getByRole("button", { name: "+ Nuevo" }));
        expect(screen.getByLabelText("Nombre del profesor")).toBeTruthy();
        expect(screen.getByLabelText("Apellidos del profesor")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Nombre del profesor"), { target: { value: "Ana" } });
        expect((screen.getByLabelText("Nombre del profesor") as HTMLInputElement).value).toBe("Ana");

        fireEvent.click(screen.getByRole("button", { name: "← Elegir de la lista" }));
        expect(screen.queryByLabelText("Nombre del profesor")).toBeNull();
    });

    it("muestra el error del nombre cuando existe", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [] })));
        render(
            <SeccionCurso
                curso={{ nombre: "", grado: "", anioLectivo: "", profesorTitularId: "" }}
                onCursoChange={() => undefined}
                modoProfesor="existente"
                onModoProfesorChange={() => undefined}
                profesorNuevo={{ nombre: "", apellidos: "" }}
                onProfesorNuevoChange={() => undefined}
                errorNombre="Escribe el nombre del curso"
            />
        );
        expect(screen.getByText("Escribe el nombre del curso")).toBeTruthy();
    });
});
