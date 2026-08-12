import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHMateria } from "./[id]/route";
import { PATCH as PATCHEstadoMateria } from "./[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearUsuario } from "@/lib/reporte-test-utils";
import { MateriaRepository } from "@/lib/dal/repositories/materia";

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

describe("/api/colegio/materias", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN crea y lista materias de su colegio", async () => {
        const { colegio } = await setupSchoolAdmin();

        const postRes = await POST(request("POST", "http://localhost:5005/api/colegio/materias", { nombre: "Matemáticas" }, mockToken));
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.materia.nombre).toBe("Matemáticas");
        expect(postJson.materia.colegioId).toBe(colegio.id);
        expect(postJson.materia.estado).toBe("activo");

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/materias", undefined, mockToken));
        expect(getRes.status).toBe(200);
        const getJson = await getRes.json();
        expect(getJson.materias).toHaveLength(1);
        expect(getJson.materias[0].nombre).toBe("Matemáticas");
    });

    it("rechaza crear materia con nombre duplicado en el mismo colegio", async () => {
        await setupSchoolAdmin();

        await POST(request("POST", "http://localhost:5005/api/colegio/materias", { nombre: "Física" }, mockToken));
        const res = await POST(request("POST", "http://localhost:5005/api/colegio/materias", { nombre: "física" }, mockToken));

        expect(res.status).toBe(409);
    });

    it("SCHOOL_ADMIN edita una materia propia", async () => {
        const { admin } = await setupSchoolAdmin();
        const repo = new MateriaRepository();
        const materia = await repo.crear(admin.colegioId!, "Historia");

        const res = await PATCHMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}`, { nombre: "Historia Universal" }, mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.materia.nombre).toBe("Historia Universal");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_MATERIA_EDITADA", recursoId: materia.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva y reactiva una materia propia", async () => {
        const { admin } = await setupSchoolAdmin();
        const repo = new MateriaRepository();
        const materia = await repo.crear(admin.colegioId!, "Arte");

        const resDes = await PATCHEstadoMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );
        expect(resDes.status).toBe(200);
        expect((await resDes.json()).materia.estado).toBe("inactivo");

        const resReac = await PATCHEstadoMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}/estado`, "activo", mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );
        expect(resReac.status).toBe(200);
        expect((await resReac.json()).materia.estado).toBe("activo");
    });

    it("rechaza desactivar una materia ya inactiva", async () => {
        const { admin } = await setupSchoolAdmin();
        const repo = new MateriaRepository();
        const materia = await repo.crear(admin.colegioId!, "Música");
        await repo.cambiarEstado(admin.colegioId!, materia.id, "inactivo");

        const res = await PATCHEstadoMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("SCHOOL_ADMIN de otro colegio no ve ni muta materias ajenas", async () => {
        const { admin: admin1 } = await setupSchoolAdmin();
        const repo = new MateriaRepository();
        const materia = await repo.crear(admin1.colegioId!, "Ajena");

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/materias", undefined, mockToken));
        expect((await getRes.json()).materias).toHaveLength(0);

        const patchRes = await PATCHMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}`, { nombre: "Hackeada" }, mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );
        expect(patchRes.status).toBe(404);

        const patchEstadoRes = await PATCHEstadoMateria(
            request("PATCH", `http://localhost:5005/api/colegio/materias/${materia.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: materia.id }) }
        );
        expect(patchEstadoRes.status).toBe(404);
    });

    it("ADMIN no puede acceder a /api/colegio/materias", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/materias", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("PARENT no puede acceder a /api/colegio/materias", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/materias", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("SCHOOL_ADMIN con colegio vencido recibe 403", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { finServicio: ayer },
        });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/materias", undefined, mockToken));
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
    });
});
