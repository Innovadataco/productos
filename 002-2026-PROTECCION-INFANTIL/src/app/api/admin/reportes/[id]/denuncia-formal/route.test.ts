import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
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
import {
    findAuditNuevaAccion,
    ACCION_DENUNCIA_FORMAL_GENERADA,
} from "@/lib/audit-nuevas-acciones";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function postDenuncia(reporteId: string, body: unknown): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return POST(
        new Request(`http://localhost:5005/api/admin/reportes/${reporteId}/denuncia-formal`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: reporteId }) }
    );
}

/** resetDatabase otorga TODOS los módulos a TODOS los roles: para probar gating hay que quitar el permiso explícitamente. */
async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

const TEXTO_REPORTE = "Texto del reporte que NUNCA viaja a la denuncia ni a la auditoría.";

async function crearReporteClasificado(overrides: { estado?: "PENDIENTE" | "CLASIFICADO" | "POSIBLE_SPAM"; eliminado?: boolean } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300DENUNCIA",
            plataformaId: plataforma!.id,
            texto: TEXTO_REPORTE,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: overrides.estado ?? "CLASIFICADO",
            eliminado: overrides.eliminado ?? false,
            numeroSeguimiento: `RPT-DEN-${Date.now()}`,
            ...(overrides.estado === undefined || overrides.estado === "CLASIFICADO"
                ? {
                    clasificacion: {
                        create: {
                            categoria: "SOLICITUD_MATERIAL",
                            confianza: 0.8,
                            modeloUsado: "rubrica:test",
                            latenciaMs: 500,
                        },
                    },
                }
                : {}),
        },
    });
}

describe("POST /api/admin/reportes/[id]/denuncia-formal (SPEC-140, F2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearParametrosExpediente(); // siembra mensaje.padre.canales
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token", async () => {
        const res = await postDenuncia("c".padEnd(25, "1"), { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(401);
    });

    it("403 sin el módulo denuncia_formal (y no genera documento ni evento)", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "denuncia_formal");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await postDenuncia(reporte.id, { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(403);
        expect(res.headers.get("content-type")).not.toContain("application/pdf");
        const eventos = await findAuditNuevaAccion(ACCION_DENUNCIA_FORMAL_GENERADA, { recursoId: reporte.id });
        expect(eventos).toHaveLength(0);
    });

    it("403 para rol PARENT sin el módulo (en los defaults reales PARENT nunca lo tiene)", async () => {
        const padre = await crearUsuario("PARENT");
        await revocarModulo("PARENT", "denuncia_formal");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await postDenuncia(reporte.id, { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(403);
    });

    it("404 si el reporte no existe", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await postDenuncia("c".padEnd(25, "1"), { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(404);
    });

    it("404 si el reporte está eliminado (fuera de circulación)", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteClasificado({ eliminado: true });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await postDenuncia(reporte.id, { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(404);
    });

    it("409 si el reporte no tiene clasificación (PENDIENTE / POSIBLE_SPAM)", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const pendiente = await crearReporteClasificado({ estado: "PENDIENTE" });
        const res1 = await postDenuncia(pendiente.id, { canalDestino: "Línea 141 ICBF" });
        expect(res1.status).toBe(409);

        const spam = await crearReporteClasificado({ estado: "POSIBLE_SPAM" });
        const res2 = await postDenuncia(spam.id, { canalDestino: "Línea 141 ICBF" });
        expect(res2.status).toBe(409);

        const eventos = await findAuditNuevaAccion(ACCION_DENUNCIA_FORMAL_GENERADA);
        expect(eventos).toHaveLength(0);
    });

    it("400 con canalDestino inválido (no está en los canales oficiales)", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await postDenuncia(reporte.id, { canalDestino: "Canal Inventado" });
        expect(res.status).toBe(400);

        const res2 = await postDenuncia(reporte.id, {});
        expect(res2.status).toBe(400);
    });

    it("200: PDF por attachment, SIN retención y UNA fila AuditLog sin contenido (SC-001/SC-002)", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await postDenuncia(reporte.id, { canalDestino: "Línea 141 ICBF" });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("application/pdf");
        expect(res.headers.get("content-disposition")).toContain("attachment");
        expect(res.headers.get("content-disposition")).toContain(".pdf");

        const buffer = Buffer.from(await res.arrayBuffer());
        expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

        // FR-003: la plataforma no retiene el PDF — el único destino es esta
        // respuesta; en la BD solo queda el evento (sin contenido).
        const eventos = await findAuditNuevaAccion(ACCION_DENUNCIA_FORMAL_GENERADA, { recursoId: reporte.id });
        expect(eventos).toHaveLength(1);
        const evento = eventos[0];
        expect(evento.usuarioId).toBe(admin.id);
        expect(evento.tipoRecurso).toBe("Reporte");
        const metadatos = JSON.stringify(evento.metadatos);
        expect(evento.metadatos).toMatchObject({
            reporteId: reporte.id,
            canalDestino: "Línea 141 ICBF",
            usuarioId: admin.id,
        });
        expect(typeof (evento.metadatos as { fecha?: unknown }).fecha).toBe("string");
        // D-22: NUNCA contenido del documento ni del reporte.
        expect(metadatos).not.toContain(TEXTO_REPORTE);
        expect(metadatos).not.toContain("%PDF");
    });

    it("cada generación es un evento propio (sin dedup — el documento no se retiene)", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res1 = await postDenuncia(reporte.id, { canalDestino: "Línea 141 ICBF" });
        await res1.arrayBuffer();
        const res2 = await postDenuncia(reporte.id, { canalDestino: "Te Protejo" });
        await res2.arrayBuffer();
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);

        const eventos = await findAuditNuevaAccion(ACCION_DENUNCIA_FORMAL_GENERADA, { recursoId: reporte.id });
        expect(eventos).toHaveLength(2);
    });
});
