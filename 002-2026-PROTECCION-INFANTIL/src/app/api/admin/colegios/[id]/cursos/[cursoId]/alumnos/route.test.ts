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
    crearIdentificadorAlumno,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { findAuditNuevaAccion, ACCION_COLEGIO_ROSTER_ACCESO_ADMIN } from "@/lib/audit-nuevas-acciones";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getAlumnos(colegioId: string, cursoId: string, query = ""): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(
        new Request(`http://localhost:5005/api/admin/colegios/${colegioId}/cursos/${cursoId}/alumnos${query}`, { headers }),
        { params: Promise.resolve({ id: colegioId, cursoId }) }
    );
}

describe("GET /api/admin/colegios/[id]/cursos/[cursoId]/alumnos (SPEC-141, N-1)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token; 403 para SCHOOL_ADMIN de OTRO colegio y para OPERADOR", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "Séptimo A" });
        expect((await getAlumnos(colegio.id, curso.id)).status).toBe(401);

        const otro = await crearColegioConAdmin();
        activeToken = await crearTokenUsuario(otro.admin.id, "SCHOOL_ADMIN");
        expect((await getAlumnos(colegio.id, curso.id)).status).toBe(403);

        const operador = await crearUsuario("OPERADOR");
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");
        expect((await getAlumnos(colegio.id, curso.id)).status).toBe(403);
    });

    it("200: alumnos con identificadores (tipo, valor, plataforma, etiqueta) + UNA fila de auditoría sin PII", async () => {
        const admin = await crearUsuario("ADMIN");
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "Séptimo A" });
        const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "Alumno Roster" });
        await crearIdentificadorAlumno(alumno.id, {
            tipo: "telefono",
            valor: "+573007654321",
            plataformaId: plataforma.id,
            etiquetaRelacion: "ALUMNO",
        });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getAlumnos(colegio.id, curso.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({ nombre: "Alumno Roster", estado: "activo" });
        expect(body.items[0].identificadores).toHaveLength(1);
        expect(body.items[0].identificadores[0]).toMatchObject({
            tipo: "telefono",
            valor: "+573007654321",
            etiquetaRelacion: "ALUMNO",
        });
        expect(body.items[0].identificadores[0].plataforma.nombre).toBe("WhatsApp");
        expect(body.pagination).toMatchObject({ page: 1, pageSize: 25, total: 1, totalPages: 1 });

        // US3: exactamente una fila AuditLog del acceso al roster, sin nombres ni valores.
        const eventos = await findAuditNuevaAccion(ACCION_COLEGIO_ROSTER_ACCESO_ADMIN, { recursoId: colegio.id });
        expect(eventos).toHaveLength(1);
        expect(eventos[0].usuarioId).toBe(admin.id);
        const metadatos = JSON.stringify(eventos[0].metadatos);
        expect(eventos[0].metadatos).toMatchObject({ cursoId: curso.id, page: 1 });
        expect(metadatos).not.toContain("Alumno Roster");
        expect(metadatos).not.toContain("+573007654321");
    });

    it("pagina con page/pageSize y rechaza pageSize>100", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "Séptimo A" });
        for (let i = 1; i <= 3; i++) {
            await crearAlumno(curso.id, colegio.id, { nombre: `Alumno ${String(i).padStart(2, "0")}` });
        }
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const pagina2 = await (await getAlumnos(colegio.id, curso.id, "?page=2&pageSize=2")).json();
        expect(pagina2.items).toHaveLength(1);
        expect(pagina2.pagination).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });

        expect((await getAlumnos(colegio.id, curso.id, "?pageSize=101")).status).toBe(400);
    });

    it("404 si el curso no pertenece al colegio de la ruta (no oráculo entre tenants) y NO audita", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        const otro = await crearColegioConAdmin();
        const cursoAjeno = await crearCurso(otro.colegio.id, { nombre: "Curso Ajeno" });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        expect((await getAlumnos(colegio.id, cursoAjeno.id)).status).toBe(404);
        expect((await getAlumnos(colegio.id, "c".padEnd(25, "1"))).status).toBe(404);
        expect((await getAlumnos("c".padEnd(25, "1"), cursoAjeno.id)).status).toBe(404);

        const eventos = await findAuditNuevaAccion(ACCION_COLEGIO_ROSTER_ACCESO_ADMIN);
        expect(eventos).toHaveLength(0);
    });

    it("SC-004: la ruta NO exporta verbos de escritura", () => {
        const verbos = Object.keys(routeModule).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k));
        expect(verbos).toEqual([]);
    });
});
