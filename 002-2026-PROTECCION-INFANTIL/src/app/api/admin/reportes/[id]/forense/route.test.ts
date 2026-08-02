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
} from "@/lib/reporte-test-utils";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getForense(reporteId: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(new Request(`http://localhost:5005/api/admin/reportes/${reporteId}/forense`, { headers }), {
        params: Promise.resolve({ id: reporteId }),
    });
}

async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

const TEXTO_REPORTE = "Texto del reporte que NUNCA sale en la vista forense.";

async function crearReporte(opts: { esAnonimo: boolean; conDenunciante?: boolean }) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    let usuarioId: string | undefined;
    if (opts.conDenunciante) {
        const denunciante = await crearUsuario("PARENT", "denunciante-secreto@example.com");
        usuarioId = denunciante.id;
    }
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "+57300FORENSE",
            plataformaId: plataforma!.id,
            texto: TEXTO_REPORTE,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Cali",
            pais: "Colombia",
            esAnonimo: opts.esAnonimo,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-FOR-${Date.now()}`,
            ...(usuarioId ? { usuarioId } : {}),
            fuente: {
                create: {
                    pesoAplicado: 0.8,
                    cuentaDiasAntiguedad: 30,
                    reportesPrevios: 0,
                    reportesConfirmados: 0,
                    reportesDescartados: 0,
                    ipHash: "iphash-forense-SECRETO",
                    fingerprintHash: "fphash-forense-SECRETO",
                },
            },
            clasificacion: {
                create: {
                    categoria: "EXTORSION",
                    confianza: 0.9,
                    modeloUsado: "rubrica:test",
                    latenciaMs: 700,
                },
            },
            transiciones: {
                create: [
                    { estadoAnterior: "PENDIENTE", estadoNuevo: "PROCESANDO", responsableTipo: "SISTEMA" },
                    { estadoAnterior: "PROCESANDO", estadoNuevo: "CLASIFICADO", responsableTipo: "SISTEMA" },
                ],
            },
        },
    });
    return reporte;
}

describe("GET /api/admin/reportes/[id]/forense (SPEC-140, N-4)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token / 403 sin el módulo denuncia_formal", async () => {
        const reporte = await crearReporte({ esAnonimo: true });
        expect((await getForense(reporte.id)).status).toBe(401);

        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "denuncia_formal");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getForense(reporte.id)).status).toBe(403);
    });

    it("404 si el reporte no existe o está eliminado", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getForense("c".padEnd(25, "1"))).status).toBe(404);

        const eliminado = await crearReporte({ esAnonimo: true });
        await prisma.reporte.update({ where: { id: eliminado.id }, data: { eliminado: true } });
        expect((await getForense(eliminado.id)).status).toBe(404);
    });

    it("200: solo campos autorizados; NUNCA identidad del denunciante, IP ni huella (SC-003)", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporte({ esAnonimo: false, conDenunciante: true });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getForense(reporte.id);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(Object.keys(body).sort()).toEqual([
            "ciudad",
            "conductas",
            "conteoReportesIdentificador",
            "creadoEn",
            "descripcionConductas",
            "estadoActual",
            "fechaIncidente",
            "identificador",
            "origen",
            "pais",
            "plataforma",
            "traza",
        ]);
        expect(body.identificador).toBe("+57300FORENSE");
        expect(body.plataforma).toBe("WhatsApp");
        expect(body.origen).toBe("cuenta registrada");
        expect(body.conductas).toEqual(["EXTORSION"]);
        expect(body.traza).toHaveLength(2);

        // Test de AUSENCIA (no solo de presencia): nada que identifique al denunciante.
        const json = JSON.stringify(body);
        expect(json).not.toContain("denunciante-secreto@example.com");
        expect(json).not.toContain(reporte.usuarioId!);
        expect(json).not.toContain("usuarioId");
        expect(json).not.toContain("iphash-forense-SECRETO");
        expect(json).not.toContain("fphash-forense-SECRETO");
        expect(json).not.toContain(TEXTO_REPORTE);
        expect(json).not.toContain("fuenteConfianza");
    });

    it("200 con reporte anónimo: origen 'anónimo', sin resolver identidad", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporte({ esAnonimo: true });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getForense(reporte.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.origen).toBe("anónimo");
    });

    it("incluye el conteo agregado del identificador cuando existe", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporte({ esAnonimo: true });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await prisma.identificadorReportado.create({
            data: {
                identificador: "+57300FORENSE",
                plataformaId: plataforma!.id,
                totalReportes: 4,
                reportesAnonimos: 4,
            },
        });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getForense(reporte.id);
        const body = await res.json();
        expect(body.conteoReportesIdentificador).toBe(4);
    });
});
