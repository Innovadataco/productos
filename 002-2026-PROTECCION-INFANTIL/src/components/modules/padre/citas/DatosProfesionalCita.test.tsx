/**
 * SPEC-940 · (d) bloque «Datos del profesional» — copy de Diseño (FORMA 169bd6fc) + gating.
 * El QUÉ (solo exponible) lo amarra el candado del DTO; acá: render del copy, teléfono opcional, dirección única.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DatosProfesionalCita } from "./DatosProfesionalCita";

afterEach(cleanup);

describe("SPEC-940 · DatosProfesionalCita (d)", () => {
    it("muestra correo (siempre) + teléfono (si viene) + el marcador al padre", () => {
        render(<DatosProfesionalCita contacto={{ email: "pro@x.co", telefono: "+573001112233" }} nombreVisible="Dra. Ana" />);
        const bloque = screen.getByTestId("datos-del-profesional");
        expect(bloque.textContent).toContain("Correo: pro@x.co");
        expect(bloque.textContent).toContain("Teléfono: +573001112233");
        expect(bloque.textContent).toMatch(/ahora tienes los datos de Dra\. Ana/);
        expect(bloque.textContent).toMatch(/cobró solo la primera/);
    });

    it("omite la línea de teléfono cuando es null", () => {
        render(<DatosProfesionalCita contacto={{ email: "pro@x.co", telefono: null }} nombreVisible="Dra. Ana" />);
        expect(screen.getByTestId("datos-del-profesional").textContent).not.toContain("Teléfono:");
    });

    it("dirección única: NO insinúa que el profesional tenga los datos del padre", () => {
        render(<DatosProfesionalCita contacto={{ email: "pro@x.co", telefono: null }} nombreVisible="Dra. Ana" />);
        const t = screen.getByTestId("datos-del-profesional").textContent ?? "";
        expect(t).not.toMatch(/tus datos|tu correo|tu teléfono|el profesional tiene/i);
    });
});
