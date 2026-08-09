import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TablaEstudiantes } from "./TablaEstudiantes";
import { estudianteVacio, type EstudianteForm, type ModoEstudiantes } from "./tipos";

/**
 * SPEC-146 (T005, FR-008) — TablaEstudiantes: filas editables inline, acudientes
 * máx 2, quitar/agregar filas y la nota §7.1 (solo nombre y apellidos bloquean).
 */

function Harness({ inicial = [estudianteVacio("est-1")], errores = {} }: { inicial?: EstudianteForm[]; errores?: Record<string, string> }) {
    const [estudiantes, setEstudiantes] = useState(inicial);
    const [modo, setModo] = useState<ModoEstudiantes>("manual");
    const contador = React.useRef(100);
    return (
        <TablaEstudiantes
            estudiantes={estudiantes}
            onChange={setEstudiantes}
            errores={errores}
            modo={modo}
            onModoChange={setModo}
            onImportar={() => undefined}
            nuevaClave={() => `est-${++contador.current}`}
        />
    );
}

describe("TablaEstudiantes", () => {
    it("renderiza la fila editable con la nota §7.1", () => {
        render(<Harness />);
        expect(screen.getByLabelText("Nombre del estudiante 1")).toBeTruthy();
        expect(screen.getByLabelText("Apellidos del estudiante 1")).toBeTruthy();
        expect(screen.getByText(/Solo nombre y apellidos son obligatorios/)).toBeTruthy();
    });

    it("agrega otra fila con '+ Agregar otro estudiante'", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar otro estudiante" }));
        expect(screen.getByLabelText("Nombre del estudiante 2")).toBeTruthy();
    });

    it("acudientes: máximo 2 por estudiante (el botón desaparece al llegar a 2)", () => {
        render(<Harness />);
        const boton = () => screen.queryByRole("button", { name: "+ Agregar acudiente" });
        expect(boton()).toBeTruthy();
        fireEvent.click(boton()!);
        expect(screen.getByLabelText("Nombre del acudiente 1 del estudiante 1")).toBeTruthy();
        fireEvent.click(boton()!);
        expect(screen.getByLabelText("Nombre del acudiente 2 del estudiante 1")).toBeTruthy();
        expect(boton()).toBeNull();
    });

    it("quita un acudiente y vuelve a ofrecer agregarlo", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar acudiente" }));
        fireEvent.click(screen.getByRole("button", { name: "Quitar acudiente" }));
        expect(screen.queryByLabelText("Nombre del acudiente 1 del estudiante 1")).toBeNull();
        expect(screen.getByRole("button", { name: "+ Agregar acudiente" })).toBeTruthy();
    });

    it("quita una fila de estudiante", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Quitar estudiante 1" }));
        expect(screen.queryByLabelText("Nombre del estudiante 1")).toBeNull();
    });

    it("marca la fila con error (rol alert)", () => {
        render(<Harness errores={{ "est-1": "Falta el apellido" }} />);
        expect(screen.getByRole("alert").textContent).toBe("Falta el apellido");
    });

    it("edita los campos de la fila", () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText("Nombre del estudiante 1"), { target: { value: "María" } });
        expect((screen.getByLabelText("Nombre del estudiante 1") as HTMLInputElement).value).toBe("María");
    });
});
