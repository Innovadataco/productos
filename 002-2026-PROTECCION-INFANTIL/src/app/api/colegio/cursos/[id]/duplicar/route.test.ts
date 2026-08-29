import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";

/**
 * SPEC-152 — POST /api/colegio/cursos/[id]/duplicar:
 * clonación atómica de curso + estudiantes + identificadores al año siguiente.
 */

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(cursoId: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(`http://localhost:5005/api/colegio/cursos/${cursoId}/duplicar`, {
        method: "POST",
        headers,
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function conteoTablas(colegioId: string) {
    const [cursos, estudiantes, identificadores, acudientes] = await Promise.all([
        prisma.curso.count({ where: { colegioId } }),
        prisma.estudiante.count({ where: { colegioId } }),
        prisma.identificadorEstudiante.count({ where: { estudiante: { colegioId } } }),
        prisma.acudienteEstudiante.count({ where: { estudiante: { colegioId } } }),
    ]);
    return { cursos, estudiantes, identificadores, acudientes };
}

describe("POST /api/colegio/cursos/[id]/duplicar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("duplica curso con estudiantes e identificadores al año siguiente", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" });
        const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
        await crearIdentificadorEstudiante(estudiante.id, { valor: "+573001234567" });

        const res = await POST(request(curso.id, mockToken), { params: Promise.resolve({ id: curso.id }) });
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.curso.nombre).toBe("8° B");
        expect(json.curso.anioLectivo).toBe("2027");
        expect(json.curso.colegioId).toBe(colegio.id);
        expect(json.resumen).toEqual({ estudiantesClonados: 1, identificadoresClonados: 1 });

        const conteo = await conteoTablas(colegio.id);
        expect(conteo).toEqual({ cursos: 2, estudiantes: 2, identificadores: 2, acudientes: 0 });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CURSO_DUPLICADO", recursoId: json.curso.id },
        });
        expect(audit).not.toBeNull();
        expect(audit!.valorNuevo).toContain("\"estudiantesClonados\":1");
    });

    it("devuelve 404 si el curso pertenece a OTRO colegio", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const cursoB = await crearCurso(colegioB.id, { nombre: "Curso B", anioLectivo: "2026" });

        const res = await POST(request(cursoB.id, mockToken), { params: Promise.resolve({ id: cursoB.id }) });
        expect(res.status).toBe(404);
        const conteo = await conteoTablas(colegioA.id);
        expect(conteo.cursos).toBe(0);
    });

    it("devuelve 409 si el curso destino ya existe y no crea nada", async () => {
        const { colegio } = await setupSchoolAdmin();
        const origen = await crearCurso(colegio.id, { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" });
        await crearEstudiante(origen.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
        // Curso destino ya existe.
        await crearCurso(colegio.id, { nombre: "8° B", grado: "Octavo", anioLectivo: "2027" });

        const antes = await conteoTablas(colegio.id);
        const res = await POST(request(origen.id, mockToken), { params: Promise.resolve({ id: origen.id }) });
        expect(res.status).toBe(409);
        const despues = await conteoTablas(colegio.id);
        expect(despues).toEqual(antes);
    });

    it("respeta el estado activo: no migra estudiantes ni identificadores inactivos", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "8° B", anioLectivo: "2026" });
        const activo = await crearEstudiante(curso.id, colegio.id, { nombre: "Activo", apellidos: "Est" });
        await crearIdentificadorEstudiante(activo.id, { valor: "+573001234567" });
        const inactivo = await crearEstudiante(curso.id, colegio.id, { nombre: "Inactivo", apellidos: "Est", estado: "inactivo" });
        await crearIdentificadorEstudiante(inactivo.id, { valor: "+573009998877", estado: "inactivo" });

        const res = await POST(request(curso.id, mockToken), { params: Promise.resolve({ id: curso.id }) });
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.resumen).toEqual({ estudiantesClonados: 1, identificadoresClonados: 1 });

        const conteo = await conteoTablas(colegio.id);
        expect(conteo.estudiantes).toBe(3); // 2 origen + 1 clon del activo
        expect(conteo.identificadores).toBe(3); // 2 origen + 1 clon del activo
    });

    it("el curso origen queda intacto", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "8° B", anioLectivo: "2026" });
        const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
        await crearIdentificadorEstudiante(estudiante.id, { valor: "+573001234567" });

        await POST(request(curso.id, mockToken), { params: Promise.resolve({ id: curso.id }) });

        const origenActualizado = await prisma.curso.findUnique({ where: { id: curso.id } });
        expect(origenActualizado?.anioLectivo).toBe("2026");
        const estudiantesOrigen = await prisma.estudiante.count({ where: { cursoId: curso.id } });
        expect(estudiantesOrigen).toBe(1);
    });
});
