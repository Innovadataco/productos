/**
 * SPEC-202 (002-PI-099): tests de integración del GET /api/admin/notificaciones/salud.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/notificaciones/salud";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearNotificacionEnviada(enviarEn: Date, sentAt: Date) {
    return prisma.notificacion.create({
        data: {
            evento: "test.evento",
            destinatarioEmail: "test@example.com",
            plantillaClave: "test.plantilla.email",
            canal: "EMAIL",
            estado: "ENVIADA",
            enviarEn,
            sentAt,
            variables: {},
        },
    });
}

describe("GET /api/admin/notificaciones/salud (SPEC-202)", () => {
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

    it("devuelve métricas del motor", async () => {
        await autenticarAdmin();
        await prisma.parametroSistema.create({
            data: {
                clave: "notificaciones.worker.intervalo_segundos",
                valor: "15",
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
            },
        });

        const ahora = new Date();
        await crearNotificacionEnviada(ahora, ahora);

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("colaActual");
        expect(body).toHaveProperty("tasaEntrega7d");
        expect(body).toHaveProperty("tasaApertura7d");
        expect(body).toHaveProperty("atrasadas");
        expect(body).toHaveProperty("latenciaPromedioMs");
        expect(body).toHaveProperty("errores24h");
        expect(body.intervaloSegundos).toBe(15);
    });
});
