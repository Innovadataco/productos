import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosExpediente,
} from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function crearRequest(url: string): Request {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return new Request(url, { method: "GET", headers });
}

/** resetDatabase otorga TODOS los módulos a TODOS los roles: para probar gating hay que quitar el permiso explícitamente. */
async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

async function crearReporteCompleto() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado de prueba del expediente.",
            textoOriginal: encryptParameter("Texto original con datos sensibles de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}`,
            fuente: {
                create: {
                    pesoAplicado: 0.8,
                    cuentaDiasAntiguedad: 30,
                    reportesPrevios: 1,
                    reportesConfirmados: 1,
                    reportesDescartados: 0,
                    ipHash: "iphash-expediente",
                    fingerprintHash: "fphash-expediente",
                },
            },
            clasificacion: {
                create: {
                    categoria: "SOLICITUD_MATERIAL",
                    confianza: 0.67,
                    modeloUsado: "rubrica:test",
                    latenciaMs: 900,
                    promptTokens: 100,
                    responseTokens: 20,
                    rawResponse: "{\"modo\":\"rubrica\",\"debug\":\"raw-gated\"}",
                    rubricaVotos: {
                        create: [
                            { modelo: "m1", categoria: "SOLICITUD_MATERIAL", cumple: true,
                                preguntasJson: ["¿Alguien pide fotos, videos o material visual a otra persona?"] },
                            { modelo: "m2", categoria: "SOLICITUD_MATERIAL", cumple: false, preguntasJson: [] },
                        ],
                    },
                },
            },
        },
    });
}

describe("GET /api/admin/reportes/[id]/expediente (T024)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearParametrosExpediente();
        activeToken = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: expediente con las 10 etapas, votación, síntesis y flags", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteCompleto();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente`), {
            params: Promise.resolve({ id: reporte.id }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.reporte.id).toBe(reporte.id);
        expect(body.reporte.numeroSeguimiento).toBe(reporte.numeroSeguimiento);
        expect(body.reporte.plataforma).toBe("WhatsApp");

        expect(body.etapas).toHaveLength(10);
        expect(body.etapas.map((e: { orden: number }) => e.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        // Sin pasos instrumentados: las Capa 2 degradan elegante.
        const guardas = body.etapas.find((e: { clave: string }) => e.clave === "guardas");
        expect(guardas.sinInstrumentar).toBe(true);

        expect(body.clasificacion.categorias).toEqual(["SOLICITUD_MATERIAL"]);
        expect(body.clasificacion.matriz).toEqual({ SOLICITUD_MATERIAL: { m1: 1, m2: 0 } });
        expect(body.clasificacion.detallePorCategoria[0].preguntas[0].texto).toContain("fotos, videos o material visual");

        expect(body.sintesis.analisisInterno).toContain("Consenso 1/2 en SOLICITUD_MATERIAL");
        expect(body.sintesis.mensajePadre).toContain("BORRADOR");
        expect(body.sintesis.mensajePadre).toContain("Línea 141 ICBF");

        expect(body.revelado).toBe(false);
        expect(body.puedeRevelar).toBe(true);
        // Por defecto los campos gated NO aparecen.
        expect(JSON.stringify(body)).not.toContain("Texto original con datos sensibles");
        expect(JSON.stringify(body)).not.toContain("iphash-expediente");
        expect(JSON.stringify(body)).not.toContain("raw-gated");
    });

    it("401: sin sesión", async () => {
        const reporte = await crearReporteCompleto();
        const res = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente`), {
            params: Promise.resolve({ id: reporte.id }),
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(["AUTH_INVALID", "AUTH_EXPIRED"]).toContain(body.error.code);
    });

    it("403: sin módulo bandeja_reportes", async () => {
        const operador = await crearUsuario("OPERADOR");
        await revocarModulo("OPERADOR", "bandeja_reportes");
        const reporte = await crearReporteCompleto();
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const res = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente`), {
            params: Promise.resolve({ id: reporte.id }),
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe("FORBIDDEN");
    });

    it("404: reporte inexistente", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const idInexistente = "clzzzzzzzzzzzzzzzzzzzzzzz";
        const res = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${idInexistente}/expediente`), {
            params: Promise.resolve({ id: idInexistente }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
    });

    it("400: id inválido", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(crearRequest("http://localhost:5005/api/admin/reportes/no-es-un-id/expediente"), {
            params: Promise.resolve({ id: "no-es-un-id" }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("429: límite admin_read excedido", async () => {
        const previo = process.env.DISABLE_RATE_LIMIT;
        process.env.DISABLE_RATE_LIMIT = "false";
        try {
            await prisma.parametroSistema.upsert({
                where: { clave: "ratelimit.admin_read.max_requests" },
                update: { valor: "1" },
                create: { clave: "ratelimit.admin_read.max_requests", valor: "1", tipo: "INTEGER", categoria: "SECURITY", esPublico: false },
            });
            const admin = await crearUsuario("ADMIN");
            const reporte = await crearReporteCompleto();
            activeToken = await crearTokenUsuario(admin.id, "ADMIN");

            const primera = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente`), {
                params: Promise.resolve({ id: reporte.id }),
            });
            expect(primera.status).toBe(200);

            const segunda = await GET(crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente`), {
                params: Promise.resolve({ id: reporte.id }),
            });
            expect(segunda.status).toBe(429);
            const body = await segunda.json();
            expect(body.error.code).toBe("RATE_LIMITED");
        } finally {
            process.env.DISABLE_RATE_LIMIT = previo;
        }
    });

    it("sin permiso de revelar: campos gated omitidos y revelado:false (no es error)", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "expediente_revelar_original");
        const reporte = await crearReporteCompleto();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente?revelar=true`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.revelado).toBe(false);
        expect(body.puedeRevelar).toBe(false);
        expect(JSON.stringify(body)).not.toContain("Texto original con datos sensibles");
        expect(JSON.stringify(body)).not.toContain("iphash-expediente");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "TEXTO_ORIGINAL_REVELADO", recursoId: reporte.id },
        });
        expect(audit).toBeNull();
    });

    it("con permiso + revelar=true: campos gated incluidos y AuditLog registrado", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteCompleto();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            crearRequest(`http://localhost:5005/api/admin/reportes/${reporte.id}/expediente?revelar=true`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.revelado).toBe(true);
        expect(body.puedeRevelar).toBe(true);

        const pesoFuente = body.etapas.find((e: { clave: string }) => e.clave === "peso_fuente");
        expect(pesoFuente.gated).toBe(false);
        expect(pesoFuente.campos.ipHash).toBe("iphash-expediente");
        expect(pesoFuente.campos.fingerprintHash).toBe("fphash-expediente");

        const anonimizacion = body.etapas.find((e: { clave: string }) => e.clave === "anonimizacion");
        expect(anonimizacion.campos.textoOriginal).toBe("Texto original con datos sensibles de prueba.");

        const clasif = body.etapas.find((e: { clave: string }) => e.clave === "clasificacion");
        expect(clasif.campos.rawResponse).toContain("raw-gated");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "TEXTO_ORIGINAL_REVELADO", recursoId: reporte.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        // El audit nunca guarda el texto: solo metadatos.
        expect(JSON.stringify(audit)).not.toContain("Texto original con datos sensibles");
    });
});
