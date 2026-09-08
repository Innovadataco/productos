/**
 * SPEC-596 (decisión CEO): ConsultaVaciaBloque — la tarjeta de señales y
 * acciones es el PROTAGONISTA del resultado vacío: visible siempre, sin modal
 * ni enlace previo. La pantalla ya NO lleva el CTA «Reportar una conducta»
 * ni el bloque de canales oficiales (la constitución los exige en las
 * INTERFACES DE REPORTE: /reportar los sigue mostrando; la portada, en
 * CanalesOficiales montado antes de la consulta — candado SPEC-456).
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsultaVaciaBloque } from "./ConsultaVaciaBloque";

const BLOQUE = {
    disclaimer: "Que no haya reportes no significa que sea seguro.",
    senales: ["Pide secreto", "Solicita fotos íntimas", "Ofrece regalos", "Propone encontrarse", "Dice ser menor"],
    acciones: ["Habla sin juzgar", "Guarda evidencia", "Canales oficiales"],
};

describe("ConsultaVaciaBloque (SPEC-596)", () => {
    afterEach(() => {
        sessionStorage.clear();
    });

    it("la tarjeta de señales y acciones es protagonista: visible sin click, con sus dos secciones", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} />);

        expect(screen.getByText(BLOQUE.disclaimer)).toBeTruthy();
        // Titular de la tarjeta protagonista.
        expect(screen.getByText("Señales de alerta y qué puedes hacer")).toBeTruthy();
        // Las dos secciones y TODOS sus items visibles de entrada (sin modal).
        expect(screen.getByText("Señales de alerta a las que estar atento")).toBeTruthy();
        expect(screen.getByText("Qué puedes hacer")).toBeTruthy();
        for (const senal of BLOQUE.senales) {
            expect(screen.getByText(senal)).toBeTruthy();
        }
        for (const accion of BLOQUE.acciones) {
            expect(screen.getByText(accion)).toBeTruthy();
        }
        // Accesibilidad: la tarjeta es una sección etiquetada por su titular.
        expect(screen.getByRole("region", { name: "Señales de alerta y qué puedes hacer" })).toBeTruthy();
    });

    it("ya no muestra el CTA de reporte ni los canales oficiales (decisión CEO)", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} />);

        expect(screen.queryByRole("button", { name: "Reportar una conducta" })).toBeNull();
        expect(screen.queryByText("Línea 141")).toBeNull();
        expect(screen.queryByText("CAI Virtual")).toBeNull();
        expect(screen.queryByText("Te Protejo")).toBeNull();
        // Sin interacción alguna: ni enlace al modal ni botones.
        expect(screen.queryByRole("button", { name: "Ver señales de alerta y qué puedes hacer" })).toBeNull();
    });

    it("omite secciones ausentes (degradación limpia)", () => {
        render(<ConsultaVaciaBloque bloque={{ disclaimer: "Solo aviso." }} />);

        expect(screen.getByText("Solo aviso.")).toBeTruthy();
        expect(screen.queryByText("Señales de alerta y qué puedes hacer")).toBeNull();
        expect(screen.queryByText("Señales de alerta a las que estar atento")).toBeNull();
        expect(screen.queryByText("Qué puedes hacer")).toBeNull();
    });

    it("tarjeta con una sola sección: renderiza la que hay y omite la otra", () => {
        render(<ConsultaVaciaBloque bloque={{ senales: BLOQUE.senales }} />);

        expect(screen.getByText("Señales de alerta a las que estar atento")).toBeTruthy();
        expect(screen.queryByText("Qué puedes hacer")).toBeNull();
        expect(screen.getByText(BLOQUE.senales[0])).toBeTruthy();
    });
});
