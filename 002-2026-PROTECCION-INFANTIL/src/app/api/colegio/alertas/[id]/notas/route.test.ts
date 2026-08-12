/**
 * SPEC-159 (T004, FR-004): POST /api/colegio/alertas/[id]/notas — bitácora del
 * caso. Atómico (withUnitOfWork: seguimiento lazy + nota + audit en la misma
 * tx; fallo provocado a mitad = 0 filas), A/B (B recibe 404 sin filas) y
 * SC-002 (dos notas ⇒ 2 notas, 1 solo SeguimientoCaso, 2 filas de audit).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
    crearParametrosReportes,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

// logAudit pasa por la implementación real por defecto; el test de atomicidad
// fuerza UN fallo (mockRejectedValueOnce) dentro de la transacción.
vi.mock("@/lib/audit", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/audit")>();
    return { ...original, logAudit: vi.fn(original.logAudit) };
});

async function fixtureAlerta(identificadorValor: string) {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    const curso = await crearCurso(colegio.id, { nombre: "6A" });
    const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const identificador = await crearIdentificadorEstudiante(alumno.id, {
        valor: identificadorValor,
        plataformaId: plataforma!.id,
        etiquetaRelacion: "ESTUDIANTE",
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId: plataforma!.id,
            texto: "Texto confidencial",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            edadVictima: 12,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
    const alerta = await new AlertaColegioRepository().crear({
        colegioId: colegio.id,
        reporteId: reporte.id,
        tipoSujeto: "ESTUDIANTE",
        identificadorEstudianteId: identificador.id,
    });
    return { admin, colegio, alerta };
}

function postNota(alertaId: string, body: unknown) {
    return POST(crearRequestAutenticado("POST", `http://localhost:5005/api/colegio/alertas/${alertaId}/notas`, body, mockToken), {
        params: Promise.resolve({ id: alertaId }),
    });
}

describe("POST /api/colegio/alertas/[id]/notas (SPEC-159)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        vi.mocked(logAudit).mockClear();
        mockToken = undefined;
    });

    it("SC-002: dos notas ⇒ 2 notas, 1 solo SeguimientoCaso (unique alertaId), 2 audits", async () => {
        const { colegio, alerta } = await fixtureAlerta("+57300NOTA1");

        const res1 = await postNota(alerta.id, { texto: "Llamé a la acudiente" });
        expect(res1.status).toBe(201);
        const res2 = await postNota(alerta.id, { texto: "Citada para el jueves" });
        expect(res2.status).toBe(201);

        expect(await prisma.notaSeguimiento.count({ where: { colegioId: colegio.id } })).toBe(2);
        expect(await prisma.seguimientoCaso.count({ where: { colegioId: colegio.id } })).toBe(1);

        const audits = await prisma.auditLog.findMany({
            where: { accion: "COLEGIO_CASO_NOTA_AGREGADA", colegioId: colegio.id },
        });
        expect(audits).toHaveLength(2);
        // El audit lleva solo metadatos: nunca el texto de la nota.
        expect(JSON.stringify(audits)).not.toContain("Llamé a la acudiente");
    });

    it("atómico: fallo provocado en el audit (mitad de la tx) ⇒ 0 filas y 500", async () => {
        const { colegio, alerta } = await fixtureAlerta("+57300NOTA2");
        vi.mocked(logAudit).mockRejectedValueOnce(new Error("fallo forzado en prueba de atomicidad"));

        const res = await postNota(alerta.id, { texto: "Esta nota no debe quedar" });
        expect(res.status).toBe(500);

        expect(await prisma.notaSeguimiento.count({ where: { colegioId: colegio.id } })).toBe(0);
        expect(await prisma.seguimientoCaso.count({ where: { colegioId: colegio.id } })).toBe(0);
        expect(
            await prisma.auditLog.count({ where: { accion: "COLEGIO_CASO_NOTA_AGREGADA", colegioId: colegio.id } })
        ).toBe(0);
    });

    it("A/B: el colegio B recibe 404 y NO se crea ninguna fila", async () => {
        const { colegio: colegioA, alerta } = await fixtureAlerta("+57300NOTA3");

        const { admin: adminB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const res = await postNota(alerta.id, { texto: "Intento de nota ajena" });
        expect(res.status).toBe(404);

        expect(await prisma.notaSeguimiento.count({ where: { colegioId: colegioA.id } })).toBe(0);
        expect(await prisma.seguimientoCaso.count({ where: { colegioId: colegioA.id } })).toBe(0);
        expect(await prisma.notaSeguimiento.count()).toBe(0);
    });

    it("validación Zod: texto vacío o de más de 1000 caracteres ⇒ 400 sin filas", async () => {
        const { colegio, alerta } = await fixtureAlerta("+57300NOTA4");

        expect((await postNota(alerta.id, { texto: "   " })).status).toBe(400);
        expect((await postNota(alerta.id, { texto: "x".repeat(1001) })).status).toBe(400);
        expect((await postNota(alerta.id, {})).status).toBe(400);

        expect(await prisma.notaSeguimiento.count({ where: { colegioId: colegio.id } })).toBe(0);
        expect(await prisma.seguimientoCaso.count({ where: { colegioId: colegio.id } })).toBe(0);
    });
});
