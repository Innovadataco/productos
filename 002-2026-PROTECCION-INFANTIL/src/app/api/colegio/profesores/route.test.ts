/**
 * SPEC-145 (FR-005/006/007/008): tests de GET/POST /api/colegio/profesores.
 * A/B con dos colegios: B nunca ve ni alcanza lo de A. Baja = soft delete.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearUsuario, crearProfesor } from "@/lib/reporte-test-utils";

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

describe("/api/colegio/profesores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN crea un profesor y lo ve en su lista (201 + GET)", async () => {
        const { colegio } = await setupSchoolAdmin();

        const postRes = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "María", apellidos: "López", email: "maria@colegio.edu.co", telefono: "+573001112233" }, mockToken));
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.profesor.nombre).toBe("María");
        expect(postJson.profesor.apellidos).toBe("López");
        expect(postJson.profesor.estado).toBe("activo");
        expect(postJson.profesor.colegioId).toBe(colegio.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_PROFESOR_CREADO", recursoId: postJson.profesor.id },
        });
        expect(audit).not.toBeNull();

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        expect(getRes.status).toBe(200);
        const getJson = await getRes.json();
        expect(getJson.items).toHaveLength(1);
        expect(getJson.items[0].id).toBe(postJson.profesor.id);
        expect(getJson.pagination).toMatchObject({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it("el colegio B no ve los profesores del colegio A en la lista (A/B)", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        await crearProfesor(colegioA.id, { nombre: "María", apellidos: "López" });

        const { admin: adminB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        const getJson = await getRes.json();
        expect(getJson.items).toHaveLength(0);
        expect(getJson.pagination.total).toBe(0);
    });

    it("rechaza el alta sin apellidos con mensaje humano (400)", async () => {
        await setupSchoolAdmin();

        const res = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "María" }, mockToken));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Falta el apellido del profesor");
    });

    it("rechaza email mal formado (400)", async () => {
        await setupSchoolAdmin();

        const res = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "María", apellidos: "López", email: "no-es-email" }, mockToken));
        expect(res.status).toBe(400);
    });

    it("rechaza duplicado nombre + apellidos activo en el mismo colegio (409)", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "María", apellidos: "López" }, mockToken));
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toBe("Ya existe un profesor con ese nombre y apellidos");
    });

    it("un duplicado INACTIVO no bloquea el alta; el mismo nombre en OTRO colegio tampoco", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearProfesor(colegio.id, { nombre: "María", apellidos: "López", estado: "inactivo" });
        const { colegio: colegioB } = await crearColegioConAdmin();
        await crearProfesor(colegioB.id, { nombre: "Ana", apellidos: "Pérez" });

        const resInactivo = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "María", apellidos: "López" }, mockToken));
        expect(resInactivo.status).toBe(201);

        const resOtroColegio = await POST(request("POST", "http://localhost:5005/api/colegio/profesores", { nombre: "Ana", apellidos: "Pérez" }, mockToken));
        expect(resOtroColegio.status).toBe(201);
    });

    it("la lista por default solo muestra activos y el filtro estado los incluye", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearProfesor(colegio.id, { nombre: "Activo", apellidos: "Uno" });
        await crearProfesor(colegio.id, { nombre: "Inactivo", apellidos: "Dos", estado: "inactivo" });

        const defRes = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        const defJson = await defRes.json();
        expect(defJson.items).toHaveLength(1);
        expect(defJson.items[0].nombre).toBe("Activo");

        const todosRes = await GET(request("GET", "http://localhost:5005/api/colegio/profesores?estado=todos", undefined, mockToken));
        const todosJson = await todosRes.json();
        expect(todosJson.items).toHaveLength(2);

        const inactivosRes = await GET(request("GET", "http://localhost:5005/api/colegio/profesores?estado=inactivo", undefined, mockToken));
        const inactivosJson = await inactivosRes.json();
        expect(inactivosJson.items).toHaveLength(1);
        expect(inactivosJson.items[0].nombre).toBe("Inactivo");
    });

    it("pagina con page/pageSize", async () => {
        const { colegio } = await setupSchoolAdmin();
        for (const nombre of ["Uno", "Dos", "Tres"]) {
            await crearProfesor(colegio.id, { nombre, apellidos: "Pérez" });
        }

        const pagina1 = await (await GET(request("GET", "http://localhost:5005/api/colegio/profesores?pageSize=2", undefined, mockToken))).json();
        expect(pagina1.items).toHaveLength(2);
        expect(pagina1.pagination).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

        const pagina2 = await (await GET(request("GET", "http://localhost:5005/api/colegio/profesores?pageSize=2&page=2", undefined, mockToken))).json();
        expect(pagina2.items).toHaveLength(1);
        expect(pagina2.pagination.page).toBe(2);
    });

    it("ADMIN no puede acceder a /api/colegio/profesores", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("PARENT no puede acceder a /api/colegio/profesores", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("SCHOOL_ADMIN con colegio vencido recibe 403", async () => {
        const { colegio } = await setupSchoolAdmin();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/profesores", undefined, mockToken));
        expect(res.status).toBe(403);
    });
});
