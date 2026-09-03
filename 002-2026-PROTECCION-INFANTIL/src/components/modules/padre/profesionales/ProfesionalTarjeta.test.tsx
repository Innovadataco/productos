/**
 * SPEC-392 (L3) · tarjeta del directorio · reglas duras del brief:
 *  · tarifa "por delante" en pesos colombianos ("$120.000").
 *  · sello "Nuevo en la red" mientras no haya varias calificaciones (L3 = todos).
 *  · sin datos internos ni de contacto en el DOM.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfesionalTarjeta } from "./ProfesionalTarjeta";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

const perfil: PerfilPublicoDTO = {
    id: "prof-1",
    nombreVisible: "Dra. Ana Pérez",
    fotoUrl: null,
    tituloProfesional: "Psicóloga clínica",
    especialidades: ["Ansiedad", "Adolescencia"],
    ciudadId: "ciudad-bog",
    ciudad: { id: "ciudad-bog", nombre: "Bogotá" },
    atiendeVirtual: true,
    atiendePresencial: false,
    tarifaConsultaCOP: 120000,
    duracionMinutos: 50,
    emiteFactura: true,
    aniosExperiencia: 8,
    presentacion: "Hola, soy visible sin problemas.",
};

describe("ProfesionalTarjeta", () => {
    it("pinta la tarifa formateada COP con la duración", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" />);
        // El símbolo puede venir como "$" seguido de espacio no-break; verifico por número.
        const texto = document.body.textContent ?? "";
        expect(texto).toMatch(/120\.000/);
        expect(texto).toContain("50 min");
    });

    it("siempre muestra «Nuevo en la red» (candado del brief · L3 sin encuestas)", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" />);
        expect(screen.getByText(/Nuevo en la red/)).toBeTruthy();
    });

    it("preserva query string al construir el enlace", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="?u=ESTA_SEMANA&pres=hola" />);
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("/x/prof-1?u=ESTA_SEMANA&pres=hola");
    });

    it("no filtra contacto ni internos (barrido cliente H-2 · defensa en profundidad)", () => {
        // Aunque el DAL ya los filtra, la tarjeta se defiende: si un dev futuro
        // amplía ProfesionalTarjetaData para admitir `email` o `telefono`, este
        // test lo caza. Los props actuales NO los admiten (no compila).
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" />);
        const texto = document.body.textContent ?? "";
        expect(texto).not.toMatch(/@/); // sin correos
        expect(texto).not.toMatch(/\+57\d/); // sin teléfonos
    });
});
