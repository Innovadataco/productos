/**
 * SPEC-202 (002-PI-099): tests de integración del GET /api/admin/notificaciones/reglas.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/notificaciones/reglas";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearRegla(data: {
    evento?: string;
    rol?: string;
    offset?: string;
    canal?: "EMAIL" | "IN_APP";
    plantillaClave?: string;
    obligatoria?: boolean;
    activa?: boolean;
}) {
    return prisma.notificacionRegla.create({
        data: {
            evento: data.evento ?? "test.evento",
            rol: data.rol ?? "ADMIN",
            offset: data.offset ?? "+1h",
            canal: data.canal ?? "EMAIL",
            plantillaClave: data.plantillaClave ?? "test.plantilla",
            obligatoria: data.obligatoria ?? false,
            activa: data.activa ?? true,
        },
    });
}

describe("GET /api/admin/notificaciones/reglas (SPEC-202)", () => {
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

    it("devuelve reglas activas e inactivas con conteo de programadas", async () => {
        await autenticarAdmin();
        await crearRegla({ evento: "evento.a", activa: true });
        await crearRegla({ evento: "evento.b", activa: false });
        await prisma.notificacion.create({
            data: {
                evento: "evento.a",
                destinatarioEmail: "test@example.com",
                plantillaClave: "test.plantilla",
                canal: "EMAIL",
                estado: "ENCOLADA",
                enviarEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
                variables: {},
            },
        });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(2);
        const reglaA = body.items.find((r: { evento: string }) => r.evento === "evento.a");
        expect(reglaA.programadas).toBe(1);
        const reglaB = body.items.find((r: { evento: string }) => r.evento === "evento.b");
        expect(reglaB.programadas).toBe(0);
    });
});
