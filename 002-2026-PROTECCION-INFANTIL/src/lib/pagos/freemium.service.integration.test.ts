/**
 * SPEC-217 (002-PI-117): tests de integración del freemium (T008/T009/T010).
 * Base de datos real: activación al registrar, anti-doble freemium (usuario y
 * colegio) y pago durante freemium con extensión de vigencia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DuracionPlan, EstadoSuscripcion, TipoTitular } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearUsuario } from "@/lib/reporte-test-utils";
import { crearSuscripcionCliente, extenderVigenciaDesdeFreemium } from "./freemium.service";
import { anioBogota } from "./renovacion-calculos";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function sembrarParametrosFreemium(activo = true, duracionDias = 30) {
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.freemium.activo" },
        update: { valor: String(activo) },
        create: {
            clave: "pagos.freemium.activo",
            valor: String(activo),
            tipo: "BOOLEAN",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.freemium.duracion_dias" },
        update: { valor: String(duracionDias) },
        create: {
            clave: "pagos.freemium.duracion_dias",
            valor: String(duracionDias),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

async function crearPlanBasico(tipoTitular: TipoTitular) {
    const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
    const anio = anioBogota();
    // Upsert por la clave única: varios tests comparten (tipoTitular, MES_1, año).
    return prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular, duracion: DuracionPlan.MES_1, anio } },
        update: { activo: true },
        create: {
            nombre: unico("Plan"),
            tipoTitular,
            duracion: DuracionPlan.MES_1,
            anio,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
}

describe("freemium.service (integración)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarParametrosFreemium();
    });

    it("T008: activación al registrar — ACTIVA + esFreemium + freemiumFechaFin +30 días (AS-001/AS-002)", async () => {
        const plan = await crearPlanBasico(TipoTitular.PADRE);
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");

        const resultado = await crearSuscripcionCliente({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            actorUsuarioId: padre.id,
        });

        expect(resultado.esFreemium).toBe(true);
        expect(resultado.estado).toBe(EstadoSuscripcion.ACTIVA);

        const suscripcion = await prisma.suscripcion.findUnique({ where: { id: resultado.suscripcionId } });
        expect(suscripcion?.esFreemium).toBe(true);
        expect(suscripcion?.planActualId).toBe(plan.id);
        expect(suscripcion?.freemiumFechaFin).not.toBeNull();
        expect(suscripcion?.fechaFin.toISOString()).toBe(suscripcion?.freemiumFechaFin?.toISOString());
        // FR-003: ~30 días calendario Bogotá después del inicio.
        const diffDias =
            ((suscripcion?.freemiumFechaFin?.getTime() ?? 0) - (suscripcion?.fechaInicio.getTime() ?? 0)) /
            (24 * 60 * 60 * 1000);
        expect(diffDias).toBeGreaterThan(29);
        expect(diffDias).toBeLessThan(32);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "SUSCRIPCION_FREEMIUM_ACTIVADA", recursoId: resultado.suscripcionId },
        });
        expect(audit).not.toBeNull();
    });

    it("T009a: anti-doble freemium por usuarioId — el segundo registro nace SUSPENDIDA (AS-003)", async () => {
        await crearPlanBasico(TipoTitular.PADRE);
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");

        const primera = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: padre.id });
        expect(primera.esFreemium).toBe(true);

        const segunda = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: padre.id });
        expect(segunda.esFreemium).toBe(false);
        expect(segunda.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
    });

    it("T009b: anti-doble freemium por colegioId — el histórico es del colegio, no del rector (Decisión 1)", async () => {
        await crearPlanBasico(TipoTitular.COLEGIO);
        const { colegio } = await crearColegioConAdmin();

        const primera = await crearSuscripcionCliente({ tipoTitular: TipoTitular.COLEGIO, colegioId: colegio.id });
        expect(primera.esFreemium).toBe(true);

        const segunda = await crearSuscripcionCliente({ tipoTitular: TipoTitular.COLEGIO, colegioId: colegio.id });
        expect(segunda.esFreemium).toBe(false);
        expect(segunda.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
    });

    it("T009c: con pagos.freemium.activo=false no se activa freemium", async () => {
        await sembrarParametrosFreemium(false);
        await crearPlanBasico(TipoTitular.PADRE);
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");

        const resultado = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: padre.id });
        expect(resultado.esFreemium).toBe(false);
        expect(resultado.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
    });

    it("T010: pago durante freemium — esFreemium=false y vigencia extendida desde freemiumFechaFin (AS-004)", async () => {
        await crearPlanBasico(TipoTitular.PADRE);
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const creada = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: padre.id });

        const antes = await prisma.suscripcion.findUnique({ where: { id: creada.suscripcionId } });
        const freemiumFechaFin = antes?.freemiumFechaFin;
        expect(freemiumFechaFin).not.toBeNull();

        const resultado = await extenderVigenciaDesdeFreemium({
            suscripcionId: creada.suscripcionId,
            duracionCubierta: DuracionPlan.MES_1,
            actorAdminId: admin.id,
        });

        expect(resultado?.suscripcionId).toBe(creada.suscripcionId);
        const despues = await prisma.suscripcion.findUnique({ where: { id: creada.suscripcionId } });
        expect(despues?.esFreemium).toBe(false);
        // La marca de histórico sobrevive a la conversión (FR-004).
        expect(despues?.freemiumFechaFin?.toISOString()).toBe(freemiumFechaFin?.toISOString());
        // FR-005: fechaFin = freemiumFechaFin + 1 mes.
        const esperado = new Date(freemiumFechaFin as Date);
        esperado.setMonth(esperado.getMonth() + 1);
        expect(despues?.fechaFin.toISOString()).toBe(esperado.toISOString());
        expect(despues?.estado).toBe(EstadoSuscripcion.ACTIVA);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "SUSCRIPCION_FREEMIUM_CONVERTIDA", recursoId: creada.suscripcionId },
        });
        expect(audit).not.toBeNull();

        // Anti-doble freemium tras la conversión: el histórico sigue contando.
        const tercera = await crearSuscripcionCliente({ tipoTitular: TipoTitular.PADRE, usuarioId: padre.id });
        expect(tercera.esFreemium).toBe(false);
    });
});
