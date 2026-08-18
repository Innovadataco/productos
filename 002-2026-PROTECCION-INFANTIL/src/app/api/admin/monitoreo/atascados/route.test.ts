import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { EstadoReporte } from "@prisma/client";

const URL = "http://localhost:5005/api/admin/monitoreo/atascados";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearReporte(estado: EstadoReporte, creadoEn: Date) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1e7)}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba del reporte atascado.",
            fechaIncidente: creadoEn,
            ciudad: "Bogotá",
            pais: "Colombia",
            estado,
            creadoEn,
        },
    });
}

describe("GET /api/admin/monitoreo/atascados (SPEC-171)", () => {
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

    it("403 con rol insuficiente", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("cuenta por estado solo los reportes más viejos que el umbral (24h por defecto)", async () => {
        await autenticarAdmin();
        const hace48h = new Date(Date.now() - 48 * 3_600_000);
        const hace1h = new Date(Date.now() - 1 * 3_600_000);

        await crearReporte("PENDIENTE", hace48h);
        await crearReporte("PROCESANDO", hace48h);
        await crearReporte("REVISION_MANUAL", hace48h);
        await crearReporte("REQUIERE_ANONIMIZACION", hace48h);
        await crearReporte("REQUIERE_ANONIMIZACION", hace48h);
        await crearReporte("PENDIENTE", hace1h); // reciente: NO atascado
        await crearReporte("CLASIFICADO", hace48h); // estado final: NO aplica

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.umbralHoras).toBe(24);
        expect(body.creadoAntesDe).toBeTruthy();
        expect(body.porEstado).toEqual({
            PENDIENTE: 1,
            PROCESANDO: 1,
            REVISION_MANUAL: 1,
            REQUIERE_ANONIMIZACION: 2,
        });
        expect(body.total).toBe(5);
    });

    it("respeta monitoreo.atascados.horas configurado", async () => {
        await autenticarAdmin();
        await prisma.parametroSistema.create({
            data: { clave: "monitoreo.atascados.horas", valor: "72", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
        });
        // 48h < 72h de umbral: ya no cuenta como atascado.
        await crearReporte("PENDIENTE", new Date(Date.now() - 48 * 3_600_000));

        const res = await GET(new Request(URL));
        const body = await res.json();

        expect(body.umbralHoras).toBe(72);
        expect(body.total).toBe(0);
        expect(body.porEstado.PENDIENTE).toBe(0);
    });
});
