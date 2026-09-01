/**
 * SPEC-236 (002-PI-mega-cola): tests de integración de las tareas del worker
 * del motor de expediente (T046): auto-cierre por inactividad, SLA vencido,
 * subida AMARILLO→ROJO, purga de retención sin borrar filas e idempotencia,
 * y exclusión del advisory lock (segunda instancia no lo adquiere → código 2
 * en el script, que aquí se valida a nivel de pg_try_advisory_lock).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createRequire } from "node:module";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    cerrarExpedientesInactivos,
    vigilarSlaComite,
    purgarRetenidos,
    TEXTO_RETENIDO,
} from "./tareas-motor";

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

const ADVISORY_LOCK_ID = 123456793;

// pg no tiene @types/pg en el repo; se importa con tipado mínimo local.
interface PgClientLike {
    connect(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    end(): Promise<void>;
}
const requirePg = createRequire(import.meta.url);
const { Client: PgClient } = requirePg("pg") as {
    Client: new (config: { connectionString: string }) => PgClientLike;
};

async function seedParametros() {
    const params = [
        { clave: "padre.expediente.auto_cierre_meses", valor: "6" },
        { clave: "padre.expediente.retencion_cerrados_meses", valor: "24" },
        { clave: "padre.expediente.consolidacion_min_reportes", valor: "2" },
        { clave: "padre.comite.sla_horas_normal", valor: "48" },
        { clave: "padre.comite.sla_horas_gravedad_roja", valor: "12" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "test",
            },
        });
    }
}

async function crearExpediente(
    padreId: string,
    overrides: Partial<{
        estado: "ACTIVO" | "PENDIENTE_COMITE" | "CERRADO";
        numEventos: number;
        ultimoEventoEn: Date | null;
        fechaApertura: Date;
        fechaCierre: Date | null;
        scoreGravedadActual: "VERDE" | "AMARILLO" | "ROJO";
        createdAt: Date;
    }> = {}
) {
    const data: Record<string, unknown> = {
        padreUsuarioId: padreId,
        identificadorReportado: `+57302${Math.floor(Math.random() * 1000000)}`,
        fechaApertura: overrides.fechaApertura ?? new Date(),
        estado: overrides.estado ?? "ACTIVO",
        numEventos: overrides.numEventos ?? 1,
        scoreGravedadActual: overrides.scoreGravedadActual ?? "VERDE",
    };
    if (overrides.ultimoEventoEn !== undefined) data.ultimoEventoEn = overrides.ultimoEventoEn;
    if (overrides.fechaCierre !== undefined) data.fechaCierre = overrides.fechaCierre;
    const exp = await prisma.expediente.create({ data: data as never });
    if (overrides.createdAt) {
        return prisma.expediente.update({ where: { id: exp.id }, data: { createdAt: overrides.createdAt } });
    }
    return exp;
}

describe("worker-expediente-motor (SPEC-236)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametros();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // SPEC-340 (D-1): estos dos casos afirmaban el auto-cierre; ahora afirman
    // su DEROGACIÓN — ni siquiera con el parámetro en 6 y un año de inactividad.
    it("auto-cierre DEROGADO: ACTIVO inactivo > 6 meses NO se cierra jamás (SPEC-340)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace7Meses = new Date("2026-01-10T12:00:00.000Z");
        const exp = await crearExpediente(padre.id, { ultimoEventoEn: hace7Meses });
        const ahora = new Date("2026-08-24T12:00:00.000Z");

        const cerrados = await cerrarExpedientesInactivos(ahora);
        expect(cerrados, "derogación incondicional: cero cierres, siempre").toBe(0);

        const actualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
        expect(actualizado?.estado, "el expediente sigue vivo — nada se cierra nunca").toBe("ACTIVO");
        expect(actualizado?.autoCerradoPorInactividad).toBe(false);
    });

    it("auto-cierre derogado: tampoco con actividad reciente (nada cambia)", async () => {
        const padre = await crearUsuario("PARENT");
        // Actividad a las 00:01 Bogotá del día del límite: NO califica.
        const ahora = new Date("2026-08-24T05:01:00.000Z"); // 00:01 Bogotá
        const actividadEnLimite = new Date("2026-02-24T05:01:00.000Z"); // 00:01 Bogotá hace 6 meses
        const exp = await crearExpediente(padre.id, { ultimoEventoEn: actividadEnLimite });

        const cerrados = await cerrarExpedientesInactivos(ahora);
        expect(cerrados).toBe(0);
        const sinCambio = await prisma.expediente.findUnique({ where: { id: exp.id } });
        expect(sinCambio?.estado).toBe("ACTIVO");
    });

    it("SLA: PENDIENTE_COMITE AMARILLO con 49h publica una sola vez (US2.2)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, {
            estado: "PENDIENTE_COMITE",
            scoreGravedadActual: "AMARILLO",
        });
        // Entrada al estado hace 49h.
        const hace49h = new Date(Date.now() - 49 * 60 * 60 * 1000);
        await prisma.expediente.update({ where: { id: exp.id }, data: { updatedAt: hace49h } });

        const primera = await vigilarSlaComite(new Date());
        expect(primera).toBe(1);

        // Segunda pasada sin cambio de estado: no republica (SC-003).
        const segunda = await vigilarSlaComite(new Date());
        expect(segunda).toBe(0);

        const avisos = await prisma.auditLog.count({
            where: { accion: "EXPEDIENTE_SLA_VENCIDO", recursoId: exp.id },
        });
        expect(avisos).toBe(1);
    });

    it("SLA: expediente ROJO vence a las 12h, no a las 48h", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, {
            estado: "PENDIENTE_COMITE",
            scoreGravedadActual: "ROJO",
        });
        const hace13h = new Date(Date.now() - 13 * 60 * 60 * 1000);
        await prisma.expediente.update({ where: { id: exp.id }, data: { updatedAt: hace13h } });

        const alertados = await vigilarSlaComite(new Date());
        expect(alertados).toBe(1);
    });

    it("SLA: PENDIENTE_COMITE dentro del plazo NO alerta", async () => {
        const padre = await crearUsuario("PARENT");
        await crearExpediente(padre.id, { estado: "PENDIENTE_COMITE", scoreGravedadActual: "VERDE" });

        const alertados = await vigilarSlaComite(new Date());
        expect(alertados).toBe(0);
    });

    it("purga: CERRADO antiguo sobrescribe textos con [retenido] sin borrar filas (US3)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace25Meses = new Date("2024-07-01T12:00:00.000Z");
        const exp = await crearExpediente(padre.id, {
            estado: "CERRADO",
            fechaCierre: hace25Meses,
        });
        const evento = await prisma.eventoExpediente.create({
            data: {
                expedienteId: exp.id,
                ordenSecuencial: 1,
                fechaEvento: hace25Meses,
                texto: "texto sensible original",
            },
        });
        const informe = await prisma.informeConsolidado.create({
            data: {
                expedienteId: exp.id,
                versionSecuencial: 1,
                scoreValor: 10,
                scoreGravedad: "VERDE",
                categoriasDetectadasJson: {},
                resumenTextoGenerado: "resumen sensible",
                pdfUrl: "/data/informes/x.pdf",
            },
        });

        const ahora = new Date("2026-08-24T12:00:00.000Z");
        const purgados = await purgarRetenidos(ahora);
        expect(purgados).toBe(1);

        // No se eliminaron filas; solo se sobrescribieron campos.
        const eventoDespues = await prisma.eventoExpediente.findUnique({ where: { id: evento.id } });
        expect(eventoDespues).not.toBeNull();
        expect(eventoDespues?.texto).toBe(TEXTO_RETENIDO);
        const informeDespues = await prisma.informeConsolidado.findUnique({ where: { id: informe.id } });
        expect(informeDespues?.resumenTextoGenerado).toBe(TEXTO_RETENIDO);
        expect(informeDespues?.pdfUrl).toBe(TEXTO_RETENIDO);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_RETENIDO", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();

        // Idempotente: segunda corrida no contabiliza ni duplica auditoría.
        const segunda = await purgarRetenidos(ahora);
        expect(segunda).toBe(0);
        const avisos = await prisma.auditLog.count({
            where: { accion: "EXPEDIENTE_RETENIDO", recursoId: exp.id },
        });
        expect(avisos).toBe(1);
    });

    it("purga: CERRADO dentro del plazo NO se modifica (US3.4)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, { estado: "CERRADO", fechaCierre: new Date() });
        await prisma.eventoExpediente.create({
            data: { expedienteId: exp.id, ordenSecuencial: 1, fechaEvento: new Date(), texto: "vigente" },
        });

        const purgados = await purgarRetenidos(new Date());
        expect(purgados).toBe(0);
        const evento = await prisma.eventoExpediente.findFirst({ where: { expedienteId: exp.id } });
        expect(evento?.texto).toBe("vigente");
    });

    it("advisory lock: una segunda instancia no adquiere el lock (US2.5)", async () => {
        const url = process.env.DATABASE_URL;
        expect(url).toBeTruthy();
        const cliente1 = new PgClient({ connectionString: url! });
        const cliente2 = new PgClient({ connectionString: url! });
        await cliente1.connect();
        await cliente2.connect();
        try {
            const primero = await cliente1.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
            expect(primero.rows[0].locked).toBe(true);
            const segundo = await cliente2.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
            expect(segundo.rows[0].locked).toBe(false);
            await cliente1.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
        } finally {
            await cliente1.end();
            await cliente2.end();
        }
    });
});
