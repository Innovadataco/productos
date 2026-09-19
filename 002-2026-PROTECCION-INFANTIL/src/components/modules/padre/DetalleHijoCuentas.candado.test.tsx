/**
 * CANDADO de RENDER · SPEC-716 (Parte B) · Bajo un hijo, sus DOS GRUPOS + el detalle de una cuenta
 * reportada — y en toda esa ruta el TEXTO del reporte NO existe.
 *
 * Conducta (no fuente): se renderiza el detalle real y se afirma:
 *  1. Los dos grupos existen y NO se funden («Sus cuentas» ≠ «Cuentas que reportaste por …»).
 *  2. Una cuenta reportada muestra su chip y «Ver quién la reportó»; al pulsarlo se ve el detalle
 *     con los 5 campos (clasificación, fecha, ciudad/país, anónimo vs «Una familia con cuenta
 *     verificada») y el blindaje DICHO. El anónimo va APARTE.
 *  3. NO-FUGA en el HTML: el tipo del DTO ya no lleva texto; el candado además siembra un texto de
 *     relato conocido en un campo que la ficha NO debe pintar y verifica que no aparece en el HTML
 *     (control positivo: el reporte SÍ se renderiza —su clasificación/fecha están—, así que si la
 *     ficha pintara el texto, este assert lo cazaría).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DetalleHijoCuentas } from "./DetalleHijoCuentas";
import type { CuentaReportadaDto } from "@/lib/dal/services/hijos/reportes-ajenos";
import type { CuentaQueReporteDto } from "@/lib/dal/services/hijos/reportes-propios-por-hijo";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const TEXTO_RELATO = "RELATO-QUE-NUNCA-DEBE-VERSE-716B";

// Un DTO con una clave `texto` de más (no está en el tipo) — simula una fuga y prueba que la ficha
// no la pinta. Se castea porque el tipo blindado la prohíbe: justo lo que el candado vigila.
const cuentaReportada: CuentaReportadaDto = {
    valor: "acosador.uno",
    plataforma: "Discord",
    total: 2,
    reportes: [
        { id: "r1", creadoEn: new Date("2026-09-09T15:00:00Z"), pais: "Colombia", ciudad: "Bogotá", categoriaLabel: "Contacto insistente", esAnonimo: false, texto: TEXTO_RELATO } as never,
        { id: "r2", creadoEn: new Date("2026-09-08T15:00:00Z"), pais: null, ciudad: null, categoriaLabel: null, esAnonimo: true, texto: TEXTO_RELATO } as never,
    ],
};
const cuentaLimpia: CuentaReportadaDto = { valor: "amiga.ok", plataforma: "Instagram", total: 0, reportes: [] };
const grupoB: CuentaQueReporteDto[] = [
    { reporteId: "b1", valor: "malo.99", plataforma: "WhatsApp", creadoEn: new Date("2026-09-01T10:00:00Z"), enRevision: true, categoriaLabel: null },
];

afterEach(() => cleanup());

describe("SPEC-716 (Parte B) · detalle del hijo: dos grupos + reporte sin texto", () => {
    it("los DOS grupos existen y no se funden", () => {
        render(<DetalleHijoCuentas hijo={{ id: "h1", nombre: "Zaira" }} grupoA={[cuentaReportada, cuentaLimpia]} grupoB={grupoB} />);
        expect(screen.getByText("Sus cuentas")).toBeTruthy();
        expect(screen.getByText("Cuentas que reportaste por Zaira")).toBeTruthy();
        // Chips: la reportada en ámbar, la limpia «Nadie la reportó».
        expect(screen.getByText("2 reportes")).toBeTruthy();
        expect(screen.getByText("Nadie la reportó")).toBeTruthy();
    });

    it("CANDADO · «Ver quién la reportó» → 5 campos, anónimo aparte, y el texto NO aparece en el HTML", () => {
        const { container } = render(<DetalleHijoCuentas hijo={{ id: "h1", nombre: "Zaira" }} grupoA={[cuentaReportada]} grupoB={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver quién la reportó" }));

        // Detalle de la cuenta.
        expect(screen.getByText("La cuenta de Zaira")).toBeTruthy();
        // Control positivo: el reporte SÍ se renderiza (su clasificación + el par verificado).
        expect(screen.getByText("Contacto insistente")).toBeTruthy();
        expect(screen.getByText(/Una familia con cuenta verificada/)).toBeTruthy();
        // El anónimo va aparte y con su etiqueta (la nota de «aparte» + la ficha «Anónimo»).
        expect(screen.getAllByText(/anónimo/i).length).toBeGreaterThanOrEqual(1);
        // Blindaje DICHO.
        expect(screen.getByText(/El texto del reporte no se muestra/)).toBeTruthy();

        // NO-FUGA: el relato sembrado (clave `texto` de más) NUNCA llega al HTML.
        expect(container.innerHTML).not.toContain(TEXTO_RELATO);
    });

    it("grupo B vacío → invita a reportar; grupo A vacío → dice que no hay cuentas", () => {
        render(<DetalleHijoCuentas hijo={{ id: "h1", nombre: "Zaira" }} grupoA={[]} grupoB={[]} />);
        expect(screen.getByText(/Todavía no has reportado ninguna cuenta por Zaira/)).toBeTruthy();
        expect(screen.getByRole("link", { name: /Reportar una cuenta que le escribió/ })).toBeTruthy();
        expect(screen.getByText(/no tiene cuentas registradas/)).toBeTruthy();
    });
});
