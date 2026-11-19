/**
 * SPEC-931 · CANDADO (integración, BD real) — Usuarios → Estudiantes.
 *
 *   (1) PERTENENCIA: el rector del colegio A NO ve estudiantes del B — ni en el listado, ni pidiendo el
 *       `cursoId` de un curso del B. Control positivo: el rector del B SÍ ve los suyos (la ausencia en
 *       A no es una consulta rota).
 *   (2) MÓDULO: con `colegios_gestion` APAGADO para SCHOOL_ADMIN, la PÁGINA rinde `SinAccesoModulo` Y la
 *       API responde 403 — el MISMO estado de BD cierra las dos superficies (esconder el menú no cierra
 *       la pantalla). Control positivo: con el módulo activo, página = listado y API = 200. La guardia
 *       de la página corre DE VERDAD (`verificarAccesoPagina` contra la BD), no mockeada.
 *   (3) CONTENIDO: conteos de identificadores y acudientes ACTIVOS (los inactivos no cuentan), estudiante
 *       inactivo fuera, búsqueda por palabras que cruza nombre + apellidos, filtro por curso, paginación,
 *       DTO EXACTO (sin documento ni contactos) y validación de la consulta.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import EstudiantesPage from "@/app/dashboard/colegio/estudiantes/page";
import EstudiantesPageClient from "@/app/dashboard/colegio/estudiantes/EstudiantesPageClient";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearAcudienteEstudiante,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearTokenUsuario,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

const BASE = "http://localhost:5005/api/colegio/estudiantes";

interface RespuestaListado {
    items: Array<{
        id: string;
        nombre: string;
        curso: { id: string; nombre: string };
        identificadoresActivos: number;
        acudientes: number;
    }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

async function listar(query = ""): Promise<{ status: number; json: RespuestaListado }> {
    const res = await GET(new Request(`${BASE}${query}`, { method: "GET" }));
    return { status: res.status, json: (await res.json()) as RespuestaListado };
}

/** Un colegio con su rector logueado y un curso. */
async function colegioConCurso(nombreCurso: string) {
    const { admin, colegio } = await crearColegioConAdmin();
    const curso = await crearCurso(colegio.id, { nombre: nombreCurso });
    return { admin, colegio, curso };
}

async function apagarModuloGestion(activo: boolean) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "colegios_gestion" } });
    expect(modulo, "el módulo colegios_gestion debería estar sembrado").not.toBeNull();
    await prisma.permisoModulo.upsert({
        where: { rol_moduloId: { rol: "SCHOOL_ADMIN", moduloId: modulo!.id } },
        update: { activo },
        create: { rol: "SCHOOL_ADMIN", moduloId: modulo!.id, activo },
    });
}

describe("SPEC-931 · GET /api/colegio/estudiantes + página", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("(1) PERTENENCIA: el rector de A no ve estudiantes de B (control positivo: B sí los ve)", async () => {
        const a = await colegioConCurso("Sexto A");
        const b = await colegioConCurso("Sexto B");
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Ana", apellidos: "DelColegioA" });
        await crearEstudiante(b.curso.id, b.colegio.id, { nombre: "Bruno", apellidos: "DelColegioB" });

        mockToken = await crearTokenUsuario(a.admin.id, "SCHOOL_ADMIN");
        const deA = await listar();
        expect(deA.status).toBe(200);
        expect(deA.json.items.map((e: { nombre: string }) => e.nombre)).toEqual(["Ana DelColegioA"]);

        // El filtro del cliente NO abre otro colegio: el curso de B, pedido por el rector de A, da vacío.
        const conCursoAjeno = await listar(`?cursoId=${b.curso.id}`);
        expect(conCursoAjeno.status).toBe(200);
        expect(conCursoAjeno.json.items).toEqual([]);
        expect(conCursoAjeno.json.pagination.total).toBe(0);

        // Control positivo: la consulta funciona — el rector de B ve al suyo.
        mockToken = await crearTokenUsuario(b.admin.id, "SCHOOL_ADMIN");
        const deB = await listar();
        expect(deB.json.items.map((e: { nombre: string }) => e.nombre)).toEqual(["Bruno DelColegioB"]);
    });

    it("(2) MÓDULO: sin colegios_gestion → página SinAccesoModulo Y API 403 (control positivo: con módulo, ambas abren)", async () => {
        const a = await colegioConCurso("Séptimo");
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Carla" });
        mockToken = await crearTokenUsuario(a.admin.id, "SCHOOL_ADMIN");

        // Control positivo: con el módulo activo, la página rinde el listado y la API responde.
        await apagarModuloGestion(true);
        expect((await EstudiantesPage()).type).toBe(EstudiantesPageClient);
        expect((await listar()).status).toBe(200);

        // El MISMO estado de BD cierra las dos superficies.
        await apagarModuloGestion(false);
        expect((await EstudiantesPage()).type, "la página debe cerrarse sola, no por el menú").toBe(SinAccesoModulo);
        expect((await listar()).status).toBe(403);
    });

    it("(2b) sin sesión → la página no abre y la API no responde datos", async () => {
        mockToken = undefined;
        expect((await EstudiantesPage()).type).toBe(SinAccesoModulo);
        expect((await listar()).status).toBe(401);
    });

    it("(3) conteos ACTIVOS, estudiante inactivo fuera y DTO exacto (sin documento ni contactos)", async () => {
        const a = await colegioConCurso("Octavo");
        mockToken = await crearTokenUsuario(a.admin.id, "SCHOOL_ADMIN");
        const conTodo = await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Diego", apellidos: "Alba", documentoNumero: "DOC-SECRETO-1" });
        await crearIdentificadorEstudiante(conTodo.id, { valor: "diego_1" });
        await crearIdentificadorEstudiante(conTodo.id, { valor: "diego_2" });
        await crearIdentificadorEstudiante(conTodo.id, { valor: "diego_viejo", estado: "inactivo" });
        await crearAcudienteEstudiante(conTodo.id, { orden: 1, nombre: "Mamá de Diego", telefono: "+573000000001" });
        await crearAcudienteEstudiante(conTodo.id, { orden: 2, nombre: "Ex acudiente", estado: "inactivo" });
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Elena", apellidos: "Bravo" });
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Retirado", apellidos: "Zeta", estado: "inactivo" });

        const r = await listar();
        expect(r.status).toBe(200);
        expect(r.json.items).toEqual([
            { id: conTodo.id, nombre: "Diego Alba", curso: { id: a.curso.id, nombre: "Octavo" }, identificadoresActivos: 2, acudientes: 1 },
            { id: expect.any(String), nombre: "Elena Bravo", curso: { id: a.curso.id, nombre: "Octavo" }, identificadoresActivos: 0, acudientes: 0 },
        ]);
        // Nada sensible en la respuesta: ni el documento, ni el teléfono del acudiente, ni el valor del identificador.
        const crudo = JSON.stringify(r.json);
        for (const sensible of ["DOC-SECRETO-1", "+573000000001", "diego_1", "documento"]) expect(crudo).not.toContain(sensible);
    });

    it("(3b) búsqueda por palabras (cruza nombre + apellidos, sin mayúsculas), filtro por curso y paginación", async () => {
        const a = await colegioConCurso("Noveno A");
        const otroCurso = await crearCurso(a.colegio.id, { nombre: "Noveno B" });
        mockToken = await crearTokenUsuario(a.admin.id, "SCHOOL_ADMIN");
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Juan", apellidos: "Pérez Gómez" });
        await crearEstudiante(a.curso.id, a.colegio.id, { nombre: "Juana", apellidos: "Ríos" });
        await crearEstudiante(otroCurso.id, a.colegio.id, { nombre: "Pedro", apellidos: "Pérez" });

        const cruzada = await listar(`?q=${encodeURIComponent("juan pérez")}`);
        expect(cruzada.json.items.map((e: { nombre: string }) => e.nombre)).toEqual(["Juan Pérez Gómez"]);

        const porApellido = await listar(`?q=${encodeURIComponent("PÉREZ")}`);
        expect(porApellido.json.items.map((e: { nombre: string }) => e.nombre).sort()).toEqual(["Juan Pérez Gómez", "Pedro Pérez"]);

        const porCurso = await listar(`?cursoId=${otroCurso.id}`);
        expect(porCurso.json.items.map((e: { nombre: string }) => e.nombre)).toEqual(["Pedro Pérez"]);

        const pagina2 = await listar("?pageSize=2&page=2");
        expect(pagina2.json.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(pagina2.json.items).toHaveLength(1);

        // Vacío = ausente (el «Todos los cursos» y una búsqueda en blanco del cliente).
        expect((await listar("?q=&cursoId=")).json.pagination.total).toBe(3);
    });

    it("(3c) consulta inválida → 400 (pageSize > 100, cursoId que no es id)", async () => {
        const a = await colegioConCurso("Décimo");
        mockToken = await crearTokenUsuario(a.admin.id, "SCHOOL_ADMIN");
        expect((await listar("?pageSize=500")).status).toBe(400);
        expect((await listar("?cursoId=no-es-un-id")).status).toBe(400);
    });
});
