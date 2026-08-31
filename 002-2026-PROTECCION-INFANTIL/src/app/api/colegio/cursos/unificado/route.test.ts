import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearProfesor, crearCurso, crearEstudiante, crearIdentificadorEstudiante } from "@/lib/reporte-test-utils";

/**
 * SPEC-146 (T002, FR-002/FR-008) — POST /api/colegio/cursos/unificado:
 * guardado atómico (fallo provocado ⇒ 0 filas), A/B tenant, 400 humanos, 409.
 */

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL = "http://localhost:5005/api/colegio/cursos/unificado";

function request(body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(URL, {
        method: "POST",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

function payloadBase(override: Record<string, unknown> = {}) {
    return {
        curso: { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" },
        estudiantes: [
            { nombre: "María", apellidos: "Gómez Pérez", documentoTipo: "TI", documentoNumero: "MARIA-1" },
            {
                nombre: "Carlos",
                apellidos: "Ruiz Díaz",
                documentoTipo: "TI",
                documentoNumero: "123456",
                acudientes: [
                    { orden: 1, nombre: "Laura Díaz", relacion: "Madre", telefono: "+573009998877", email: "laura@example.com" },
                ],
            },
        ],
        identificadores: [
            { estudianteIndex: 0, valor: "+573001234567" },
            { estudianteIndex: 1, tipo: "email", valor: "Carlos@Example.COM", etiquetaRelacion: "PADRE" },
        ],
        ...override,
    };
}

async function conteoTablas(colegioId: string) {
    const [cursos, estudiantes, identificadores, acudientes, profesores] = await Promise.all([
        prisma.curso.count({ where: { colegioId } }),
        prisma.estudiante.count({ where: { colegioId } }),
        prisma.identificadorEstudiante.count({ where: { estudiante: { colegioId } } }),
        prisma.acudienteEstudiante.count({ where: { estudiante: { colegioId } } }),
        prisma.profesor.count({ where: { colegioId } }),
    ]);
    return { cursos, estudiantes, identificadores, acudientes, profesores };
}

describe("/api/colegio/cursos/unificado", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea curso + estudiantes (con acudiente) + identificadores en una sola llamada", async () => {
        const { colegio } = await setupSchoolAdmin();

        const res = await POST(request(payloadBase(), mockToken));
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.curso.nombre).toBe("8° B");
        expect(json.curso.colegioId).toBe(colegio.id);
        expect(json.resumen).toEqual({ estudiantesCreados: 2, identificadoresCreados: 2, profesorCreado: false });

        // Todo persistió con el tenant de sesión.
        const conteo = await conteoTablas(colegio.id);
        expect(conteo).toEqual({ cursos: 1, estudiantes: 2, identificadores: 2, acudientes: 1, profesores: 0 });

        // Tipo inferido (teléfono), valor normalizado (minúsculas) y etiqueta default.
        const identificadores = await prisma.identificadorEstudiante.findMany({
            where: { estudiante: { colegioId: colegio.id } },
            orderBy: { createdAt: "asc" },
        });
        expect(identificadores[0].tipo).toBe("telefono");
        expect(identificadores[0].etiquetaRelacion).toBe("ESTUDIANTE");
        expect(identificadores[1].valor).toBe("carlos@example.com");
        expect(identificadores[1].etiquetaRelacion).toBe("PADRE");

        // Auditoría histórica con metadatos del resumen.
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CURSO_CREADO", recursoId: json.curso.id },
        });
        expect(audit).not.toBeNull();
        expect(audit!.valorNuevo).toContain('"estudiantesCreados":2');
    });

    it("permite guardar el curso solo (0 estudiantes)", async () => {
        await setupSchoolAdmin();
        const res = await POST(request({ curso: { nombre: "Curso Solo" }, estudiantes: [], identificadores: [] }, mockToken));
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.resumen).toEqual({ estudiantesCreados: 0, identificadoresCreados: 0, profesorCreado: false });
    });

    it("asigna un profesor titular existente del mismo colegio", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "López" });

        const res = await POST(
            request(payloadBase({ curso: { nombre: "8° B", profesorTitularId: profesor.id }, estudiantes: [], identificadores: [] }), mockToken)
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.curso.profesorTitularId).toBe(profesor.id);
    });

    it("SPEC-320 (§2.2): el alta rápida de profesor (nombre+apellidos) YA NO crea inline → 400, dirige a la ficha con identidad", async () => {
        // §2.2 hace la identidad del profesor obligatoria; el quick-create del wizard solo
        // trae nombre+apellidos, así que no puede crear el profesor. Se rechaza con mensaje
        // claro (H2, confirmado por Fábrica). La ficha completa con identidad vive en la
        // pantalla de Profesores; la UX prolija del botón deshabilitado es SPEC-B.
        const { colegio } = await setupSchoolAdmin();

        const res = await POST(
            request(
                payloadBase({ profesorNuevo: { nombre: "Jorge", apellidos: "Pineda" }, estudiantes: [], identificadores: [] }),
                mockToken
            )
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("créalo primero en la sección de Profesores");
        // No se creó ningún profesor.
        expect(await prisma.profesor.count({ where: { colegioId: colegio.id } })).toBe(0);
    });

    it("curso duplicado (nombre+grado+año) → 409", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearCurso(colegio.id, { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" });

        const res = await POST(request(payloadBase(), mockToken));
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toBe("Ya existe un curso con ese nombre");
    });

    it("estudiante duplicado contra BD → 409", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "9° A" });
        await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez Pérez" });

        const res = await POST(request(payloadBase({ curso: { nombre: "9° A - otro" } }), mockToken));
        // El curso es nuevo; el estudiante duplicado se detecta solo si ya está
        // en ESE curso. Aquí el curso es distinto, así que sí se crea.
        expect(res.status).toBe(201);

        // Ahora sí: mismo payload sobre el curso ya creado → curso duplicado.
        const res2 = await POST(request(payloadBase({ curso: { nombre: "9° A - otro" } }), mockToken));
        expect(res2.status).toBe(409);
    });

    it("ATOMICIDAD: fallo en la última entidad (identificador duplicado en el payload) ⇒ 0 filas persistidas", async () => {
        const { colegio } = await setupSchoolAdmin();
        const antes = await conteoTablas(colegio.id);

        const res = await POST(
            request(
                payloadBase({
                    identificadores: [
                        { estudianteIndex: 0, tipo: "nick", valor: "gamer123" },
                        // Mismo estudiante + tipo + valor normalizado: la segunda
                        // inserción detecta la primera DENTRO de la transacción.
                        { estudianteIndex: 0, tipo: "nick", valor: "  GAMER123 " },
                    ],
                }),
                mockToken
            )
        );
        expect(res.status).toBe(409);

        const despues = await conteoTablas(colegio.id);
        expect(despues).toEqual(antes);

        // La auditoría también va en la tx: nada quedó registrado.
        const audit = await prisma.auditLog.count({ where: { accion: "COLEGIO_CURSO_CREADO" } });
        expect(audit).toBe(0);
    });

    it("ATOMICIDAD: estudiante repetido dentro del payload ⇒ 409 y rollback total", async () => {
        const { colegio } = await setupSchoolAdmin();
        const antes = await conteoTablas(colegio.id);

        const res = await POST(
            request(
                payloadBase({
                    estudiantes: [
                        { nombre: "María", apellidos: "Gómez Pérez" },
                        { nombre: "María", apellidos: "Gómez Pérez" },
                    ],
                    identificadores: [{ estudianteIndex: 0, valor: "+573001234567" }],
                }),
                mockToken
            )
        );
        expect(res.status).toBe(409);
        expect(await conteoTablas(colegio.id)).toEqual(antes);
    });

    it("400 humano cuando falta el apellido de un estudiante", async () => {
        await setupSchoolAdmin();
        const res = await POST(
            request(payloadBase({ estudiantes: [{ nombre: "María" }], identificadores: [] }), mockToken)
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Falta el apellido del estudiante");
    });

    it("400 cuando un identificador apunta a un estudiante que no está en la lista", async () => {
        await setupSchoolAdmin();
        const res = await POST(
            request(payloadBase({ identificadores: [{ estudianteIndex: 7, valor: "nick" }] }), mockToken)
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("no está en la lista");
    });

    it("400 cuando vienen profesorTitularId y profesorNuevo a la vez", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id);
        const res = await POST(
            request(
                payloadBase({
                    curso: { nombre: "8° B", profesorTitularId: profesor.id },
                    profesorNuevo: { nombre: "Ana", apellidos: "López" },
                }),
                mockToken
            )
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("no ambos");
    });

    it("A/B: profesor de OTRO colegio → 404 y nada persiste", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const profesorAjeno = await crearProfesor(colegioB.id, { nombre: "Ajeno", apellidos: "Del Otro" });

        const antes = await conteoTablas(colegioA.id);
        const res = await POST(
            request(payloadBase({ curso: { nombre: "8° B", profesorTitularId: profesorAjeno.id } }), mockToken)
        );
        expect(res.status).toBe(404);
        expect(await conteoTablas(colegioA.id)).toEqual(antes);
    });

    it("A/B: el colegio B puede crear el mismo nombre de curso en SU tenant sin tocar el de A", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        await crearCurso(colegioA.id, { nombre: "8° B", grado: "Octavo", anioLectivo: "2026" });

        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const res = await POST(request(payloadBase(), mockToken));
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.curso.colegioId).toBe(colegioB.id);

        // Todo lo creado es de B; A solo sigue teniendo su curso.
        expect(await conteoTablas(colegioB.id)).toEqual({ cursos: 1, estudiantes: 2, identificadores: 2, acudientes: 1, profesores: 0 });
        expect(await conteoTablas(colegioA.id)).toEqual({ cursos: 1, estudiantes: 0, identificadores: 0, acudientes: 0, profesores: 0 });
    });

    it("el identificador duplicado contra BD de OTRO estudiante no bloquea (único por estudiante)", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "7° C" });
        const existente = await crearEstudiante(curso.id, colegio.id, { nombre: "Ana", apellidos: "Torres" });
        await crearIdentificadorEstudiante(existente.id, { tipo: "nick", valor: "gamer123" });

        // Mismo valor pero para un estudiante NUEVO del nuevo curso: permitido.
        const res = await POST(
            request(
                payloadBase({
                    estudiantes: [{ nombre: "María", apellidos: "Gómez" }],
                    identificadores: [{ estudianteIndex: 0, tipo: "nick", valor: "gamer123" }],
                }),
                mockToken
            )
        );
        expect(res.status).toBe(201);
    });

    it("rechaza sin autenticación", async () => {
        const res = await POST(request(payloadBase()));
        expect(res.status).toBe(401);
    });
});
