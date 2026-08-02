import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET } from "./route";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearUsuario } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-mias-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

const TEXTO_SECRETO_REPORTE = "TEXTO DEL REPORTE QUE NUNCA DEBE VER EL APELANTE";

function crearRequestApelacion(plataformaId: string, identificador: string): Request {
    const boundary = `----miastest${Math.random().toString(36).slice(2)}`;
    const pdf = "%PDF-1.4\n" + "A".repeat(512);
    const parts = [
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"identificador\"",
        "",
        identificador,
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"plataformaId\"",
        "",
        plataformaId,
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"motivo\"",
        "",
        "Soy el titular y solicito la revisión de mi caso.",
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"documento\"; filename=\"evidencia.pdf\"",
        "Content-Type: application/pdf",
        "",
        pdf,
        `--${boundary}--`,
        "",
    ];
    return new Request("http://localhost:5005/api/apelaciones", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: parts.join("\r\n"),
    });
}

describe("GET /api/apelaciones/mias", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true });
        await prisma.$disconnect();
    });

    async function pid(): Promise<string> {
        const p = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        return p!.id;
    }

    async function crearReporteDelIdentificador(identificador: string, plataformaId: string) {
        return prisma.reporte.create({
            data: {
                identificador,
                plataformaId,
                texto: TEXTO_SECRETO_REPORTE,
                fechaIncidente: new Date("2026-07-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                estado: "CLASIFICADO",
            },
        });
    }

    it("devuelve N reportes asociados y NUNCA contenido de reportes (regla dura)", async () => {
        const user = await crearUsuario("PARENT");
        const plataformaId = await pid();
        await crearReporteDelIdentificador("+573009990002", plataformaId);
        await crearReporteDelIdentificador("+573009990002", plataformaId);
        const eliminado = await crearReporteDelIdentificador("+573009990002", plataformaId);
        await prisma.reporte.update({ where: { id: eliminado.id }, data: { eliminado: true } });

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(user);
        const resPost = await POST(crearRequestApelacion(plataformaId, "+573009990002"));
        expect(resPost.status).toBe(201);

        const res = await GET(new Request("http://localhost:5005/api/apelaciones/mias"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);

        const item = body.items[0];
        // Solo el conteo de reportes no eliminados (2 de 3).
        expect(item.numeroReportesAsociados).toBe(2);
        expect(item.estado).toBe("RECIBIDA");
        expect(item.identificador).toBe("+573009990002");
        expect(item.plazoRespuestaEn).toBeTruthy();

        // Regla dura: ningún texto/fecha/plataforma de reportes en la carga.
        const crudo = JSON.stringify(body);
        expect(crudo).not.toContain(TEXTO_SECRETO_REPORTE);
        expect(crudo).not.toContain("2026-07-01");
        expect(item).not.toHaveProperty("reportes");
        expect(item).not.toHaveProperty("texto");
    });

    it("muestra decisión y motivación una vez resuelta", async () => {
        const user = await crearUsuario("PARENT");
        const plataformaId = await pid();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(user);
        const resPost = await POST(crearRequestApelacion(plataformaId, "+573009990003"));
        const creada = await resPost.json();

        await prisma.apelacion.update({
            where: { id: creada.apelacion.id },
            data: {
                estado: "RECHAZADA",
                decision: "RECHAZADA",
                motivacionResolucion: "La evidencia no acredita la titularidad de la línea.",
                resueltoEn: new Date(),
            },
        });

        const res = await GET(new Request("http://localhost:5005/api/apelaciones/mias"));
        const body = await res.json();
        expect(body.items[0].decision).toBe("RECHAZADA");
        expect(body.items[0].motivacionResolucion).toContain("no acredita");
    });

    it("cada usuario solo ve sus propias apelaciones", async () => {
        const userA = await crearUsuario("PARENT");
        const userB = await crearUsuario("PARENT");
        const plataformaId = await pid();

        vi.spyOn(auth, "verifyAuth").mockResolvedValue(userA);
        await POST(crearRequestApelacion(plataformaId, "+573009990004"));

        const spy = vi.spyOn(auth, "verifyAuth").mockResolvedValue(userB);
        const res = await GET(new Request("http://localhost:5005/api/apelaciones/mias"));
        const body = await res.json();
        expect(body.items).toHaveLength(0);
        expect(body.pagination.total).toBe(0);
        spy.mockResolvedValue(userA);
    });

    it("rechaza anónimo (401)", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request("http://localhost:5005/api/apelaciones/mias"));
        expect(res.status).toBe(401);
    });
});
