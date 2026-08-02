import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import * as routeModule from "./route";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearAlumno,
} from "@/lib/reporte-test-utils";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getCursos(colegioId: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(new Request(`http://localhost:5005/api/admin/colegios/${colegioId}/cursos`, { headers }), {
        params: Promise.resolve({ id: colegioId }),
    });
}

async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

describe("GET /api/admin/colegios/[id]/cursos (SPEC-141, N-1)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token; 403 para SCHOOL_ADMIN (incluso el del propio colegio) y OPERADOR", async () => {
        const { colegio, admin: schoolAdmin } = await crearColegioConAdmin();
        expect((await getCursos(colegio.id)).status).toBe(401);

        activeToken = await crearTokenUsuario(schoolAdmin.id, "SCHOOL_ADMIN");
        expect((await getCursos(colegio.id)).status).toBe(403);

        const operador = await crearUsuario("OPERADOR");
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");
        expect((await getCursos(colegio.id)).status).toBe(403);
    });

    it("403 para ADMIN sin el módulo soporte_lectura", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "soporte_lectura");
        const { colegio } = await crearColegioConAdmin();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getCursos(colegio.id)).status).toBe(403);
    });

    it("404 si el colegio no existe", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getCursos("c".padEnd(25, "1"))).status).toBe(404);
    });

    it("200: cursos del colegio con conteo de alumnos", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        const cursoA = await crearCurso(colegio.id, { nombre: "Séptimo A", grado: "7", anioLectivo: "2026" });
        await crearCurso(colegio.id, { nombre: "Octavo B", grado: "8" });
        await crearAlumno(cursoA.id, colegio.id, { nombre: "Alumno Uno" });
        await crearAlumno(cursoA.id, colegio.id, { nombre: "Alumno Dos" });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getCursos(colegio.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.cursos).toHaveLength(2);
        const septimo = body.cursos.find((c: { nombre: string }) => c.nombre === "Séptimo A");
        expect(septimo).toMatchObject({ grado: "7", anioLectivo: "2026", estado: "activo", alumnos: 2 });
        const octavo = body.cursos.find((c: { nombre: string }) => c.nombre === "Octavo B");
        expect(octavo.alumnos).toBe(0);
    });

    it("200 con colegio sin cursos: lista vacía (no es error)", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getCursos(colegio.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.cursos).toEqual([]);
    });

    it("no expone cursos de OTRO colegio (aislamiento por tenant)", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        const otro = await crearColegioConAdmin();
        await crearCurso(otro.colegio.id, { nombre: "Curso Ajeno" });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getCursos(colegio.id);
        const body = await res.json();
        expect(JSON.stringify(body)).not.toContain("Curso Ajeno");
    });

    it("SC-004: la ruta NO exporta verbos de escritura", () => {
        const verbos = Object.keys(routeModule).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k));
        expect(verbos).toEqual([]);
    });
});
