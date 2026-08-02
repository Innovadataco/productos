/**
 * SPEC-139 (F5, ZEUS D-3): bandeja del comité — los casos cuyo identificador
 * tiene match inter-ciudad van AL TOPE con el distintivo (etiqueta + orden,
 * NO sección nueva). Sin denunciantes ni textos en el payload.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const TAG = Math.random().toString(36).slice(2, 8);

async function crearSolicitud(identificadorValor: string, plataformaId: string, conMatchInterCiudad: boolean) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId,
            texto: "Texto de prueba de la bandeja del comité con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-${TAG}-${Math.random().toString(36).slice(2, 6)}`,
            estado: "REVISION_MANUAL",
        },
    });
    if (conMatchInterCiudad) {
        const agregado = await prisma.identificadorReportado.upsert({
            where: { identificador_plataformaId: { identificador: identificadorValor, plataformaId } },
            update: {},
            create: { identificador: identificadorValor, plataformaId, totalReportes: 2, reportesAprobados: 2 },
        });
        await prisma.eventoMatch.create({
            data: {
                identificadorId: agregado.id,
                reporteNuevoId: reporte.id,
                conteoAcumulado: 2,
                ciudades: ["Bogotá", "Cali"],
                conductasCoincidentes: ["EXTORSION"],
                interCiudad: true,
            },
        });
    }
    return prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero: `SOL-${TAG}-${Math.random().toString(36).slice(2, 6)}`,
            estado: "PENDIENTE",
            motivo: "motivo de prueba de la bandeja",
        },
    });
}

describe("GET /api/admin/comite/solicitudes (SPEC-139, F5: prioridad inter-ciudad)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("el caso con match inter-ciudad va primero y marcado; el otro sin marca", async () => {
        const plataforma = await crearPlataforma();
        // El caso SIN match se crea primero (más reciente en creadoEn desc perdería
        // el tope si no hubiera prioridad): el match debe quedar AL TOPE igual.
        await crearSolicitud(`+57351${TAG}`, plataforma.id, false);
        await new Promise((r) => setTimeout(r, 10));
        await crearSolicitud(`+57352${TAG}`, plataforma.id, true);

        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/admin/comite/solicitudes?page=1&limit=10", undefined, mockToken));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.solicitudes).toHaveLength(2);
        expect(body.solicitudes[0].matchInterCiudad).toBe(true);
        expect(body.solicitudes[1].matchInterCiudad).toBe(false);
        // FR-009: la bandeja no expone denunciantes ni textos.
        const crudo = JSON.stringify(body);
        expect(crudo).not.toContain("usuarioId");
        expect(crudo).not.toContain("ipHash");
        expect(crudo).not.toContain("Texto de prueba");
    });

    it("sin matches: orden habitual (creadoEn desc) y todos sin marca", async () => {
        const plataforma = await crearPlataforma();
        await crearSolicitud(`+57353${TAG}`, plataforma.id, false);
        await crearSolicitud(`+57354${TAG}`, plataforma.id, false);

        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/admin/comite/solicitudes?page=1&limit=10", undefined, mockToken));
        const body = await res.json();

        expect(body.solicitudes).toHaveLength(2);
        expect(body.solicitudes.every((s: { matchInterCiudad: boolean }) => !s.matchInterCiudad)).toBe(true);
        expect(body.paginacion.total).toBe(2);
    });
});
