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
    ciudad: { id: "ciudad-bog", nombre: "Bogotá", pais: "Colombia" },
    atiendeVirtual: true,
    atiendePresencial: false,
    tarifaConsultaCOP: 120000,
    duracionMinutos: 50,
    emiteFactura: true,
    aniosExperiencia: 8,
    presentacion: "Hola, soy visible sin problemas.",
};

describe("ProfesionalTarjeta", () => {
    it("SPEC-441 · pinta el precio que se COBRA (primera cita), no la tarifa informativa", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        const texto = document.body.textContent ?? "";

        // El assert cambió de intención A PROPÓSITO. Antes afirmaba /120.000/,
        // que es `tarifaConsultaCOP` — informativa, de la 2ª cita en adelante —
        // mientras la ficha mostraba el precio estándar de la 1ª. El padre veía
        // un número acá y otro al entrar; ese era el defecto, no el tamaño.
        expect(texto).toMatch(/50\.000/);
        expect(texto).toContain("50 min");
    });

    it("SPEC-441 · y NO muestra la tarifa informativa del profesional", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        expect(
            document.body.textContent ?? "",
            "Dos números de plata en una tarjeta es la confusión que la spec cierra.",
        ).not.toMatch(/120\.000/);
    });

    it("SPEC-441 · la ubicación dice de quién es y lleva país", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        const texto = document.body.textContent ?? "";
        expect(texto).toContain("Atiende desde Bogotá, Colombia");
    });

    it("SPEC-441 · sin país NO se inventa uno: solo la ciudad", () => {
        const sinPais = { ...perfil, ciudad: { id: "c", nombre: "Medellín", pais: null } };
        render(<ProfesionalTarjeta p={sinPais} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        const texto = document.body.textContent ?? "";
        expect(texto).toContain("Atiende desde Medellín");
        expect(texto).not.toContain("Medellín,");
    });

    it("SPEC-441 · con la ciudad sin nombre NO pinta un pin vacío", () => {
        const sinCiudad = { ...perfil, ciudad: { id: "c", nombre: "", pais: null } };
        render(<ProfesionalTarjeta p={sinCiudad} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        expect(document.body.textContent ?? "").not.toContain("Atiende desde");
    });

    it("SPEC-441 · fuera el nombre técnico del título, que el padre no entiende", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        const texto = document.body.textContent ?? "";
        expect(texto).not.toContain("Psicóloga clínica");
        // En su lugar, lo que sí está en lenguaje de familia.
        expect(texto).toContain("Ansiedad");
    });

    it("siempre muestra «Nuevo en la red» (candado del brief · L3 sin encuestas)", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        expect(screen.getByText(/Nuevo en la red/)).toBeTruthy();
    });

    it("preserva query string al construir el enlace", () => {
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="?u=ESTA_SEMANA&pres=hola" precioPrimeraCitaCOP={50000} />);
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("/x/prof-1?u=ESTA_SEMANA&pres=hola");
    });

    it("no filtra contacto ni internos (barrido cliente H-2 · defensa en profundidad)", () => {
        // Aunque el DAL ya los filtra, la tarjeta se defiende: si un dev futuro
        // amplía ProfesionalTarjetaData para admitir `email` o `telefono`, este
        // test lo caza. Los props actuales NO los admiten (no compila).
        render(<ProfesionalTarjeta p={perfil} hrefBase="/x" queryString="" precioPrimeraCitaCOP={50000} />);
        const texto = document.body.textContent ?? "";
        expect(texto).not.toMatch(/@/); // sin correos
        expect(texto).not.toMatch(/\+57\d/); // sin teléfonos
    });
});
