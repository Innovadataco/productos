/**
 * SPEC-722 · CANDADO de la siembra de estados del padre (+e2epadre).
 *
 * Prueba de conducta, contra la BD, de lo que el CEO corre en prod:
 *  - SOLO cuentas `+e2epadre` (por construcción): un PARENT sin ese patrón NO se toca.
 *  - Los 4 estados quedan: hijo con cuenta activa+plataforma + reporte de OTRO que CRUZA
 *    (I-429, se ve por `listarCuentasReportadasPorOtros` → enciende el ámbar), círculo con
 *    2 reportados, cita CONFIRMADA, y el padre marcado sembrado (ve profesionales demo).
 *  - Idempotente: la 2ª corrida no duplica (yaSembrado corta).
 *  - Todo marcado en demo_marcado (corrida e2epadre-722) → purgable, no cuenta como real.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { listarCuentasReportadasPorOtros } from "@/lib/dal/services/hijos/reportes-ajenos";
import { prisma as demoPrisma } from "../../scripts/demo-prod/lib/prisma";
import {
    padresE2E,
    yaSembrado,
    sembrarPadre,
    resolverBase,
    asegurarOtroReportante,
    asegurarProfConFranjas,
    CORRIDA,
    HIJO_NOMBRE,
} from "../../scripts/demo-prod/sembrar-estados-padre";

async function sembrarBase() {
    // resetDatabase ya siembra la plataforma whatsapp + permisos; falta país/ciudad/admin.
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    const bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    if (!bogota) {
        await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } });
    }
    await crearUsuario("ADMIN", `admin.${Date.now()}@ejemplo.local`);
}

/** Mirror del camino --confirm de main() para las cuentas pendientes. */
async function correrSiembra() {
    const padres = await padresE2E();
    const pendientes = [];
    for (const p of padres) if (!(await yaSembrado(p.id))) pendientes.push(p);
    if (pendientes.length === 0) return 0;
    const base = await resolverBase();
    const otro = await asegurarOtroReportante(base);
    const { franjasLibres } = await asegurarProfConFranjas(base, pendientes.length);
    for (let i = 0; i < pendientes.length; i++) {
        await sembrarPadre(base, pendientes[i]!, otro, franjasLibres[i]!);
    }
    return pendientes.length;
}

describe("SPEC-722 · siembra de estados del padre (+e2epadre)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarBase();
    });
    afterAll(async () => {
        await demoPrisma.$disconnect();
    });

    it("por CONSTRUCCIÓN solo toca +e2epadre: un PARENT sin ese patrón queda intacto", async () => {
        const e2e = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const ajeno = await crearUsuario("PARENT", "jelkin.personal@innovadataco.com");

        const seleccion = await padresE2E();
        expect(seleccion.map((p) => p.id)).toContain(e2e.id);
        expect(seleccion.map((p) => p.id)).not.toContain(ajeno.id);

        await correrSiembra();
        // El ajeno no recibió NADA.
        expect(await prisma.hijo.count({ where: { usuarioId: ajeno.id } })).toBe(0);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: ajeno.id } })).toBe(0);
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: ajeno.id } })).toBeNull();
    });

    it("deja los 4 estados; el reporte de OTRO CRUZA (I-429) y enciende el ámbar del hijo", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        await correrSiembra();

        // (1) hijo con cuenta activa + plataforma.
        const hijo = await prisma.hijo.findFirstOrThrow({ where: { usuarioId: padre.id, nombre: HIJO_NOMBRE }, select: { id: true } });
        const ident = await prisma.identificadorHijo.findFirstOrThrow({ where: { hijoId: hijo.id }, select: { activo: true, plataformaId: true } });
        expect(ident.activo).toBe(true);
        expect(ident.plataformaId).not.toBeNull();

        // (1-clave) el reporte de OTRO se VE por reportes-ajenos → ámbar/SPEC-716A.
        const cuentas = await listarCuentasReportadasPorOtros(padre.id);
        expect(cuentas.length, "el hijo tiene al menos una cuenta con reportes de otros").toBeGreaterThan(0);
        expect(cuentas.some((h) => h.cuentas.length > 0)).toBe(true);

        // (2) círculo con 2 reportados.
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(2);

        // (3) una cita CONFIRMADA.
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id, estado: "CONFIRMADA" } })).toBe(1);

        // (4) el padre marcado sembrado (ve profesionales demo).
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: padre.id } })).not.toBeNull();

        // todo marcado con la corrida (purgable).
        const marca = await prisma.demoMarcado.findFirst({ where: { entidad: "Hijo", entidadId: hijo.id } });
        expect((marca?.metadata as { corrida?: string } | null)?.corrida).toBe(CORRIDA);
    });

    it("IDEMPOTENTE: la 2ª corrida no duplica hijo, círculo ni cita", async () => {
        const padre = await crearUsuario("PARENT", "cal+e2epadre@innovadataco.com");
        const n1 = await correrSiembra();
        expect(n1).toBe(1);
        expect(await yaSembrado(padre.id)).toBe(true);

        const n2 = await correrSiembra();
        expect(n2, "la 2ª corrida no siembra a nadie").toBe(0);
        expect(await prisma.hijo.count({ where: { usuarioId: padre.id, nombre: HIJO_NOMBRE } })).toBe(1);
        expect(await prisma.contactoConfianza.count({ where: { usuarioId: padre.id } })).toBe(2);
        expect(await prisma.solicitudCita.count({ where: { padreUsuarioId: padre.id } })).toBe(1);
    });
});
