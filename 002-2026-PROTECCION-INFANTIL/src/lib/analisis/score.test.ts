/**
 * SPEC-220 (002-PI-121): tests de integración del servicio de score de valor.
 * Fórmula exacta con pesos default, snapshot de pesos, mapeo por tipo de
 * titular, idempotencia del upsert, percentil por cohorte y purga de retención.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearPlataforma, crearUsuario } from "@/lib/reporte-test-utils";
import {
    calcularScoreTotal,
    asignarPercentilesCohorte,
    recalcularScoresPeriodo,
    purgarSnapshotsAntiguos,
    PESOS_DEFAULT,
} from "./score";
import { periodoActualBogota, periodoLimiteRetencion, rangoMesBogota } from "./periodos";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearPlan(tipoTitular: "COLEGIO" | "PADRE") {
    const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
    // Upsert: varios colegios/padres del mismo test comparten (tipoTitular, MES_1, 2026).
    return prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular, duracion: "MES_1", anio: 2026 } },
        update: {},
        create: {
            nombre: unico("Plan"),
            tipoTitular,
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
}

async function crearSuscripcionColegio(estado: "ACTIVA" | "EN_GRACIA" | "SUSPENDIDA" = "ACTIVA") {
    const { colegio, tenant, admin } = await crearColegioConAdmin();
    const plan = await crearPlan("COLEGIO");
    const suscripcion = await prisma.suscripcion.create({
        data: {
            tipoTitular: "COLEGIO",
            colegioId: colegio.id,
            estado,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: unico("REF"),
        },
    });
    return { suscripcion, colegio, tenant, admin };
}

async function crearSuscripcionPadre() {
    const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
    const plan = await crearPlan("PADRE");
    const suscripcion = await prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId: padre.id,
            estado: "ACTIVA",
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: unico("REF"),
        },
    });
    return { suscripcion, padre };
}

async function crearReporte(data: { usuarioId?: string; tenantId?: string; eliminado?: boolean; creadoEn?: Date }) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: unico("identificador"),
            plataformaId: plataforma.id,
            texto: "Texto del reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "CLASIFICADO",
            usuarioId: data.usuarioId ?? null,
            tenantId: data.tenantId ?? null,
            eliminado: data.eliminado ?? false,
            creadoEn: data.creadoEn ?? new Date(),
        },
    });
}

async function crearAlertaYSeguimiento(colegioId: string, reporteId: string) {
    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            vencimientoSla: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
    });
    const seguimiento = await prisma.seguimientoCaso.create({
        data: { colegioId, alertaId: alerta.id },
    });
    return { alerta, seguimiento };
}

async function crearSesion(usuarioId: string, tenantId: string | null, iniciadaEn?: Date) {
    return prisma.sesionLog.create({
        data: {
            usuarioId,
            tenantId,
            rol: "SCHOOL_ADMIN",
            iniciadaEn: iniciadaEn ?? new Date(),
            ultimaActividadEn: iniciadaEn ?? new Date(),
            ipHash: "hash-test",
        },
    });
}

describe("calcularScoreTotal / asignarPercentilesCohorte (puros)", () => {
    it("aplica la fórmula 3R + 5C + 2A + 1S con los pesos default", () => {
        expect(
            calcularScoreTotal({ reportes: 2, casos: 1, alertas: 1, sesiones: 3 }, PESOS_DEFAULT)
        ).toBe(16);
        expect(
            calcularScoreTotal({ reportes: 0, casos: 0, alertas: 0, sesiones: 0 }, PESOS_DEFAULT)
        ).toBe(0);
    });

    it("asigna percentil 0-100 por posición y null a cohorte unitaria", () => {
        const percentiles = asignarPercentilesCohorte([
            { id: "a", scoreTotal: 10 },
            { id: "b", scoreTotal: 20 },
            { id: "c", scoreTotal: 30 },
        ]);
        expect(percentiles.get("a")).toBe(0);
        expect(percentiles.get("b")).toBe(50);
        expect(percentiles.get("c")).toBe(100);
        expect(asignarPercentilesCohorte([{ id: "solo", scoreTotal: 5 }]).get("solo")).toBeNull();
    });

    it("resuelve empates con rank promedio (mismo percentil)", () => {
        const percentiles = asignarPercentilesCohorte([
            { id: "a", scoreTotal: 10 },
            { id: "b", scoreTotal: 20 },
            { id: "c", scoreTotal: 20 },
            { id: "d", scoreTotal: 30 },
        ]);
        expect(percentiles.get("a")).toBe(0);
        expect(percentiles.get("b")).toBe(percentiles.get("c"));
        expect(percentiles.get("d")).toBe(100);
    });
});

describe("recalcularScoresPeriodo", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("titular COLEGIO: cuenta reportes/casos/alertas/sesiones del período y guarda snapshot de pesos", async () => {
        const { suscripcion, colegio, tenant, admin } = await crearSuscripcionColegio();
        const rango = rangoMesBogota(periodoActualBogota());
        const dentroDelMes = new Date(rango.desde.getTime() + 60 * 60 * 1000);

        // 2 reportes válidos + 1 eliminado + 1 fuera del período (no cuentan)
        const reporteConAlerta = await crearReporte({ tenantId: tenant.id, creadoEn: dentroDelMes });
        await crearReporte({ tenantId: tenant.id, creadoEn: dentroDelMes });
        await crearReporte({ tenantId: tenant.id, eliminado: true, creadoEn: dentroDelMes });
        await crearReporte({ tenantId: tenant.id, creadoEn: new Date(rango.desde.getTime() - 60 * 60 * 1000) });
        // 1 alerta + 1 caso (sobre el primer reporte, sin crear uno nuevo)
        await crearAlertaYSeguimiento(colegio.id, reporteConAlerta.id);
        // 3 sesiones del tenant + 1 sin tenantId (no cuenta)
        await crearSesion(admin.id, tenant.id, dentroDelMes);
        await crearSesion(admin.id, tenant.id, dentroDelMes);
        await crearSesion(admin.id, tenant.id, dentroDelMes);
        await crearSesion(admin.id, null, dentroDelMes);

        const resultado = await recalcularScoresPeriodo();

        expect(resultado.suscripcionesProcesadas).toBe(1);
        const score = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: suscripcion.id, periodo: resultado.periodo } },
        });
        expect(score.componenteReportes).toBe(2);
        expect(score.componenteCasos).toBe(1);
        expect(score.componenteAlertas).toBe(1);
        expect(score.componenteSesiones).toBe(3);
        expect(score.scoreTotal).toBe(2 * 3 + 1 * 5 + 1 * 2 + 3 * 1);
        expect(score.pesoReportes).toBe(3);
        expect(score.pesoCasos).toBe(5);
        expect(score.pesoAlertas).toBe(2);
        expect(score.pesoSesiones).toBe(1);
        // Cohorte unitaria → percentil null
        expect(score.percentilEnCohorte).toBeNull();
    });

    it("titular PADRE: cuenta reportes/expedientes/sesiones del usuario; alertas = 0 en v1", async () => {
        const { suscripcion, padre } = await crearSuscripcionPadre();
        await crearReporte({ usuarioId: padre.id });
        await prisma.expediente.create({
            data: {
                padreUsuarioId: padre.id,
                identificadorReportado: unico("identificador"),
                fechaApertura: new Date(),
                estado: "ACTIVO",
            },
        });
        await crearSesion(padre.id, null);

        const resultado = await recalcularScoresPeriodo();

        const score = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: suscripcion.id, periodo: resultado.periodo } },
        });
        expect(score.componenteReportes).toBe(1);
        expect(score.componenteCasos).toBe(1);
        expect(score.componenteAlertas).toBe(0);
        expect(score.componenteSesiones).toBe(1);
        expect(score.scoreTotal).toBe(1 * 3 + 1 * 5 + 0 * 2 + 1 * 1);
    });

    it("es idempotente: re-ejecutar actualiza la misma fila sin duplicar snapshots", async () => {
        const { suscripcion } = await crearSuscripcionPadre();
        await recalcularScoresPeriodo();
        const segundo = await recalcularScoresPeriodo();

        const filas = await prisma.scoreCliente.findMany({ where: { suscripcionId: suscripcion.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0]!.periodo).toBe(segundo.periodo);
    });

    it("calcula percentil por cohorte (mismo tipoTitular y período)", async () => {
        // 3 colegios con actividad distinta: 0, 1 y 2 reportes → scores 0, 3, 6
        const a = await crearSuscripcionColegio();
        const b = await crearSuscripcionColegio();
        const c = await crearSuscripcionColegio();
        await crearReporte({ tenantId: b.tenant.id });
        await crearReporte({ tenantId: c.tenant.id });
        await crearReporte({ tenantId: c.tenant.id });

        const resultado = await recalcularScoresPeriodo();
        const periodo = resultado.periodo;

        const scoreA = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: a.suscripcion.id, periodo } },
        });
        const scoreB = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: b.suscripcion.id, periodo } },
        });
        const scoreC = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: c.suscripcion.id, periodo } },
        });
        expect(scoreA.percentilEnCohorte).toBe(0);
        expect(scoreB.percentilEnCohorte).toBe(50);
        expect(scoreC.percentilEnCohorte).toBe(100);
    });

    it("no recalcula suscripciones SUSPENDIDA/CANCELADA pero conserva sus snapshots", async () => {
        const { suscripcion } = await crearSuscripcionColegio("SUSPENDIDA");
        await prisma.scoreCliente.create({
            data: {
                suscripcionId: suscripcion.id,
                periodo: periodoActualBogota(),
                pesoReportes: 3,
                pesoCasos: 5,
                pesoAlertas: 2,
                pesoSesiones: 1,
                scoreTotal: 42,
            },
        });

        const resultado = await recalcularScoresPeriodo();

        expect(resultado.suscripcionesProcesadas).toBe(0);
        const historico = await prisma.scoreCliente.findUniqueOrThrow({
            where: { suscripcionId_periodo: { suscripcionId: suscripcion.id, periodo: resultado.periodo } },
        });
        expect(historico.scoreTotal).toBe(42);
    });
});

describe("purgarSnapshotsAntiguos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("borra snapshots fuera de la ventana, conserva los de dentro y registra AuditLog una sola vez", async () => {
        const { suscripcion } = await crearSuscripcionPadre();
        const periodoLimite = periodoLimiteRetencion(24);
        const [anio, mes] = periodoLimite.split("-").map((p) => parseInt(p, 10)) as [number, number];
        const periodoViejo = `${anio - 1}-${String(mes).padStart(2, "0")}`;

        await prisma.scoreCliente.create({
            data: {
                suscripcionId: suscripcion.id,
                periodo: periodoViejo,
                pesoReportes: 3,
                pesoCasos: 5,
                pesoAlertas: 2,
                pesoSesiones: 1,
                scoreTotal: 10,
            },
        });
        await prisma.scoreCliente.create({
            data: {
                suscripcionId: suscripcion.id,
                periodo: periodoActualBogota(),
                pesoReportes: 3,
                pesoCasos: 5,
                pesoAlertas: 2,
                pesoSesiones: 1,
                scoreTotal: 20,
            },
        });

        const primera = await purgarSnapshotsAntiguos();
        expect(primera.filasEliminadas).toBe(1);
        expect(primera.periodoLimite).toBe(periodoLimite);

        const restantes = await prisma.scoreCliente.findMany({ where: { suscripcionId: suscripcion.id } });
        expect(restantes).toHaveLength(1);
        expect(restantes[0]!.periodo).toBe(periodoActualBogota());

        const audits = await prisma.auditLog.findMany({ where: { accion: "ANALISIS_SCORE_PURGA" } });
        expect(audits).toHaveLength(1);
        expect(audits[0]!.tipoRecurso).toBe("ScoreCliente");
        expect(audits[0]!.ipAddress).toBe("worker");

        // Idempotente: sin filas que borrar, no genera segundo AuditLog.
        const segunda = await purgarSnapshotsAntiguos();
        expect(segunda.filasEliminadas).toBe(0);
        expect(
            await prisma.auditLog.count({ where: { accion: "ANALISIS_SCORE_PURGA" } })
        ).toBe(1);
    });
});
