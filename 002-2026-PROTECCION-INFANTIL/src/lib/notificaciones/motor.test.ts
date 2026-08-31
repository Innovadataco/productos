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

    it("programar con canal EMAIL NO difiere por quiet hours (SPEC-312)", async () => {
        const usuario = await crearUsuario("PARENT", "padre@test.com");
        const plantilla = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL", "Hola", "Vencimiento");
        await crearRegla("suscripcion.por_vencer", "PARENT", "-1d", "EMAIL", plantilla.clave, true);

        // Base: 22:00 Bogotá (2026-08-22T03:00:00Z). Offset -1d → 22:00 Bogotá del día anterior
        // = 2026-08-21T03:00:00Z (dentro de la ventana 20:00-07:00).
        // SPEC-312: EMAIL se salta quiet hours categóricamente → enviarEn debe ser exactamente
        // conOffset = base - 24h, sin ningún desplazamiento adicional.
        const base = new Date("2026-08-22T03:00:00.000Z"); // 22:00 Bogotá
        const conOffset = new Date(base.getTime() - 24 * 60 * 60 * 1000); // 2026-08-21T03:00:00Z

        await programar({
            evento: "suscripcion.por_vencer",
            destinatarios: [{ usuarioId: usuario.id, variables: {} }],
            enviarEn: base,
        });

        const notificacion = await prisma.notificacion.findFirst();
        expect(notificacion).not.toBeNull();
        // Assert exacto: sin deferral, enviarEn == conOffset. Si quiet hours vuelve a aplicarse
        // para EMAIL, este test falla porque el valor sería ~12:00 UTC (07:00 Bogotá diferido).
        expect(notificacion!.enviarEn!.getTime()).toBe(conOffset.getTime());
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

// SPEC-333 (002-PI-233 · I-223): la regla distingue el rol. Al des-colapsar, un
// evento tiene reglas de varios roles; el motor debe aplicar a cada destinatario
// SOLO la de su rol (si no, doble envío en +0m y offset ajeno). Un solo rol =
// conducta idéntica (cubierto por los tests de arriba con reglas PARENT únicas).
describe("motor rol-aware (SPEC-333)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("evento multi-rol +0m: 1 por destinatario, sin duplicados", async () => {
        const padre = await crearUsuario("PARENT", "padre@test.com");
        const rector = await crearUsuario("SCHOOL_ADMIN", "rector@test.com");
        const pl = await crearPlantilla("referido.registrado.email", "EMAIL", "Hola {{nombre}}", "Referido");
        // Dos reglas del MISMO (evento, canal, plantillaClave), rol distinto (des-colapsadas).
        await crearRegla("referido.registrado", "PARENT", "+0m", "EMAIL", pl.clave, false);
        await crearRegla("referido.registrado", "SCHOOL_ADMIN", "+0m", "EMAIL", pl.clave, false);

        const result = await programar({
            evento: "referido.registrado",
            destinatarios: [
                { usuarioId: padre.id, rol: "PARENT", variables: { nombre: "Padre" } },
                { usuarioId: rector.id, rol: "SCHOOL_ADMIN", variables: { nombre: "Rector" } },
            ],
        });

        // 2 (una por destinatario), NO 4 (2 reglas × 2 destinatarios).
        expect(result.programadas).toBe(2);
        const notifs = await prisma.notificacion.findMany();
        expect(notifs).toHaveLength(2);
        expect(notifs.filter((n) => n.destinatarioEmail === "padre@test.com")).toHaveLength(1);
        expect(notifs.filter((n) => n.destinatarioEmail === "rector@test.com")).toHaveLength(1);
    });

    it("offset por rol: padre -1d, rector -5d (no se colapsan)", async () => {
        const padre = await crearUsuario("PARENT", "p@test.com");
        const rector = await crearUsuario("SCHOOL_ADMIN", "r@test.com");
        const pl = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL", "Hola {{nombre}}", "Vence");
        await crearRegla("suscripcion.por_vencer", "PARENT", "-1d", "EMAIL", pl.clave, true);
        await crearRegla("suscripcion.por_vencer", "SCHOOL_ADMIN", "-5d", "EMAIL", pl.clave, true);

        const base = new Date("2026-09-10T12:00:00.000Z");
        await programar({
            evento: "suscripcion.por_vencer",
            enviarEn: base,
            destinatarios: [
                { usuarioId: padre.id, rol: "PARENT", variables: { nombre: "P" } },
                { usuarioId: rector.id, rol: "SCHOOL_ADMIN", variables: { nombre: "R" } },
            ],
        });

        const nP = await prisma.notificacion.findFirst({ where: { destinatarioEmail: "p@test.com" } });
        const nR = await prisma.notificacion.findFirst({ where: { destinatarioEmail: "r@test.com" } });
        // El padre (-1d) queda MÁS TARDE que el rector (-5d): cada uno respeta su offset.
        expect(nP!.enviarEn!.getTime()).toBeGreaterThan(nR!.enviarEn!.getTime());
    });

    it("destinatario email-only con rol explícito filtra su regla", async () => {
        const pl = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL", "Hola", "Vence");
        await crearRegla("suscripcion.por_vencer", "PARENT", "-1d", "EMAIL", pl.clave, true);
        await crearRegla("suscripcion.por_vencer", "SCHOOL_ADMIN", "-5d", "EMAIL", pl.clave, true);

        const result = await programar({
            evento: "suscripcion.por_vencer",
            destinatarios: [{ email: "representante@colegio.com", rol: "SCHOOL_ADMIN", variables: {} }],
        });

        // Solo la regla SCHOOL_ADMIN aplica (1 envío), no la del padre.
        expect(result.programadas).toBe(1);
        const notifs = await prisma.notificacion.findMany();
        expect(notifs).toHaveLength(1);
        expect(notifs[0].destinatarioEmail).toBe("representante@colegio.com");
    });
});
