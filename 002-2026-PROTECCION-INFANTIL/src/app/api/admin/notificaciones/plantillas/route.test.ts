/**
 * SPEC-202 (002-PI-099): tests de integración del GET /api/admin/notificaciones/plantillas.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/notificaciones/plantillas";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearPlantilla(data: {
    clave?: string;
    canal?: "EMAIL" | "IN_APP";
    asunto?: string;
    cuerpoMarkdown?: string;
    activa?: boolean;
}) {
    return prisma.notificacionPlantilla.create({
        data: {
            clave: data.clave ?? `test.plantilla.${Date.now()}`,
            canal: data.canal ?? "EMAIL",
            asunto: data.asunto ?? "Asunto de prueba",
            cuerpoMarkdown: data.cuerpoMarkdown ?? "Cuerpo de **prueba**",
            activa: data.activa ?? true,
        },
    });
}

describe("GET /api/admin/notificaciones/plantillas (SPEC-202)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("devuelve todas las plantillas activas e inactivas", async () => {
        await autenticarAdmin();
        await crearPlantilla({ clave: "activa.email", activa: true });
        await crearPlantilla({ clave: "inactiva.email", activa: false });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(2);
        const claves = body.items.map((p: { clave: string }) => p.clave).sort();
        expect(claves).toEqual(["activa.email", "inactiva.email"]);
    });

    it("no expone cuerpoMarkdown completo en la lista (solo metadatos admin)", async () => {
        await autenticarAdmin();
        await crearPlantilla({ clave: "segura.email", cuerpoMarkdown: "contenido privado" });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items[0]).toHaveProperty("cuerpoMarkdown");
        expect(body.items[0].clave).toBe("segura.email");
    });
});
