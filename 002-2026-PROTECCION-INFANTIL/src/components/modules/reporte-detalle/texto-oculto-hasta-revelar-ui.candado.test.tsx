/**
 * CANDADO · SPEC-734 (UI · Jelkin probando 24-09) · el relato del reporte de un
 * menor NO se pinta hasta un acto deliberado de revelar (que el servidor descifra y
 * AUDITA). Complementa el candado de servidor de Datos (relato-oculto-hasta-revelar):
 * aquí se vigila la CONDUCTA de la pantalla.
 *
 * Conductas que no se pueden fingir (render real + defensa en profundidad):
 *  1. Sin revelar → MARCADOR «El texto queda oculto…», NUNCA el relato; con permiso,
 *     ofrece «Revelar texto» y el clic dispara la revelación.
 *  2. Control positivo · revelado → PINTA el relato y quita el marcador (el «revelar»
 *     de hoy AUDITA PERO NO PINTABA; esto lo cierra).
 *  3. Sin permiso → marcador sin botón (no hay puerta acá).
 *  4. Defensa en profundidad: aunque el objeto `reporte` trajera el relato (regresión
 *     del servidor), la UI NO lo pinta sin `textoActualRevelado`.
 *  5. El reveal re-consulta el detalle con `?revelar=true` (contrato de Datos) y prende
 *     el texto revelado.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { ReporteDetalleInfo } from "./ReporteDetalleInfo";
import type { DetalleReporte } from "./types";

const MARCADOR = /El texto queda oculto; al revelarlo se registra quién lo vio/;
const RELATO = "Un desconocido le escribió a mi hija por la noche.";

function base(over: Partial<DetalleReporte> = {}): DetalleReporte {
    return {
        id: "r1",
        identificador: "@nick",
        plataforma: { nombre: "Roblox", clave: "roblox" },
        texto: null,
        estado: "CLASIFICADO",
        ciudad: "Bogotá",
        pais: "Colombia",
        fechaIncidente: "2026-09-01",
        horaAproximada: false,
        franja: null,
        esAnonimo: false,
        numeroSeguimiento: "PI-1",
        creadoEn: new Date().toISOString(),
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        eliminado: false,
        motivoBaja: null,
        notaBaja: null,
        eliminadoEn: null,
        ...over,
    };
}

afterEach(() => cleanup());

describe("SPEC-734 · el relato queda oculto hasta revelar (UI)", () => {
    it("sin revelar: muestra el MARCADOR y NO el relato; con permiso ofrece «Revelar texto»", () => {
        const onRevelar = vi.fn();
        render(
            <ReporteDetalleInfo reporte={base()} textoActualRevelado={null} puedeRevelarTexto onRevelarTexto={onRevelar} />,
        );
        expect(screen.getByText(MARCADOR)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Revelar texto/ }));
        expect(onRevelar).toHaveBeenCalledTimes(1);
    });

    it("CONTROL POSITIVO · revelado: PINTA el relato y ya no muestra el marcador", () => {
        render(
            <ReporteDetalleInfo reporte={base()} textoActualRevelado={RELATO} puedeRevelarTexto onRevelarTexto={() => {}} />,
        );
        expect(screen.getByText(RELATO)).toBeTruthy();
        expect(screen.queryByText(MARCADOR)).toBeNull();
        expect(screen.queryByRole("button", { name: /Revelar texto/ })).toBeNull();
    });

    it("sin permiso de revelar: marcador SIN botón (no hay puerta acá)", () => {
        render(<ReporteDetalleInfo reporte={base()} textoActualRevelado={null} puedeRevelarTexto={false} />);
        expect(screen.getByText(MARCADOR)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Revelar texto/ })).toBeNull();
    });

    it("defensa en profundidad: aunque `reporte.texto` trajera el relato, sin revelar NO se pinta", () => {
        const { container } = render(
            <ReporteDetalleInfo
                reporte={base({ texto: RELATO })}
                textoActualRevelado={null}
                puedeRevelarTexto
                onRevelarTexto={() => {}}
            />,
        );
        expect(container.textContent ?? "").not.toContain(RELATO);
    });

    it("el reveal re-consulta el detalle con ?revelar=true (contrato de Datos) y prende el texto", () => {
        const src = fs.readFileSync(path.resolve(__dirname, "useReporteDetalle.ts"), "utf-8");
        expect(src).toContain("?revelar=true");
        expect(/setTextoActualRevelado\(/.test(src)).toBe(true);
    });
});
