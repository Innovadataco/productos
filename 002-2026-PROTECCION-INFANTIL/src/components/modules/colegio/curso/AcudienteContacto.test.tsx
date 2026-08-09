/**
 * SPEC-147 (T004, SC-002) — AcudienteContacto por caso: solo teléfono (tel:),
 * solo email (mailto:), ambos, ninguno (badge ámbar "sin contactos"), sin
 * acudiente (badge), segundo acudiente visible con sus propios enlaces.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AcudienteContacto } from "./AcudienteContacto";

describe("AcudienteContacto", () => {
    it("solo teléfono: enlace tel: clicable y ningún mailto:", () => {
        render(
            <AcudienteContacto
                acudientes={[{ nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233", email: null }]}
            />
        );
        expect(screen.getByText("Marta Torres (madre)")).toBeTruthy();
        const llamar = screen.getByRole("link", { name: "Llamar a Marta Torres" });
        expect(llamar.getAttribute("href")).toBe("tel:+573001112233");
        expect(screen.queryByRole("link", { name: /Escribir a/ })).toBeNull();
    });

    it("solo email: enlace mailto: clicable y ningún tel:", () => {
        render(
            <AcudienteContacto
                acudientes={[{ nombre: "Carlos Gómez", relacion: "padre", telefono: null, email: "carlos@example.com" }]}
            />
        );
        const escribir = screen.getByRole("link", { name: "Escribir a Carlos Gómez" });
        expect(escribir.getAttribute("href")).toBe("mailto:carlos@example.com");
        expect(screen.queryByRole("link", { name: /Llamar a/ })).toBeNull();
    });

    it("ambos datos: tel: y mailto: clicables", () => {
        render(
            <AcudienteContacto
                acudientes={[
                    { nombre: "Ana Torres", relacion: "tía", telefono: "+573009998877", email: "ana@example.com" },
                ]}
            />
        );
        expect(screen.getByRole("link", { name: "Llamar a Ana Torres" }).getAttribute("href")).toBe("tel:+573009998877");
        expect(screen.getByRole("link", { name: "Escribir a Ana Torres" }).getAttribute("href")).toBe("mailto:ana@example.com");
    });

    it("acudiente sin teléfono NI email: badge ámbar 'sin contactos'", () => {
        render(
            <AcudienteContacto
                acudientes={[{ nombre: "Marta Torres", relacion: "madre", telefono: null, email: null }]}
            />
        );
        expect(screen.getByText("sin contactos")).toBeTruthy();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("sin acudiente: badge ámbar 'sin contactos' (nunca rojo)", () => {
        render(<AcudienteContacto acudientes={[]} />);
        expect(screen.getByText("sin contactos")).toBeTruthy();
    });

    it("segundo acudiente visible en segunda línea con sus propios enlaces", () => {
        render(
            <AcudienteContacto
                acudientes={[
                    { nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233", email: null },
                    { nombre: "Juan Torres", relacion: "padre", telefono: null, email: "juan@example.com" },
                ]}
            />
        );
        expect(screen.getByText("Marta Torres (madre)")).toBeTruthy();
        expect(screen.getByText("Juan Torres (padre)")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Llamar a Marta Torres" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Escribir a Juan Torres" }).getAttribute("href")).toBe("mailto:juan@example.com");
    });

    it("principal sin contacto pero segundo con teléfono: NO hay badge y el segundo es clicable", () => {
        render(
            <AcudienteContacto
                acudientes={[
                    { nombre: "Marta Torres", relacion: "madre", telefono: null, email: null },
                    { nombre: "Juan Torres", relacion: "padre", telefono: "+573005554444", email: null },
                ]}
            />
        );
        expect(screen.queryByText("sin contactos")).toBeNull();
        expect(screen.getByRole("link", { name: "Llamar a Juan Torres" }).getAttribute("href")).toBe("tel:+573005554444");
    });
});
