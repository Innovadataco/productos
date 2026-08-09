/**
 * SPEC-150 (T003, FR-002): /api/colegio/alumnos/[id]/observacion — observación
 * especial. POST idempotente (201 ⇒ 200 con la misma, sin duplicar fila ni
 * audit), DELETE soft delete que CONSERVA la fila (histórico vía GET), audit
 * en ambas acciones, atómico (fallo a mitad = 0 filas) y A/B (B recibe 404
 * sin tocar nada).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";

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

async function fixtureEstudiante(nombre = "María") {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    const curso = await crearCurso(colegio.id, { nombre: "6A" });
    const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre, apellidos: "Gómez" });
    return { admin, colegio, estudiante };
}

function llamar(method: "GET" | "POST" | "DELETE", estudianteId: string, body?: unknown) {
    const handler = method === "GET" ? GET : method === "POST" ? POST : DELETE;
    return handler(crearRequestAutenticado(method, `http://localhost:5005/api/colegio/alumnos/${estudianteId}/observacion`, body, mockToken), {
        params: Promise.resolve({ id: estudianteId }),
    });
}

describe("/api/colegio/alumnos/[id]/observacion (SPEC-150)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        vi.mocked(logAudit).mockClear();
        mockToken = undefined;
    });

    it("POST crea la observación activa (201) + audit; re-POST es idempotente (200, misma fila, sin re-auditar)", async () => {
        const { colegio, estudiante } = await fixtureEstudiante();

        const res1 = await llamar("POST", estudiante.id, { motivo: "Cambio de comportamiento" });
        expect(res1.status).toBe(201);
        const data1 = await res1.json();
        expect(data1.creada).toBe(true);
        expect(data1.observacion.activa).toBe(true);
        expect(data1.observacion.motivo).toBe("Cambio de comportamiento");

        const res2 = await llamar("POST", estudiante.id, { motivo: "Motivo distinto" });
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.creada).toBe(false);
        expect(data2.observacion.id).toBe(data1.observacion.id);

        expect(await prisma.estudianteObservacion.count({ where: { colegioId: colegio.id } })).toBe(1);
        const audits = await prisma.auditLog.findMany({
            where: { accion: "COLEGIO_OBSERVACION_MARCADA", colegioId: colegio.id },
        });
        expect(audits).toHaveLength(1);
        expect(audits[0]!.tipoRecurso).toBe("EstudianteObservacion");
        // El audit lleva solo metadatos: nunca el motivo.
        expect(JSON.stringify(audits)).not.toContain("Cambio de comportamiento");
    });

    it("DELETE es soft delete: fila CONSERVADA con fecha/actor + audit; GET expone el histórico con actores", async () => {
        const { admin, colegio, estudiante } = await fixtureEstudiante();
        await llamar("POST", estudiante.id, { motivo: "Seguimiento reforzado" });

        const res = await llamar("DELETE", estudiante.id);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.observacion.activa).toBe(false);
        expect(data.observacion.desactivadaEn).not.toBeNull();
        expect(data.observacion.desactivadaPorId).toBe(admin.id);

        // La fila NO se borra.
        expect(await prisma.estudianteObservacion.count({ where: { colegioId: colegio.id } })).toBe(1);
        const audits = await prisma.auditLog.findMany({
            where: { accion: "COLEGIO_OBSERVACION_DESMARCADA", colegioId: colegio.id },
        });
        expect(audits).toHaveLength(1);

        // DELETE sin activa ⇒ 404 (nada que desmarcar).
        expect((await llamar("DELETE", estudiante.id)).status).toBe(404);

        // GET: sin activa, histórico completo con actores legibles.
        const resGet = await llamar("GET", estudiante.id);
        expect(resGet.status).toBe(200);
        const estado = (await resGet.json()).observacion;
        expect(estado.activa).toBeNull();
        expect(estado.historial).toHaveLength(1);
        expect(estado.historial[0].motivo).toBe("Seguimiento reforzado");
        expect(estado.historial[0].creadaPor).toBe(admin.nombre);
        expect(estado.historial[0].desactivadaPor).toBe(admin.nombre);
    });

    it("atómico: fallo provocado en el audit (mitad de la tx) ⇒ 0 filas y 500", async () => {
        const { colegio, estudiante } = await fixtureEstudiante();
        vi.mocked(logAudit).mockRejectedValueOnce(new Error("fallo forzado en prueba de atomicidad"));

        const res = await llamar("POST", estudiante.id, {});
        expect(res.status).toBe(500);

        expect(await prisma.estudianteObservacion.count({ where: { colegioId: colegio.id } })).toBe(0);
        expect(
            await prisma.auditLog.count({ where: { accion: "COLEGIO_OBSERVACION_MARCADA", colegioId: colegio.id } })
        ).toBe(0);
    });

    it("A/B: el colegio B recibe 404 en POST/DELETE/GET sobre el estudiante de A y nada cambia", async () => {
        const { colegio: colegioA, estudiante } = await fixtureEstudiante();
        await llamar("POST", estudiante.id, {});

        const { admin: adminB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        expect((await llamar("GET", estudiante.id)).status).toBe(404);
        expect((await llamar("POST", estudiante.id, { motivo: "Intento ajeno" })).status).toBe(404);
        expect((await llamar("DELETE", estudiante.id)).status).toBe(404);

        // La marca de A sigue intacta y B no creó nada.
        const filas = await prisma.estudianteObservacion.findMany();
        expect(filas).toHaveLength(1);
        expect(filas[0]!.colegioId).toBe(colegioA.id);
        expect(filas[0]!.activa).toBe(true);
        expect(filas[0]!.motivo).toBeNull();
    });

    it("validación Zod: motivo de más de 500 caracteres ⇒ 400 sin filas", async () => {
        const { colegio, estudiante } = await fixtureEstudiante();

        expect((await llamar("POST", estudiante.id, { motivo: "x".repeat(501) })).status).toBe(400);
        expect(await prisma.estudianteObservacion.count({ where: { colegioId: colegio.id } })).toBe(0);
    });
});
