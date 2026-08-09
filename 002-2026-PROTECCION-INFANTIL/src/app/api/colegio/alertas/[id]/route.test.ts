/**
 * SPEC-159 (T004, FR-002/FR-003/FR-007): GET /api/colegio/alertas/[id] — el
 * caso completo en UNA llamada, 404 si es de OTRO colegio (A/B), timeline con
 * fuentes reales (SC-001: los 5 hitos con timestamps reales) y cero PII
 * (I-28/I-29: sin valor del identificador, texto del reporte ni scores).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { PATCH as PATCH_ESTADO } from "./estado/route";
import { POST as POST_NOTA } from "./notas/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
    crearParametrosReportes,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import type { EstadoReporte } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function crearReporte(identificador: string, plataformaId: string, estado: EstadoReporte) {
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial del reporte con datos sensibles del menor",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            edadVictima: 12,
            estado,
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
}

/** Fixture: colegio + alerta propia (creada directa, sin el pipeline de avisos). */
async function fixtureAlerta(identificadorValor: string) {
    const { admin, colegio } = await setupSchoolAdmin();
    const curso = await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto" });
    const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const identificador = await crearIdentificadorEstudiante(alumno.id, {
        valor: identificadorValor,
        plataformaId: plataforma!.id,
        etiquetaRelacion: "ESTUDIANTE",
    });
    const reporte = await crearReporte(identificadorValor, plataforma!.id, "CLASIFICADO");
    const alerta = await new AlertaColegioRepository().crear({
        colegioId: colegio.id,
        reporteId: reporte.id,
        identificadorEstudianteId: identificador.id,
    });
    return { admin, colegio, plataforma: plataforma!, reporte, alerta };
}

function getCaso(alertaId: string) {
    return GET(crearRequestAutenticado("GET", `http://localhost:5005/api/colegio/alertas/${alertaId}`, undefined, mockToken), {
        params: Promise.resolve({ id: alertaId }),
    });
}

describe("GET /api/colegio/alertas/[id] (SPEC-159)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    it("devuelve el caso completo: resumen visible, timeline, pendientes y bitácora vacía", async () => {
        const { alerta } = await fixtureAlerta("+57300CASO1");

        const res = await getCaso(alerta.id);
        expect(res.status).toBe(200);
        const { caso } = await res.json();

        expect(caso.alerta.id).toBe(alerta.id);
        expect(caso.alerta.estado).toBe("nueva");
        expect(caso.alerta.estudiante).toEqual({ nombre: "María", apellidos: "Gómez" });
        expect(caso.alerta.curso.nombre).toBe("6A");
        expect(caso.alerta.plataforma).toBe("WhatsApp");
        expect(caso.alerta.tipoIdentificador).toBe("telefono");

        // Alerta nueva: solo "detectado" cumplido; el resto pendiente (solo verdades).
        const porTipo = Object.fromEntries(caso.timeline.map((h: { tipo: string }) => [h.tipo, h]));
        expect(porTipo.detectado.estado).toBe("cumplido");
        expect(porTipo.detectado.fecha).toBe(alerta.creadoEn.toISOString());
        for (const tipo of ["corroborado", "vista", "gestionada", "avisado"]) {
            expect(porTipo[tipo].estado).toBe("pendiente");
            expect(porTipo[tipo].fecha).toBeNull();
        }

        // Pendientes computados de datos reales: revisar + gestionar + registrar.
        expect(caso.pendientes.map((p: { clave: string }) => p.clave)).toEqual(["revisar", "gestionar", "registrar"]);
        expect(caso.seguimiento.notas).toEqual([]);
    });

    it("SC-001: con todas las fuentes reales, los 5 hitos cumplidos con sus timestamps", async () => {
        const { admin, alerta, plataforma, reporte } = await fixtureAlerta("+57300CASO2");

        // vista + gestionada por el endpoint EXISTENTE de estado (sin tocarlo).
        await PATCH_ESTADO(
            crearRequestAutenticado("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta.id}/estado`, { estado: "vista" }, mockToken),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        await PATCH_ESTADO(
            crearRequestAutenticado("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta.id}/estado`, { estado: "gestionada" }, mockToken),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        // avisado: RegistroAvisoColegio ENVIADO del reporte (SPEC-149).
        await prisma.registroAvisoColegio.create({
            data: {
                colegioId: alerta.colegioId,
                tipoEvento: "REPORTE_NUEVO",
                entidadId: reporte.id,
                dia: new Date(Date.UTC(2026, 7, 9)),
                estado: "ENVIADO",
            },
        });

        // corroborado: EventoMatch agregado del reporte (SPEC-139, FR-009).
        const identificadorReportado = await prisma.identificadorReportado.create({
            data: { identificador: "+57300CASO2", plataformaId: plataforma.id },
        });
        await prisma.eventoMatch.create({
            data: {
                identificadorId: identificadorReportado.id,
                reporteNuevoId: reporte.id,
                conteoAcumulado: 2,
                ciudades: ["Bogotá", "Medellín"],
                conductasCoincidentes: ["OFRECIMIENTO_REGALOS"],
                interCiudad: true,
            },
        });

        // bitácora: una nota por el endpoint nuevo.
        const resNota = await POST_NOTA(
            crearRequestAutenticado("POST", `http://localhost:5005/api/colegio/alertas/${alerta.id}/notas`, { texto: "Llamé a la acudiente" }, mockToken),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(resNota.status).toBe(201);

        const res = await getCaso(alerta.id);
        const { caso } = await res.json();

        expect(caso.timeline).toHaveLength(5);
        expect(caso.timeline.every((h: { estado: string }) => h.estado === "cumplido")).toBe(true);
        const fechas = caso.timeline.map((h: { fecha: string }) => h.fecha);
        expect(fechas).toEqual([...fechas].sort());

        const porTipo = Object.fromEntries(caso.timeline.map((h: { tipo: string }) => [h.tipo, h]));
        expect(porTipo.corroborado.detalle).toContain("2 reportes acumulados");
        // El match NO filtra ciudades ni conductas al rector (FR-009).
        expect(porTipo.corroborado.detalle).not.toContain("Medellín");
        expect(porTipo.corroborado.detalle).not.toContain("OFRECIMIENTO");

        // Caso al día: gestionada + nota ⇒ copy positivo (sin pendientes).
        expect(caso.pendientes).toEqual([]);
        expect(caso.seguimiento.estado).toBe("en_seguimiento");
        expect(caso.seguimiento.notas).toHaveLength(1);
        expect(caso.seguimiento.notas[0].texto).toBe("Llamé a la acudiente");
        expect(caso.seguimiento.notas[0].autor).toBe(admin.nombre);
    });

    it("I-28/I-29: cero valor del identificador, texto del reporte, ciudad ni scores", async () => {
        const { reporte, alerta } = await fixtureAlerta("+57300SECRETO");

        const res = await getCaso(alerta.id);
        const json = await res.json();
        const serializado = JSON.stringify(json);

        expect(serializado).not.toContain("+57300SECRETO");
        expect(serializado).not.toContain(reporte.texto);
        expect(serializado).not.toContain("Bogotá");
        expect(serializado).not.toContain("Colombia");
        expect(serializado).not.toContain("score");
        expect(json.caso.alerta).not.toHaveProperty("reporteId");
        expect(json.caso.alerta).not.toHaveProperty("texto");
    });

    it("A/B: el colegio B recibe 404 del caso de A y ningún dato cruza", async () => {
        const { alerta } = await fixtureAlerta("+57300CASO3");

        const { admin: adminB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const res = await getCaso(alerta.id);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(JSON.stringify(json)).not.toContain("María");
    });

    it("roles ajenos reciben 403", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const res = await getCaso("cldabcdefghijklmnop1234567");
        expect(res.status).toBe(403);
    });

    it("inmutabilidad por construcción: la ruta de notas NO exporta PATCH ni DELETE", async () => {
        const modulo = await import("./notas/route");
        expect("PATCH" in modulo).toBe(false);
        expect("DELETE" in modulo).toBe(false);
        expect("PUT" in modulo).toBe(false);
    });
});
