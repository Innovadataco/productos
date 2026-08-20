import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { obtenerTimelineProceso } from "./timeline-proceso";
import { logAudit } from "@/lib/audit";
import { encryptParameter } from "@/lib/param-encryption";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

async function crearReporteDePrueba(numeroSeguimiento = "RPT-TL-001") {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300TL0000",
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado.",
            textoOriginal: encryptParameter("Texto original de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REVISION_MANUAL",
            numeroSeguimiento,
        },
    });
}

describe("obtenerTimelineProceso", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    // SPEC-188 (FR-005/006): el timeline incluye eventos OPERADOR_ASIGNADO del AuditLog.
    it("incluye evento OPERADOR_ASIGNADO con email del operador", async () => {
        const operador = await crearUsuario("OPERADOR", "operador-tl@example.com");
        const reporte = await crearReporteDePrueba();

        await logAudit({
            accion: "OPERADOR_ASIGNADO",
            tipoRecurso: "Reporte",
            recursoId: reporte.id,
            usuarioId: operador.id,
            valorNuevo: JSON.stringify({ operadorId: operador.id, operadorEmail: operador.email, operadorNombre: operador.nombre }),
        });

        const timeline = await obtenerTimelineProceso(reporte.id);
        const eventos = timeline.eventos.filter((e) => e.tipo === "ASIGNACION_OPERADOR");
        expect(eventos).toHaveLength(1);
        const evento = eventos[0];
        expect(evento.accion).toBe("OPERADOR_ASIGNADO");
        expect(evento.operadorEmail).toBe("operador-tl@example.com");
        expect(evento.actorEmail).toBeNull();
    });

    it("incluye evento OPERADOR_REASIGNADO con actor y operador afectado", async () => {
        const admin = await crearUsuario("ADMIN", "admin-tl@example.com");
        const operador = await crearUsuario("OPERADOR", "operador2-tl@example.com");
        const reporte = await crearReporteDePrueba("RPT-TL-002");

        await logAudit({
            accion: "OPERADOR_REASIGNADO",
            tipoRecurso: "Reporte",
            recursoId: reporte.id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ operadorId: null }),
            valorNuevo: JSON.stringify({ operadorId: operador.id, operadorEmail: operador.email, operadorNombre: operador.nombre }),
        });

        const timeline = await obtenerTimelineProceso(reporte.id);
        const evento = timeline.eventos.find((e) => e.tipo === "ASIGNACION_OPERADOR");
        expect(evento).toBeDefined();
        if (evento?.tipo === "ASIGNACION_OPERADOR") {
            expect(evento.accion).toBe("OPERADOR_REASIGNADO");
            expect(evento.operadorEmail).toBe("operador2-tl@example.com");
            expect(evento.actorEmail).toBe("admin-tl@example.com");
        }
    });

    it("devuelve array vacío cuando no hay eventos", async () => {
        const reporte = await crearReporteDePrueba("RPT-TL-003");
        const timeline = await obtenerTimelineProceso(reporte.id);
        expect(timeline.eventos).toHaveLength(0);
    });

    it("lanza 404 si el reporte no existe", async () => {
        await expect(obtenerTimelineProceso("noexiste")).rejects.toMatchObject({
            code: "NOT_FOUND",
            statusCode: 404,
        });
    });
});
