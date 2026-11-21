/**
 * SPEC-962 · CANDADO del CIERRE del camino del colegio (completarCaminoColegio).
 *
 * Cubre:
 *  #2 · completar encola la bienvenida EXACTAMENTE una vez; un 2.º completar NO
 *       duplica (idempotencia por compare-and-set en Colegio.bienvenidaEnviadaEn).
 *  #3 · la constancia del correo lleva la fecha/versión de la ACEPTACIÓN GUARDADA,
 *       no la de «ahora».
 *  #4 · con un paso pendiente NO encola y devuelve `pendiente` (el redirect al paso
 *       lo hace la server action; acá se prueba que NO se dispara el correo).
 *
 * La derivación de pasos (estado-colegio.ts) se MOCKEA: su corrección vive en su
 * propio dominio/tests; acá se vigila lo que SPEC-962 agrega (marca + envío único +
 * fecha guardada). Control positivo: si se quitara el compare-and-set, el 2.º
 * completar volvería a encolar y el caso de idempotencia se pondría rojo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";

// La derivación de pasos se controla desde el test (no montamos los 5 pasos reales).
vi.mock("./estado-colegio", () => ({
    derivarPasoPendienteColegio: vi.fn(),
}));

import { derivarPasoPendienteColegio } from "./estado-colegio";
import { completarCaminoColegio } from "./completar-colegio";

const derivarMock = vi.mocked(derivarPasoPendienteColegio);

const EVENTO_BIENVENIDA = "colegio.bienvenida_rector";
const TZ = "America/Bogota";

async function sembrarReglaBienvenidaRector() {
    await prisma.notificacionPlantilla.upsert({
        where: { clave: `${EVENTO_BIENVENIDA}.email` },
        update: { activa: true },
        create: {
            clave: `${EVENTO_BIENVENIDA}.email`,
            canal: "EMAIL",
            asunto: "Su cuenta de {{nombreColegio}} está lista",
            cuerpoMarkdown:
                "Hola,\n\nLa cuenta de {{nombreColegio}} quedó lista.\n\nAceptación v{{version}} el {{fechaAceptacion}}.\n\n[Entrar a mi panel]({{urlPanel}})",
            variablesSchema: {
                type: "object",
                properties: {
                    nombreColegio: { type: "string" },
                    version: { type: "string" },
                    fechaAceptacion: { type: "string" },
                    urlPanel: { type: "string" },
                },
            },
            activa: true,
        },
    });
    await prisma.notificacionRegla.upsert({
        where: {
            evento_canal_plantillaClave_rol: {
                evento: EVENTO_BIENVENIDA,
                canal: "EMAIL",
                plantillaClave: `${EVENTO_BIENVENIDA}.email`,
                rol: "SCHOOL_ADMIN",
            },
        },
        update: { activa: true },
        create: {
            evento: EVENTO_BIENVENIDA,
            rol: "SCHOOL_ADMIN",
            canal: "EMAIL",
            plantillaClave: `${EVENTO_BIENVENIDA}.email`,
            offset: "+0m",
            obligatoria: true,
            activa: true,
        },
    });
}

function contarBienvenida(usuarioId: string) {
    return prisma.notificacion.count({ where: { evento: EVENTO_BIENVENIDA, destinatarioUsuarioId: usuarioId } });
}

describe("SPEC-962 · completarCaminoColegio", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarReglaBienvenidaRector();
        derivarMock.mockReset();
    });

    it("#4 · con un paso pendiente: NO encola y devuelve pendiente", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        derivarMock.mockResolvedValue("profesores");

        const r = await completarCaminoColegio(admin.id);

        expect(r).toEqual({ estado: "pendiente", paso: "profesores" });
        expect(await contarBienvenida(admin.id)).toBe(0);
        const fresco = await prisma.colegio.findUniqueOrThrow({ where: { id: colegio.id }, select: { bienvenidaEnviadaEn: true } });
        expect(fresco.bienvenidaEnviadaEn).toBeNull();
    });

    it("#2/#3 · primer cierre: marca, encola UNA vez, con la fecha GUARDADA de la aceptación", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        // Aceptación guardada en una fecha PASADA y conocida (no «ahora»).
        const aceptadoEn = new Date("2026-11-01T15:30:00.000Z");
        await prisma.usuario.update({
            where: { id: admin.id },
            data: { consentimientoVersion: "v0.4", consentimientoAceptadoEn: aceptadoEn },
        });
        derivarMock.mockResolvedValue(null);

        const r = await completarCaminoColegio(admin.id);
        expect(r).toEqual({ estado: "completado" });

        // Marca durable fijada.
        const marcado = await prisma.colegio.findUniqueOrThrow({ where: { id: colegio.id }, select: { bienvenidaEnviadaEn: true } });
        expect(marcado.bienvenidaEnviadaEn).not.toBeNull();

        // Encolado EXACTAMENTE una vez.
        expect(await contarBienvenida(admin.id)).toBe(1);

        // #3 · la constancia es la fecha/versión GUARDADA, no «ahora».
        const notif = await prisma.notificacion.findFirstOrThrow({
            where: { evento: EVENTO_BIENVENIDA, destinatarioUsuarioId: admin.id },
        });
        const vars = notif.variables as Record<string, unknown>;
        const esperado = formatInTimeZone(aceptadoEn, TZ, "yyyy-MM-dd HH:mm");
        expect(vars.fechaAceptacion).toBe(esperado);
        expect(vars.version).toBe("v0.4");
        // Prueba explícita de que NO es la fecha de hoy (el día del cierre).
        const hoy = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
        expect(String(vars.fechaAceptacion).startsWith(hoy)).toBe(false);
    });

    it("#2 · un 2.º cierre (o visita a /listo) NO duplica el correo", async () => {
        const { admin } = await crearColegioConAdmin();
        await prisma.usuario.update({
            where: { id: admin.id },
            data: { consentimientoVersion: "v0.4", consentimientoAceptadoEn: new Date("2026-11-01T15:30:00.000Z") },
        });
        derivarMock.mockResolvedValue(null);

        const r1 = await completarCaminoColegio(admin.id);
        const r2 = await completarCaminoColegio(admin.id);

        expect(r1).toEqual({ estado: "completado" });
        expect(r2).toEqual({ estado: "ya_completado" });
        expect(await contarBienvenida(admin.id)).toBe(1);
    });

    it("backfill · colegio con la bienvenida YA enviada (pre-SPEC-962) → completar NO reencola", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        await prisma.usuario.update({
            where: { id: admin.id },
            data: { consentimientoVersion: "v0.4", consentimientoAceptadoEn: new Date("2026-11-01T15:30:00.000Z") },
        });
        // Estado post-backfill: el colegio recibió la bienvenida al ACEPTAR (pre-962),
        // así que la migración le sembró la marca. Al TERMINAR, no debe recibir otra.
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { bienvenidaEnviadaEn: new Date("2026-11-05T12:00:00.000Z") },
        });
        derivarMock.mockResolvedValue(null);

        const r = await completarCaminoColegio(admin.id);
        expect(r).toEqual({ estado: "ya_completado" });
        expect(await contarBienvenida(admin.id)).toBe(0);
    });
});
