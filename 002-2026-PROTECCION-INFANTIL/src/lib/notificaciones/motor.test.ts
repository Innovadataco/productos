/**
 * SPEC-201: tests de integración de la API pública del motor de notificaciones.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { programar, cancelar, estado, recalcular } from "./motor";

async function crearPlantilla(
    clave: string,
    canal: "EMAIL" | "IN_APP",
    cuerpoMarkdown: string,
    asunto?: string
) {
    return prisma.notificacionPlantilla.create({
        data: { clave, canal, cuerpoMarkdown, asunto: asunto ?? null },
    });
}

async function crearRegla(
    evento: string,
    rol: string,
    offset: string,
    canal: "EMAIL" | "IN_APP",
    plantillaClave: string,
    obligatoria = false
) {
    return prisma.notificacionRegla.create({
        data: { evento, rol, offset, canal, plantillaClave, obligatoria },
    });
}

describe("motor de notificaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("programar crea una notificación por regla activa", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola {{nombre}}", "Reporte resuelto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);

        const result = await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ usuarioId: usuario.id, variables: { nombre: "Padre" } }],
        });

        expect(result.programadas).toBe(1);
        const notificaciones = await prisma.notificacion.findMany();
        expect(notificaciones).toHaveLength(1);
        expect(notificaciones[0].estado).toBe("ENCOLADA");
        expect(notificaciones[0].destinatarioEmail).toBe("padre@test.com");
    });

    it("programar usa el email proporcionado si no hay usuarioId", async () => {
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola", "Asunto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);

        const result = await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ email: "externo@example.com", variables: {} }],
        });

        expect(result.programadas).toBe(1);
        const notificacion = await prisma.notificacion.findFirst();
        expect(notificacion?.destinatarioEmail).toBe("externo@example.com");
        expect(notificacion?.destinatarioUsuarioId).toBeNull();
    });

    it("programar no crea notificación si la preferencia está deshabilitada", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        await prisma.notificacionPreferencia.create({
            data: { usuarioId: usuario.id, eventoRegla: "reporte.resuelto.email", habilitado: false },
        });

        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola", "Asunto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);

        const result = await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
        });

        expect(result.programadas).toBe(0);
    });

    it("programar ignora preferencia deshabilitada si la regla es obligatoria", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        await prisma.notificacionPreferencia.create({
            data: { usuarioId: usuario.id, eventoRegla: "suscripcion.por_vencer.email", habilitado: false },
        });

        const plantilla = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL", "Hola", "Vencimiento");
        await crearRegla("suscripcion.por_vencer", "PARENT", "-1d", "EMAIL", plantilla.clave, true);

        const result = await programar({
            evento: "suscripcion.por_vencer",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
        });

        expect(result.programadas).toBe(1);
    });

    it("programar con offset futuro respeta quiet hours", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        const plantilla = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL", "Hola", "Vencimiento");
        await crearRegla("suscripcion.por_vencer", "PARENT", "-1d", "EMAIL", plantilla.clave, true);

        // Base: 22:00 Bogotá; offset -1d → 22:00 Bogotá del día anterior (dentro de quiet hours).
        const base = new Date("2026-08-22T03:00:00.000Z"); // 22:00 Bogotá
        await programar({
            evento: "suscripcion.por_vencer",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: base,
        });

        const notificacion = await prisma.notificacion.findFirst();
        expect(notificacion).not.toBeNull();
        // Debe haberse diferido a 07:00 Bogotá del día anterior = 2026-08-21 12:00 UTC
        expect(notificacion!.enviarEn!.getTime()).toBeGreaterThanOrEqual(base.getTime() - 15 * 60 * 60 * 1000);
    });

    it("cancelar cancela notificaciones programadas futuras", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola", "Asunto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);

        await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: new Date(Date.now() + 60_000),
        });

        const result = await cancelar({ evento: "reporte.resuelto" });
        expect(result.canceladas).toBe(1);

        const notificacion = await prisma.notificacion.findFirst();
        expect(notificacion?.estado).toBe("CANCELADA");
        expect(notificacion?.motivoCancelacion).toBe("cancelacion_manual");
    });

    it("estado devuelve una notificación por id", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola", "Asunto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);

        const { programadas } = await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
        });
        expect(programadas).toBe(1);

        const creada = await prisma.notificacion.findFirst();
        const encontrada = await estado(creada!.id);
        expect(encontrada?.id).toBe(creada!.id);
    });

    it("programar reemplaza solo notificaciones del mismo canal", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        await crearPlantilla("reporte.resuelto.email", "EMAIL", "Email", "Email");
        await crearPlantilla("reporte.resuelto.in_app", "IN_APP", "In-app", "In-app");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", "reporte.resuelto.email", false);
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "IN_APP", "reporte.resuelto.in_app", false);

        await programar({
            evento: "reporte.resuelto",
            sujetoTipo: "Reporte",
            sujetoId: "rep-1",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: new Date(Date.now() + 60_000),
        });

        const result = await programar({
            evento: "reporte.resuelto",
            sujetoTipo: "Reporte",
            sujetoId: "rep-1",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: new Date(Date.now() + 120_000),
        });

        expect(result.programadas).toBe(2);
        expect(result.canceladasPorReemplazo).toBe(2);

        const notificaciones = await prisma.notificacion.findMany({ orderBy: { enviarEn: "asc" } });
        expect(notificaciones).toHaveLength(4);
        const canceladas = notificaciones.filter((n) => n.estado === "CANCELADA");
        const encoladas = notificaciones.filter((n) => n.estado === "ENCOLADA");
        expect(canceladas).toHaveLength(2);
        expect(encoladas).toHaveLength(2);
        expect(new Set(canceladas.map((n) => n.canal)).size).toBe(2);
        expect(new Set(encoladas.map((n) => n.canal)).size).toBe(2);
    });

    it("recalcular cancela programaciones futuras del evento", async () => {
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL", "Hola", "Asunto");
        await crearRegla("reporte.resuelto", "PARENT", "+0m", "EMAIL", plantilla.clave, false);
        const usuario = await crearUsuario("PARENT", "padre@test.com");

        await programar({
            evento: "reporte.resuelto",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: new Date(Date.now() + 60_000),
        });

        const result = await recalcular({ evento: "reporte.resuelto", motivo: "cambio de offset" });
        expect(result.recalculadas).toBe(1);

        const notificacion = await prisma.notificacion.findFirst();
        expect(notificacion?.estado).toBe("CANCELADA");
        expect(notificacion?.motivoCancelacion).toBe("regla_cambiada_recalculo");
    });
});
