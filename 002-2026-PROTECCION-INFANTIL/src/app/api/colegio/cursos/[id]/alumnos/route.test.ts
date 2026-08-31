import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHAlumno } from "@/app/api/colegio/alumnos/[id]/route";
import { PATCH as PATCHEstadoEstudiante } from "@/app/api/colegio/alumnos/[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearCurso, crearEstudiante } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/cursos/[id]/alumnos", () => {
    beforeEach(async () => {
        await resetDatabase();
        // SPEC-320 (§2.3): el alta de alumno valida documentoTipo contra el catálogo.
        for (const clave of ["RC", "TI", "CC", "CE", "PASAPORTE", "OTRO"]) {
            await prisma.tipoDocumento.upsert({ where: { clave }, update: {}, create: { clave, nombre: clave } });
        }
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN lista solo alumnos activos del curso", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        await crearEstudiante(curso.id, admin.colegioId!, { nombre: "Activo" });
        await crearEstudiante(curso.id, admin.colegioId!, { nombre: "Inactivo", estado: "inactivo" });

        const res = await GET(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, undefined, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumnos).toHaveLength(1);
        expect(json.alumnos[0].nombre).toBe("Activo");
    });

    it("SCHOOL_ADMIN edita un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const res = await PATCHAlumno(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}`, { nombre: "María Gómez Torres" }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumno.nombre).toBe("María Gómez Torres");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ALUMNO_EDITADO", recursoId: alumno.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "Carlos Ruiz" });

        const res = await PATCHEstadoEstudiante(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumno.estado).toBe("inactivo");
    });

    it("SCHOOL_ADMIN de otro colegio no puede crear alumnos en curso ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(colegio2.id, { nombre: "Curso Ajeno" });

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${otroCurso.id}/alumnos`, { nombre: "Intruso", apellidos: "X", documentoTipo: "TI", documentoNumero: "INTRUSO-1" }, mockToken),
            { params: Promise.resolve({ id: otroCurso.id }) }
        );

        expect(res.status).toBe(404);
    });

    it("SPEC-144 (FR-010): el alta sin apellidos responde 400 con mensaje humano y NO crea nada", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, { nombre: "Sin Apellido" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Falta el apellido del estudiante");
        expect(await prisma.estudiante.count({ where: { cursoId: curso.id } })).toBe(0);
    });

    it("SPEC-320 (§2.3): documentoTipo que no está en el catálogo responde 400", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });

        // "NIT" no se sembró en el catálogo de este test → inválido para alumno.
        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`,
                { nombre: "Ana", apellidos: "Pérez", documentoTipo: "NIT", documentoNumero: "999" },
                mockToken
            ),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Tipo de documento inválido o inactivo");
    });

    it("SPEC-320 (§2.2-bis): alta de alumno sin documento responde 400", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, { nombre: "Ana", apellidos: "Pérez" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("SPEC-144 (FR-007): 3 acudientes responden 400; con 2 se persisten en la misma escritura", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const acudiente = { orden: 1, nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233" };

        const resMalo = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`,
                { nombre: "Ana", apellidos: "Pérez", documentoTipo: "TI", documentoNumero: "AC-MALO", acudientes: [acudiente, { ...acudiente, orden: 2 }, { ...acudiente, orden: 1, nombre: "Extra" }] },
                mockToken
            ),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(resMalo.status).toBe(400);
        const jsonMalo = await resMalo.json();
        expect(jsonMalo.error.message).toContain("Máximo 2 acudientes");

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`,
                {
                    nombre: "Ana",
                    apellidos: "Pérez",
                    documentoTipo: "TI",
                    documentoNumero: "1020304050",
                    acudientes: [acudiente, { orden: 2, nombre: "Juan Pérez", relacion: "padre" }],
                },
                mockToken
            ),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.alumno.apellidos).toBe("Pérez");
        expect(json.alumno.documentoTipo).toBe("TI");
        // D1: los acudientes se leen SOLO a través del estudiante acotado por colegio.
        const acudientes = await prisma.acudienteEstudiante.findMany({
            where: { estudiante: { id: json.alumno.id, colegioId: admin.colegioId! } },
            orderBy: { orden: "asc" },
        });
        expect(acudientes.map((a) => [a.orden, a.nombre, a.relacion])).toEqual([
            [1, "Marta Torres", "madre"],
            [2, "Juan Pérez", "padre"],
        ]);

        // La auditoría conserva la acción histórica e incluye apellidos (contracts).
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ALUMNO_CREADO", tipoRecurso: "Alumno", recursoId: json.alumno.id },
        });
        expect(audit).not.toBeNull();
        expect(audit!.valorNuevo).toContain("Pérez");
    });

    it("SCHOOL_ADMIN de otro colegio no puede editar alumno ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "Propio" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHAlumno(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}`, { nombre: "Hackeado" }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(404);
    });
});
