import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearOperadorConPerfil(adminId: string, email: string, cupoMaximo = 10) {
    const usuario = await crearUsuario("OPERADOR", email);
    await prisma.perfilOperador.create({
        data: { usuarioId: usuario.id, creadoPorId: adminId, cupoMaximo, esComite: false },
    });
    return usuario;
}

async function crearReporteAsignado(
    operadorId: string,
    plataformaId: string,
    estado: "REVISION_MANUAL" | "CORREGIDO" = "REVISION_MANUAL",
    categoria: CategoriaConducta = "CONTACTO_INSISTENTE"
) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1000000)}`,
            plataformaId,
            texto: "Texto de prueba del reporte con suficientes caracteres.",
            fechaIncidente: new Date("2026-08-15T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            operadorId,
            estado,
            numeroSeguimiento: `RPT-${Math.floor(Math.random() * 1000000)}`,
            eliminado: false,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    return reporte;
}

async function logAudit(accion: string, recursoId: string, usuarioId: string, fecha: Date) {
    await prisma.auditLog.create({
        data: {
            accion: accion as never,
            tipoRecurso: "Reporte",
            recursoId,
            usuarioId,
            ipAddress: "127.0.0.1",
            userAgent: "test",
            creadoEn: fecha,
        },
    });
}

describe("GET /api/admin/operadores/[id]/metricas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPaisCiudad();
        await crearPlataforma();
        mockToken = undefined;
    });

    it("devuelve métricas correctas para un operador con casos", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearOperadorConPerfil(admin.id, "op@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const plataforma = await crearPlataforma();

        // Caso abierto asignado hace 2 horas
        const abierto = await crearReporteAsignado(operador.id, plataforma.id, "REVISION_MANUAL", "CONTACTO_INSISTENTE");
        await logAudit("OPERADOR_ASIGNADO", abierto.id, operador.id, new Date(Date.now() - 2 * 60 * 60 * 1000));

        // Caso resuelto hoy (dentro de 24h)
        const resuelto = await crearReporteAsignado(operador.id, plataforma.id, "CORREGIDO", "SOLICITUD_MATERIAL");
        await logAudit("OPERADOR_ASIGNADO", resuelto.id, operador.id, new Date(Date.now() - 4 * 60 * 60 * 1000));
        await logAudit("CASO_CORREGIDO", resuelto.id, operador.id, new Date(Date.now() - 1 * 60 * 60 * 1000));

        // Caso escalado hace 15 días
        const escalado = await crearReporteAsignado(operador.id, plataforma.id, "REVISION_MANUAL", "CONTACTO_INSISTENTE");
        await logAudit("OPERADOR_ASIGNADO", escalado.id, operador.id, new Date(Date.now() - 15 * 24 * 60 * 60 * 1000));
        await logAudit("CASO_ESCALADO", escalado.id, operador.id, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/operadores/${operador.id}/metricas`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: operador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.operador.id).toBe(operador.id);
        expect(json.casosAbiertos).toHaveLength(2);
        expect(json.casosResueltos24h).toBe(1);
        expect(json.casosResueltos7d).toBe(1);
        expect(json.casosResueltos30d).toBe(1);
        expect(json.tiempoMedioResolucionMs).toBeGreaterThan(0);
        expect(json.casosPorCategoria).toEqual([{ categoria: "SOLICITUD_MATERIAL", total: 1 }]);
        expect(json.tasaEscalamientoComite).toBe(0.5);
    });

    it("devuelve 404 si el operador no existe", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/operadores/invalid-id/metricas", {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: "invalid-id" }) }
        );

        expect(res.status).toBe(404);
    });

    it("devuelve 400 si el usuario no es OPERADOR", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@test.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, cupoMaximo: 10, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/operadores/${comite.id}/metricas`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: comite.id }) }
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("ROL_INVALIDO");
    });
});
