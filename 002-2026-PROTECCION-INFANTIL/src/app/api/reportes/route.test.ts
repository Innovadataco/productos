import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";

vi.mock("@/lib/queue", () => ({
    publishReporte: vi.fn().mockResolvedValue(undefined),
}));

const reporteValido = {
    identificador: "+573001234567",
    plataforma: "whatsapp",
    texto: "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
    fechaIncidente: "2026-07-10T14:30:00Z",
    ciudad: "Bogotá",
    pais: "Colombia",
};

describe("POST /api/reportes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("crea un reporte anónimo y retorna 201 con número de seguimiento", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reporte.numeroSeguimiento).toMatch(/^RPT-[A-Z0-9]{6}$/);
        expect(body.reporte.estado).toBe("PENDIENTE");
    });

    it("crea un reporte autenticado vinculado al usuario", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.usuarioId).toBe(user.id);
        expect(reporte?.esAnonimo).toBe(false);
    });

    it("rechaza reporte con texto menor a 20 caracteres", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "corto",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza reporte con fecha futura", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            fechaIncidente: "2030-01-01T00:00:00Z",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza reporte con plataforma inválida", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            plataforma: "plataforma-inexistente",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("Plataforma no válida");
    });

    it("detecta duplicado autenticado dentro de 30 días", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req1 = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        await POST(req1);

        const req2 = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Otro texto descriptivo del mismo incidente reportado.",
        }, token);
        const res = await POST(req2);
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe("DUPLICATE_REPORT");
    });

    it("aplica rate limiting a reportes anónimos", async () => {
        const ipHeader = { "x-forwarded-for": "1.2.3.4" };
        for (let i = 0; i < 5; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...ipHeader },
                body: JSON.stringify({ ...reporteValido, identificador: `+57300${i}00000` }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
        }

        const req6 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...ipHeader },
            body: JSON.stringify({ ...reporteValido, identificador: "+57300600000" }),
        });
        const res = await POST(req6);
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("marca como POSIBLE_SPAM textos sin contexto relevante", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "asdf asdf asdf asdf asdf asdf asdf",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reporte.estado).toBe("POSIBLE_SPAM");
    });

    it("actualiza el contador en IdentificadorReportado", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        await POST(req);
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: reporteValido.identificador, plataformaId: (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id } },
        });
        expect(agregado?.totalReportes).toBe(1);
        expect(agregado?.reportesAnonimos).toBe(1);
    });
});
