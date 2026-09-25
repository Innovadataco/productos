/**
 * CANDADO · SPEC-738 — generar el informe (denuncia / expediente para autoridades)
 * es del PADRE, no del admin. El endpoint con sello YA existía (SPEC-323,
 * GET /api/padre/expedientes/[id]/pdf); lo que faltaba era el ACCESO VISUAL en la
 * pantalla del expediente del padre (`/dashboard/padre/expedientes/[id]` →
 * ExpedienteMadreClient), donde Jelkin lo busca.
 *
 * Conducta (no fuente): se renderiza el árbol real de la pantalla y se afirma que
 * existe un enlace de descarga que apunta al endpoint del PADRE con el id del
 * expediente — y que la cuenta/identificador NO viaja en esa URL.
 *
 * Control positivo: antes de SPEC-738 esta pantalla no surfaceaba ningún enlace al
 * PDF; quitar el <a> agregado por SPEC-738 pone este candado en rojo.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExpedienteMadreClient, type ExpedienteMadreDto } from "./ExpedienteMadreClient";

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// Hijos con I/O propia: fuera del alcance de este candado.
vi.mock("./TextoSensible", () => ({ TextoSensible: () => null }));
vi.mock("./AgregarEvento", () => ({ AgregarEvento: () => null }));
vi.mock("./GenerarPase", () => ({ GenerarPase: () => null }));
vi.mock("./QuienHaLeido", () => ({ QuienHaLeido: () => null }));

afterEach(() => cleanup());

const DETALLE: ExpedienteMadreDto = {
    expediente: {
        id: "exp-1",
        codigo: "EXP-0001",
        identificador: "cuenta_secreta_123",
        plataforma: "Roblox",
        estado: "ACTIVO",
        estadoLabel: "En proceso",
        fechaApertura: "2026-09-01T10:00:00.000Z",
        ultimoEventoEn: null,
    },
    hijo: { nombre: "Ana María", edad: 10 },
    reportePrincipalId: "rep-1",
    estadoReportes: "EN_PROCESO",
    procesando: 0,
    semaforo: { nivel: "baja", titulo: "Con calma", explicacion: "Sin novedades." },
    timeline: [],
    evidencia: [],
    analisis: null,
    tendencia: { direccion: "estable", nuevosUltimos7: 0, previos7: 0, texto: "Sin cambios." },
    ficha: {
        eventosTotales: 0,
        tuyos: 0,
        familiasQueReportan: 0,
        estadoLabel: "En proceso",
        plataforma: "Roblox",
        menor: "Ana María",
        abierto: "2026-09-01T10:00:00.000Z",
    },
};

describe("SPEC-738 · el padre descarga su informe desde su propio expediente", () => {
    it("surface un enlace de descarga al endpoint del PADRE con el id del expediente", () => {
        render(<ExpedienteMadreClient detalle={DETALLE} />);

        const enlace = screen.getByRole("link", { name: "Descargar el informe (PDF)" });
        expect(enlace.getAttribute("href")).toBe("/api/padre/expedientes/exp-1/pdf");
    });

    it("el enlace es del carril del PADRE (no del admin) y la cuenta NO viaja en la URL", () => {
        render(<ExpedienteMadreClient detalle={DETALLE} />);

        const href = screen.getByRole("link", { name: "Descargar el informe (PDF)" }).getAttribute("href") ?? "";
        expect(href.startsWith("/api/padre/expedientes/")).toBe(true);
        expect(href.includes("/admin/")).toBe(false);
        // El identificador de la cuenta nunca aparece en la URL de descarga.
        expect(href.includes(DETALLE.expediente.identificador)).toBe(false);
    });
});
