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
import { sendReporte } from "@/lib/queue";

vi.mock("@/lib/queue", () => ({
    sendReporte: vi.fn().mockResolvedValue({ encolado: true }),
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

    it("cifra textoOriginal al crear reporte", async () => {
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.textoOriginal).toMatch(/^enc:/);
        expect(reporte?.texto).toBe(reporteValido.texto);
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
        if (process.env.DISABLE_RATE_LIMIT === "true") {
            // Con rate limiting deshabilitado, el sexto reporte también se acepta
            const ipHeader = { "x-forwarded-for": "1.2.3.4" };
            for (let i = 0; i < 6; i++) {
                const req = new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...ipHeader },
                    body: JSON.stringify({ ...reporteValido, identificador: `+57300${i}00000` }),
                });
                const res = await POST(req);
                expect(res.status).toBe(201);
            }
            return;
        }

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

    it("marca REVISION_MANUAL al superar rate limit por identificador", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        const identificador = "+57300IDENTIFICADOR";
        for (let i = 0; i < 10; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.${i}.1` },
                body: JSON.stringify({ ...reporteValido, identificador }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.reporte.estado).toBe("PENDIENTE");
        }

        const req11 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.99.1" },
            body: JSON.stringify({ ...reporteValido, identificador }),
        });
        const res11 = await POST(req11);
        expect(res11.status).toBe(201);
        const body11 = await res11.json();
        expect(body11.reporte.estado).toBe("REVISION_MANUAL");
    });

    it("marca POSIBLE_SPAM al superar umbral de spam por identificador", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        const identificador = "+57300SPAMTHRESH";
        for (let i = 0; i < 21; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.${i}.1` },
                body: JSON.stringify({ ...reporteValido, identificador }),
            });
            await POST(req);
        }

        const req22 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": "10.1.99.1" },
            body: JSON.stringify({ ...reporteValido, identificador }),
        });
        const res22 = await POST(req22);
        expect(res22.status).toBe(201);
        const body22 = await res22.json();
        expect(body22.reporte.estado).toBe("POSIBLE_SPAM");
    });

    it("rechaza reportes que superan rate limit por fingerprint", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        // Mismo fingerprint = mismo user-agent, accept-language e IP truncada (/24).
        const headers = {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.2.0.1",
            "user-agent": "TestAgent/1.0",
            "accept-language": "es-CO",
        };
        for (let i = 0; i < 5; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers,
                body: JSON.stringify({ ...reporteValido, identificador: `+57300FP${i}` }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
        }

        const req6 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers,
            body: JSON.stringify({ ...reporteValido, identificador: "+57300FP5" }),
        });
        const res6 = await POST(req6);
        expect(res6.status).toBe(429);
        const body = await res6.json();
        expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("asigna prioridad alta a reportes autenticados y encola con prioridad 10", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(true);
        expect(reporte?.esAnonimo).toBe(false);
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: true });
    });

    it("asigna prioridad baja a reportes anónimos sin keyword de alto riesgo", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(false);
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: false });
    });

    it("eleva a prioridad alta reportes anónimos con keyword de alto riesgo", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Este número publicó fotos mías y amenazó con doxearme si no le enviaba más material.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(true);
        expect(reporte?.keywordsDetectadas).toContain("doxear");
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: true });
    });
});
