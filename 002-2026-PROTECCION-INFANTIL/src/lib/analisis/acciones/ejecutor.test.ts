/**
 * SPEC-226 (002-PI-mega-cola, FR-016): tests de INTEGRACIÓN del ejecutor de
 * acciones automáticas. Éxito crear_bono end-to-end (bono + EjecucionAccion +
 * recomendación APLICADA + AuditLog con regla origen), RECOMIENDA no ejecuta,
 * acción desconocida / parámetros inválidos / sujeto inválido → FALLIDA,
 * rate-limit por regla sin efectos colaterales, fallo aislado que no detiene
 * la siguiente ejecución, y rollback por tipo (bono, notificación, operador,
 * alerta) con doble reversión rechazada.
 *
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { ejecutarAccion } from "./ejecutor";
import { revertirEjecucion } from "./rollback";
import { AppError } from "@/lib/errors";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearAdmin() {
    return crearUsuario("ADMIN", unico("admin") + "@test.local");
}

async function crearSuscripcion(estado: "ACTIVA" | "CANCELADA" = "ACTIVA") {
    const { colegio } = await crearColegioConAdmin();
    const admin = await crearAdmin();
    const plan = await prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular: "COLEGIO", duracion: "MES_1", anio: 2026 } },
        update: {},
        create: {
            nombre: unico("Plan"),
            tipoTitular: "COLEGIO",
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "COLEGIO",
            colegioId: colegio.id,
            estado,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 86_400_000),
            codigoReferidoPropio: unico("REF"),
        },
    });
}

async function crearRegla(adminId: string, overrides: Partial<Prisma.ReglaRecomendacionUncheckedCreateInput> = {}) {
    return prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.226"),
            nombre: "Regla de prueba 226",
            descripcion: "Regla de prueba 226",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
            ...overrides,
        },
    });
}

async function crearRecomendacion(reglaId: string, overrides: Partial<Prisma.RecomendacionUncheckedCreateInput> = {}) {
    return prisma.recomendacion.create({
        data: {
            reglaId,
            titulo: "Recomendación de prueba",
            descripcion: "Descripción de prueba",
            categoria: "renovacion",
            prioridad: 80,
            datosContexto: { dedupKey: unico("k") },
            expiraEn: new Date(Date.now() + 7 * 86_400_000),
            ...overrides,
        },
    });
}

const PARAMS_BONO = { tipoBono: "DESCUENTO_PCT", valor: 20, vigenciaDias: 15 };

// .env.test trae DISABLE_RATE_LIMIT=true (E2E); el caso de rate-limit por regla
// necesita el limitador activo (patrón de api/auth/verificar/solicitar).
const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

describe("ejecutarAccion (SPEC-226)", () => {
    beforeEach(async () => {
        await resetDatabase();
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "false";
        }
    });

    afterEach(() => {
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "true";
        }
    });

    it("crear_bono EJECUTA: crea bono, EjecucionAccion EJECUTADA, recomendación APLICADA y AuditLog con regla origen", async () => {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            accionSugerida: "crear_bono",
            accionParametros: PARAMS_BONO,
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("EJECUTADA");
        expect(ejecucion.tipoAccion).toBe("CREAR_BONO");
        expect(ejecucion.origenEjecucion).toBe("AUTOMATICA");
        const resultado = ejecucion.resultado as Record<string, unknown>;
        expect(typeof resultado["bonoId"]).toBe("string");

        const bono = await prisma.bonoPromocional.findUnique({ where: { id: resultado["bonoId"] as string } });
        expect(bono).not.toBeNull();
        expect(bono?.tipo).toBe("DESCUENTO_PCT");
        expect(bono?.valor).toBe(20);
        expect(bono?.activo).toBe(true);
        expect(bono?.aplicaARenovaciones).toBe(true);
        expect(bono?.creadoPorAdminId).toBe(admin.id);
        expect(bono?.nombre).toContain("AUT-");
        // Vigencia: fin - inicio ≈ vigenciaDias + 1 día menos 1 ms (días calendario Bogotá).
        const diffMs = bono!.vigenciaFin.getTime() - bono!.vigenciaInicio.getTime();
        expect(diffMs).toBe((15 + 1) * 86_400_000 - 1);

        const recRecargada = await prisma.recomendacion.findUnique({ where: { id: rec.id } });
        expect(recRecargada?.estado).toBe("APLICADA");
        expect(recRecargada?.ejecutadaAutomatica).toBe(true);
        expect(recRecargada?.motivoResolucion).toBe("EJECUCION_AUTOMATICA");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANALISIS_ACCION_EJECUTADA", recursoId: ejecucion.id },
        });
        expect(audit).not.toBeNull();
        const metadatos = audit?.metadatos as Record<string, unknown>;
        expect(metadatos["reglaId"]).toBe(regla.id);
        expect(metadatos["recomendacionId"]).toBe(rec.id);
    });

    it("regla RECOMIENDA con origen AUTOMATICA → FALLIDA modo_no_ejecuta, sin bono y recomendación PENDIENTE", async () => {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "RECOMIENDA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            accionParametros: PARAMS_BONO,
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("FALLIDA");
        expect(ejecucion.motivoFallo).toBe("modo_no_ejecuta");
        expect(await prisma.bonoPromocional.count()).toBe(0);
        const recRecargada = await prisma.recomendacion.findUnique({ where: { id: rec.id } });
        expect(recRecargada?.estado).toBe("PENDIENTE");
        expect(recRecargada?.ejecutadaAutomatica).toBe(false);
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANALISIS_ACCION_FALLIDA", recursoId: ejecucion.id },
        });
        expect(audit).not.toBeNull();
    });

    it("accionEjecutable desconocida → FALLIDA accion_desconocida y la recomendación no se pierde", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id, { modo: "EJECUTA", accionEjecutable: "borrar_todo" });
        const rec = await crearRecomendacion(regla.id);

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("FALLIDA");
        expect(ejecucion.motivoFallo).toContain("accion_desconocida");
        const recRecargada = await prisma.recomendacion.findUnique({ where: { id: rec.id } });
        expect(recRecargada?.estado).toBe("PENDIENTE");
    });

    it("parámetros inválidos (valor <= 0) → FALLIDA parametros_invalidos, no se crea nada", async () => {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: { ...PARAMS_BONO, valor: -5 },
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            accionParametros: { ...PARAMS_BONO, valor: -5 },
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("FALLIDA");
        expect(ejecucion.motivoFallo).toContain("parametros_invalidos");
        expect(await prisma.bonoPromocional.count()).toBe(0);
    });

    it("suscripción CANCELADA entre generación y ejecución → FALLIDA sujeto_no_valido", async () => {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcion("CANCELADA");
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            accionParametros: PARAMS_BONO,
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("FALLIDA");
        expect(ejecucion.motivoFallo).toBe("sujeto_no_valido");
        expect(await prisma.bonoPromocional.count()).toBe(0);
    });

    it("rate-limit por regla: la ejecución N+1 queda FALLIDA rate_limit_regla sin efectos colaterales", async () => {
        await prisma.parametroSistema.upsert({
            where: { clave: "ratelimit.analisis_accion.max_requests" },
            update: { valor: "1" },
            create: {
                clave: "ratelimit.analisis_accion.max_requests",
                valor: "1",
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });
        await prisma.parametroSistema.upsert({
            where: { clave: "ratelimit.analisis_accion.window_seconds" },
            update: { valor: "3600" },
            create: {
                clave: "ratelimit.analisis_accion.window_seconds",
                valor: "3600",
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });

        const admin = await crearAdmin();
        const s1 = await crearSuscripcion();
        const s2 = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const r1 = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: s1.id,
            accionParametros: PARAMS_BONO,
        });
        const r2 = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: s2.id,
            accionParametros: PARAMS_BONO,
        });

        const e1 = await ejecutarAccion({ recomendacionId: r1.id, origen: "AUTOMATICA" });
        const e2 = await ejecutarAccion({ recomendacionId: r2.id, origen: "AUTOMATICA" });

        expect(e1.estado).toBe("EJECUTADA");
        expect(e2.estado).toBe("FALLIDA");
        expect(e2.motivoFallo).toBe("rate_limit_regla");
        // Sin efectos colaterales: solo un bono (el de la primera).
        expect(await prisma.bonoPromocional.count()).toBe(1);
        const r2Recargada = await prisma.recomendacion.findUnique({ where: { id: r2.id } });
        expect(r2Recargada?.estado).toBe("PENDIENTE");
    });

    it("un fallo aislado no detiene la siguiente ejecución del tick (SC-004)", async () => {
        const admin = await crearAdmin();
        const sMala = await crearSuscripcion("CANCELADA");
        const sBuena = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const rMala = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: sMala.id,
            accionParametros: PARAMS_BONO,
        });
        const rBuena = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: sBuena.id,
            accionParametros: PARAMS_BONO,
        });

        const eMala = await ejecutarAccion({ recomendacionId: rMala.id, origen: "AUTOMATICA" });
        const eBuena = await ejecutarAccion({ recomendacionId: rBuena.id, origen: "AUTOMATICA" });

        expect(eMala.estado).toBe("FALLIDA");
        expect(eBuena.estado).toBe("EJECUTADA");
        expect(await prisma.bonoPromocional.count()).toBe(1);
    });

    it("enviar_notificacion con evento sin reglas del motor → EJECUTADA con programadas = 0", async () => {
        const admin = await crearAdmin();
        const destinatario = await crearUsuario("PARENT", unico("padre") + "@test.local");
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "enviar_notificacion",
            accionParametros: { evento: "evento.inexistente.test" },
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Usuario",
            sujetoId: destinatario.id,
            accionParametros: { evento: "evento.inexistente.test" },
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("EJECUTADA");
        const resultado = ejecucion.resultado as Record<string, unknown>;
        expect(resultado["programadas"]).toBe(0);
    });

    it("asignar_operador menor_carga registra operadorId; sin operadores → FALLIDA sin_operadores_disponibles", async () => {
        const admin = await crearAdmin();
        const operador = await crearUsuario("OPERADOR", unico("op") + "@test.local");
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "asignar_operador",
            accionParametros: { estrategia: "menor_carga" },
        });
        const rec = await crearRecomendacion(regla.id, {
            accionParametros: { estrategia: "menor_carga" },
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("EJECUTADA");
        const resultado = ejecucion.resultado as Record<string, unknown>;
        expect(resultado["operadorId"]).toBe(operador.id);

        // Sin operadores activos disponibles (nueva regla + operador eliminado lógicamente).
        await prisma.usuario.update({ where: { id: operador.id }, data: { estado: "inactivo" } });
        const regla2 = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "asignar_operador",
            accionParametros: { estrategia: "menor_carga" },
        });
        const rec2 = await crearRecomendacion(regla2.id, {
            accionParametros: { estrategia: "menor_carga" },
        });
        const e2 = await ejecutarAccion({ recomendacionId: rec2.id, origen: "AUTOMATICA" });
        expect(e2.estado).toBe("FALLIDA");
        expect(e2.motivoFallo).toBe("sin_operadores_disponibles");
        const rec2Recargada = await prisma.recomendacion.findUnique({ where: { id: rec2.id } });
        expect(rec2Recargada?.estado).toBe("PENDIENTE");
    });

    it("crear_alerta resuelve destinatarios ADMIN activos y queda EJECUTADA", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_alerta",
            accionParametros: { severidad: "ALTA", mensaje: "Prueba de alerta" },
        });
        const rec = await crearRecomendacion(regla.id, {
            accionParametros: { severidad: "ALTA", mensaje: "Prueba de alerta" },
        });

        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        expect(ejecucion.estado).toBe("EJECUTADA");
        const resultado = ejecucion.resultado as Record<string, unknown>;
        expect(resultado["destinatarios"]).toBeGreaterThanOrEqual(1);
        expect(resultado["severidad"]).toBe("ALTA");
    });
});

describe("revertirEjecucion (SPEC-226)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    async function ejecutarBono() {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcion();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            accionParametros: PARAMS_BONO,
        });
        const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });
        return { admin, regla, rec, ejecucion };
    }

    it("rollback de CREAR_BONO: bono desactivado, REVERTIDA con motivo y AuditLog; segunda reversión → 409", async () => {
        const { admin, rec, ejecucion } = await ejecutarBono();
        const bonoId = (ejecucion.resultado as Record<string, unknown>)["bonoId"] as string;

        const { ejecucion: revertida, efectoReversion } = await revertirEjecucion({
            recomendacionId: rec.id,
            motivo: "Descuento mayor al autorizado",
            adminId: admin.id,
        });

        expect(revertida.estado).toBe("REVERTIDA");
        expect(revertida.revertidaPorAdminId).toBe(admin.id);
        expect(revertida.motivoReversion).toBe("Descuento mayor al autorizado");
        expect(efectoReversion.tipo).toBe("CREAR_BONO");
        expect(efectoReversion["bonoId"]).toBe(bonoId);

        const bono = await prisma.bonoPromocional.findUnique({ where: { id: bonoId } });
        expect(bono?.activo).toBe(false);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANALISIS_ACCION_REVERTIDA", recursoId: ejecucion.id },
        });
        expect(audit).not.toBeNull();

        await expect(
            revertirEjecucion({ recomendacionId: rec.id, motivo: "Segunda vez", adminId: admin.id })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rollback de ASIGNAR_OPERADOR: recomendación vuelve a PENDIENTE y queda REVERTIDA", async () => {
        const admin = await crearAdmin();
        await crearUsuario("OPERADOR", unico("op") + "@test.local");
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "asignar_operador",
            accionParametros: { estrategia: "menor_carga" },
        });
        const rec = await crearRecomendacion(regla.id, {
            accionParametros: { estrategia: "menor_carga" },
        });
        await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        const { ejecucion: revertida, efectoReversion } = await revertirEjecucion({
            recomendacionId: rec.id,
            motivo: "Asignación equivocada",
            adminId: admin.id,
        });

        expect(revertida.estado).toBe("REVERTIDA");
        expect(efectoReversion.detalle).toContain("PENDIENTE");
        const recRecargada = await prisma.recomendacion.findUnique({ where: { id: rec.id } });
        expect(recRecargada?.estado).toBe("PENDIENTE");
        expect(recRecargada?.ejecutadaAutomatica).toBe(false);
        expect(recRecargada?.resueltaPorAdminId).toBeNull();
    });

    it("rollback de ENVIAR_NOTIFICACION ya enviada/sin futuras: REVERTIDA con nota 'no reversible (ya enviada)'", async () => {
        const admin = await crearAdmin();
        const destinatario = await crearUsuario("PARENT", unico("padre") + "@test.local");
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "enviar_notificacion",
            accionParametros: { evento: "evento.inexistente.test" },
        });
        const rec = await crearRecomendacion(regla.id, {
            sujetoTipo: "Usuario",
            sujetoId: destinatario.id,
            accionParametros: { evento: "evento.inexistente.test" },
        });
        await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        const { ejecucion: revertida, efectoReversion } = await revertirEjecucion({
            recomendacionId: rec.id,
            motivo: "Envío indebido",
            adminId: admin.id,
        });

        expect(revertida.estado).toBe("REVERTIDA");
        expect(efectoReversion.detalle).toBe("no reversible (ya enviada)");
        const resultado = revertida.resultado as Record<string, unknown>;
        expect((resultado["revertido"] as Record<string, unknown>)["canceladas"]).toBe(0);
    });

    it("rollback de CREAR_ALERTA: REVERTIDA marcada como atendida (registro)", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id, {
            modo: "EJECUTA",
            accionEjecutable: "crear_alerta",
            accionParametros: { severidad: "MEDIA", mensaje: "Alerta de prueba" },
        });
        const rec = await crearRecomendacion(regla.id, {
            accionParametros: { severidad: "MEDIA", mensaje: "Alerta de prueba" },
        });
        await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });

        const { ejecucion: revertida, efectoReversion } = await revertirEjecucion({
            recomendacionId: rec.id,
            motivo: "Falsa alarma",
            adminId: admin.id,
        });

        expect(revertida.estado).toBe("REVERTIDA");
        expect(efectoReversion.detalle).toContain("atendida");
    });

    it("sin ejecución revertible → 409", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id, {});
        const rec = await crearRecomendacion(regla.id, {});

        await expect(
            revertirEjecucion({ recomendacionId: rec.id, motivo: "No hay nada", adminId: admin.id })
        ).rejects.toBeInstanceOf(AppError);
        await expect(
            revertirEjecucion({ recomendacionId: rec.id, motivo: "No hay nada", adminId: admin.id })
        ).rejects.toMatchObject({ statusCode: 409 });
    });
});
