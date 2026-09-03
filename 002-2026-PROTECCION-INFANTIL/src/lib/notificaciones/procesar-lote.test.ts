/**
 * SPEC-292 (002-PI-192 · cierra I-147) — Test integración de `procesarLote`.
 *
 * Reproduce el bug I-147 en modo determinista:
 *  - `Notificacion` `ENCOLADA` con `enviarEn` vencido → se envía.
 *  - `Notificacion` `CANCELADA` → NO se reactiva (dedup).
 *  - `Notificacion` con `enviarEn` futuro → NO se toma.
 *
 * Sin arrancar pg-boss ni el worker; se prueba directamente el módulo puro.
 * Mock del `enviarEmail` para no depender de Resend.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { NotificacionPlantillaRepository } from "@/lib/dal/repositories/notificacion-plantilla";
import { procesarLote, procesarNotificacion } from "./procesar-lote";
import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE_MOTOR } from "./offset";

// SPEC-292: `quietHours` con ventana degenerada para que NUNCA contenga la
// hora del test (ventana no-cruza-medianoche entre `00:00` y `00:01` — al ser
// no-cruza, solo silencia esa ventana muy estrecha). Así el chequeo defensivo
// de `procesarNotificacion:aplicarQuietHours` no interfiere con casos
// deterministas. La cobertura del comportamiento real de quietHours vive en
// `quiet-hours.test.ts` (fuera de este SPEC).
const CONFIG = {
    quietHours: "00:00-00:01",
    maxIntentos: 4,
    backoffSegundos: [60, 300, 1800, 7200],
    loteSize: 20,
};

const PLANTILLA_CLAVE = "spec292.test.email";

async function sembrarPlantilla(): Promise<void> {
    await prisma.notificacionPlantilla.upsert({
        where: { clave: PLANTILLA_CLAVE },
        create: {
            clave: PLANTILLA_CLAVE,
            canal: "EMAIL",
            asunto: "SPEC-292 Test",
            cuerpoMarkdown: "Hola {{nombre}}, este es un test.",
            activa: true,
        },
        update: {},
    });
}

function armarDeps(enviarEmailMock: ReturnType<typeof vi.fn>) {
    return {
        repoNotif: new NotificacionRepository(),
        repoPlantilla: new NotificacionPlantillaRepository(),
        enviarEmail: enviarEmailMock,
    };
}

describe("SPEC-292 · procesarLote (I-147 no vuelve)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarPlantilla();
    });

    it("procesa `ENCOLADA` con enviarEn vencido → ENVIADA (caso feliz que reproduce el bug pre-fix)", async () => {
        const notif = await prisma.notificacion.create({
            data: {
                evento: "spec292.test",
                destinatarioEmail: "test-spec292@innovadataco.com",
                plantillaClave: PLANTILLA_CLAVE,
                canal: "EMAIL",
                variables: { nombre: "Test" },
                enviarEn: new Date(Date.now() - 60_000), // -1 min
                estado: "ENCOLADA",
                intentos: 0,
            },
        });

        const enviarEmail = vi.fn().mockResolvedValue({ id: "test-proveedor-id-123" });
        await procesarLote(armarDeps(enviarEmail), CONFIG);

        const post = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(post?.estado).toBe("ENVIADA");
        expect(post?.proveedorId).toBe("test-proveedor-id-123");
        expect(enviarEmail).toHaveBeenCalledTimes(1);
        expect(enviarEmail).toHaveBeenCalledWith(
            "test-spec292@innovadataco.com",
            "SPEC-292 Test",
            expect.stringContaining("Test"),
        );
    });

    it("NO reactiva `CANCELADA` (dedup por diseño, candado brief §4)", async () => {
        const notif = await prisma.notificacion.create({
            data: {
                evento: "spec292.test",
                destinatarioEmail: "cancelada@innovadataco.com",
                plantillaClave: PLANTILLA_CLAVE,
                canal: "EMAIL",
                variables: {},
                enviarEn: new Date(Date.now() - 60_000),
                estado: "CANCELADA",
                intentos: 0,
                motivoCancelacion: "dedup pre-existente",
            },
        });

        const enviarEmail = vi.fn().mockResolvedValue({ id: "no-debería-llegar" });
        await procesarLote(armarDeps(enviarEmail), CONFIG);

        const post = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(post?.estado).toBe("CANCELADA");
        expect(enviarEmail).not.toHaveBeenCalled();
    });

    it("NO toma `enviarEn` en el futuro (query lo excluye)", async () => {
        const notif = await prisma.notificacion.create({
            data: {
                evento: "spec292.test",
                destinatarioEmail: "futuro@innovadataco.com",
                plantillaClave: PLANTILLA_CLAVE,
                canal: "EMAIL",
                variables: {},
                enviarEn: new Date(Date.now() + 10 * 60_000), // +10 min
                estado: "ENCOLADA",
                intentos: 0,
            },
        });

        const enviarEmail = vi.fn().mockResolvedValue({ id: "no-debería-llegar" });
        await procesarLote(armarDeps(enviarEmail), CONFIG);

        const post = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(post?.estado).toBe("ENCOLADA");
        expect(enviarEmail).not.toHaveBeenCalled();
    });

    it("SPEC-401 (I-283): persiste el motivo REAL del proveedor en `ultimoError`, no un texto genérico", async () => {
        const notif = await prisma.notificacion.create({
            data: {
                evento: "spec292.test",
                destinatarioEmail: "test-spec401@innovadataco.com",
                plantillaClave: PLANTILLA_CLAVE,
                canal: "EMAIL",
                variables: { nombre: "Test" },
                enviarEn: new Date(Date.now() - 60_000),
                estado: "ENCOLADA",
                intentos: 0,
            },
        });

        // Simulamos la forma del error del SDK de Resend: {name, message, statusCode}.
        const { EmailProveedorError, resumirErrorProveedor } = await import("./motivo-error");
        const enviarEmail = vi.fn().mockRejectedValue(
            new EmailProveedorError(
                resumirErrorProveedor({
                    name: "rate_limit_exceeded",
                    message: "You exceeded the rate limit — Recipient rector@example.com",
                    statusCode: 429,
                })
            )
        );

        await procesarLote(armarDeps(enviarEmail), CONFIG);

        const post = await prisma.notificacion.findUnique({ where: { id: notif.id } });
        expect(post?.estado).toBe("REINTENTANDO");
        // 1) trae el name real, 2) trae el statusCode, 3) NO trae el email del destinatario.
        expect(post?.ultimoError).toContain("[rate_limit_exceeded]");
        expect(post?.ultimoError).toContain("[429]");
        expect(post?.ultimoError).not.toContain("rector@example.com");
        expect(post?.ultimoError).toMatch(/<email:[0-9a-f]{8}>/);
        // 4) sigue casando el regex de `senalCorreosFallidos`.
        expect(/(quota|rate\s*limit|429|too\s*many\s*requests)/i.test(post?.ultimoError ?? "")).toBe(true);
    });

    it("lote vacío devuelve `procesadas: 0` sin errores (poll vacío observable)", async () => {
        const enviarEmail = vi.fn();
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        const res = await procesarLote(armarDeps(enviarEmail), CONFIG);

        expect(res.procesadas).toBe(0);
        expect(enviarEmail).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith("[PI-NOTIFICACIONES] poll: 0 pendientes");
        consoleSpy.mockRestore();
    });

    it("procesa múltiples pendientes en el mismo lote (patrón real prod)", async () => {
        for (let i = 0; i < 3; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "spec292.test",
                    destinatarioEmail: `rector-${i}@innovadataco.com`,
                    plantillaClave: PLANTILLA_CLAVE,
                    canal: "EMAIL",
                    variables: { nombre: `Rector ${i}` },
                    enviarEn: new Date(Date.now() - 30_000),
                    estado: "ENCOLADA",
                    intentos: 0,
                },
            });
        }

        const enviarEmail = vi
            .fn()
            .mockResolvedValueOnce({ id: "prov-1" })
            .mockResolvedValueOnce({ id: "prov-2" })
            .mockResolvedValueOnce({ id: "prov-3" });

        const res = await procesarLote(armarDeps(enviarEmail), CONFIG);

        expect(res.procesadas).toBe(3);
        expect(enviarEmail).toHaveBeenCalledTimes(3);
        const enviadas = await prisma.notificacion.findMany({
            where: { estado: "ENVIADA", plantillaClave: PLANTILLA_CLAVE },
        });
        expect(enviadas).toHaveLength(3);
    });
});

describe("SPEC-312 (I-165) · quiet hours skip por canal en procesarNotificacion", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    // 22:00 Bogotá está DENTRO de la ventana 20:00-07:00; `ahora`=22:30 la hace "vencida".
    const CONFIG_VENTANA = {
        quietHours: "20:00-07:00",
        maxIntentos: 4,
        backoffSegundos: [60, 300, 1800, 7200],
        loteSize: 20,
    };
    const enviarEnEnVentana = fromZonedTime(new Date(2026, 7, 22, 22, 0, 0), TIMEZONE_MOTOR);
    const ahora = () => fromZonedTime(new Date(2026, 7, 22, 22, 30, 0), TIMEZONE_MOTOR);

    function depsMock(enviarEmail = vi.fn().mockResolvedValue({ id: "prov-312" })) {
        return {
            repoNotif: {
                marcarEnviando: vi.fn().mockResolvedValue(undefined),
                marcarEnviada: vi.fn().mockResolvedValue(undefined),
                marcarFallida: vi.fn().mockResolvedValue(undefined),
                marcarFallidaDefinitiva: vi.fn().mockResolvedValue(undefined),
                marcarCancelada: vi.fn().mockResolvedValue(undefined),
            },
            repoPlantilla: {
                findByClaveYCanal: vi.fn().mockResolvedValue({
                    clave: "spec312.test",
                    asunto: "SPEC-312",
                    cuerpoMarkdown: "Hola {{nombre}}",
                }),
            },
            enviarEmail,
            ahora,
        } as unknown as Parameters<typeof procesarNotificacion>[2];
    }

    const notifBase = {
        id: "n-312",
        enviarEn: enviarEnEnVentana,
        destinatarioEmail: "test-312@innovadataco.com",
        plantillaClave: "spec312.test",
        variables: { nombre: "Test" },
        intentos: 0,
    };

    it("canal EMAIL vencido dentro de la ventana → NO se difiere (se envía)", async () => {
        const enviarEmail = vi.fn().mockResolvedValue({ id: "prov-email" });
        const res = await procesarNotificacion({ ...notifBase, canal: "EMAIL" }, CONFIG_VENTANA, depsMock(enviarEmail));
        expect(res.accion).toBe("enviada_email");
        expect(enviarEmail).toHaveBeenCalledTimes(1);
    });

    it("canal IN_APP vencido dentro de la ventana → NO se difiere (se envía in-app)", async () => {
        const res = await procesarNotificacion({ ...notifBase, canal: "IN_APP" }, CONFIG_VENTANA, depsMock());
        expect(res.accion).toBe("enviada_in_app");
    });

    it("canal PUSH (hipotético) vencido dentro de la ventana → SÍ se difiere (regresión: la ventana sigue aplicando)", async () => {
        const res = await procesarNotificacion({ ...notifBase, canal: "PUSH" }, CONFIG_VENTANA, depsMock());
        expect(res.accion).toBe("diferida_quiet_hours");
    });
});
