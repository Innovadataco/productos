/**
 * SPEC-223 (002-PI-124): tests de integración del digest semanal al CEO.
 * Cubre FR-016: idempotencia (2 corridas), reintento de FALLIDO, resolución de
 * destinatarios (parámetro / default ADMIN / correo inválido / sin
 * destinatarios), KPIs con datos sembrados, opt-out respetado, motor sin
 * reglas → FALLIDO, enabled=false y seed idempotente.
 *
 * Semana fija de prueba: corrida el lunes 2026-08-24 08:00 Bogotá → ventana
 * [2026-08-17 00:00, 2026-08-24 00:00) Bogotá, periodo "2026-W34", período
 * mensual de scores "2026-08".
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedDigestSemanal } from "../../../prisma/seed";
import { ejecutarDigestSemanal, ESTADO_DIGEST } from "./digest-semanal";

const AHORA = new Date("2026-08-24T13:00:00.000Z"); // lunes 08:00 Bogotá
const PERIODO = "2026-W34";
const DENTRO = new Date("2026-08-20T15:00:00.000Z"); // jueves de la semana medida

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearAdmin(email?: string) {
    return crearUsuario("ADMIN", email ?? `${unico("admin")}@test.local`);
}

async function crearPlan() {
    const admin = await crearAdmin();
    return prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_1", anio: 2026 } },
        update: {},
        create: {
            nombre: unico("Plan"),
            tipoTitular: "PADRE",
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
}

async function crearSuscripcion(opts: { createdAt: Date; canceladaEn?: Date | null }) {
    const padre = await crearUsuario("PARENT", `${unico("padre")}@test.local`);
    const plan = await crearPlan();
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId: padre.id,
            estado: opts.canceladaEn ? "CANCELADA" : "ACTIVA",
            planActualId: plan.id,
            fechaInicio: opts.createdAt,
            fechaFin: new Date(opts.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: unico("REF"),
            createdAt: opts.createdAt,
            canceladaEn: opts.canceladaEn ?? null,
        },
    });
}

async function crearPagoAutorizado(suscripcionId: string, montoNetoUSD: number, fechaAutorizacion: Date) {
    return prisma.pago.create({
        data: {
            suscripcionId,
            duracionCubierta: "MES_1",
            montoBaseUSD: montoNetoUSD,
            montoNetoUSD,
            tasaCambioAplicada: 4000,
            montoLocalPagado: montoNetoUSD * 4000,
            monedaLocal: "COP",
            metodoDeclarado: "TRANSFERENCIA",
            comprobanteAdjuntoUrl: "https://example.com/comprobante.pdf",
            comprobanteMimeType: "application/pdf",
            comprobanteHashSha256: unico("hash"),
            fechaReporte: fechaAutorizacion,
            fechaAutorizacion,
            estado: "AUTORIZADO",
        },
    });
}

async function crearRecomendacion(prioridad: number, estado: "PENDIENTE" | "APLICADA" = "PENDIENTE") {
    const admin = await crearAdmin();
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla"),
            nombre: "Regla test",
            descripcion: "Regla de prueba",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "{{titulo}}",
            prioridad,
            creadaPorAdminId: admin.id,
        },
    });
    return prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: `Decisión prioridad ${prioridad}`,
            descripcion: `Descripción ${prioridad}`,
            categoria: "renovacion",
            prioridad,
            datosContexto: {},
            accionSugerida: `Acción ${prioridad}`,
            estado,
            expiraEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
}

async function parametro(clave: string, valor: string, tipo: "BOOLEAN" | "STRING" = "STRING") {
    return prisma.parametroSistema.upsert({
        where: { clave },
        update: { valor },
        create: {
            clave,
            valor,
            tipo,
            categoria: "SYSTEM",
            esPublico: false,
            esSecreto: false,
            descripcion: "param de test",
        },
    });
}

function digestsDe(destinatarioId: string) {
    return prisma.digestSemanal.findMany({ where: { periodo: PERIODO, destinatarioId } });
}

beforeEach(async () => {
    await resetDatabase();
    await seedDigestSemanal();
});

describe("ejecutarDigestSemanal", () => {
    it("enabled=false → omite la corrida sin generar nada", async () => {
        await parametro("analisis.digest.enabled", "false", "BOOLEAN");
        await crearAdmin();
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.ejecutada).toBe(false);
        expect(r.motivo).toBe("deshabilitada");
        expect(await prisma.digestSemanal.count()).toBe(0);
    });

    it("sin parámetro de correos, envía a todos los ADMIN activos (no a otros roles)", async () => {
        const admin1 = await crearAdmin();
        const admin2 = await crearAdmin();
        await crearUsuario("OPERADOR", `${unico("op")}@test.local`);
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r).toMatchObject({ ejecutada: true, periodo: PERIODO, enviados: 2, fallidos: 0, omitidos: 0 });
        expect(await digestsDe(admin1.id)).toHaveLength(1);
        expect(await digestsDe(admin2.id)).toHaveLength(1);
        const notifs = await prisma.notificacion.findMany({
            where: { evento: "analisis.digest.semanal", destinatarioUsuarioId: admin1.id },
        });
        expect(new Set(notifs.map((n) => n.canal))).toEqual(new Set(["EMAIL", "IN_APP"]));
        const digest = (await digestsDe(admin1.id))[0]!;
        expect(digest.estado).toBe(ESTADO_DIGEST.ENVIADO);
        expect(digest.enviadoEn).not.toBeNull();
        expect(digest.enlacePanel).toContain("/dashboard/admin/estadisticas/dinero-vs-valor");
        // Auditoría SYSTEM: usuarioId null en las 3 acciones posibles.
        const audits = await prisma.auditLog.findMany({
            where: { accion: { in: ["ANALISIS_DIGEST_GENERADO", "ANALISIS_DIGEST_ENVIADO", "ANALISIS_DIGEST_FALLIDO"] } },
        });
        expect(audits.length).toBeGreaterThanOrEqual(4); // GENERADO + ENVIADO por admin
        expect(audits.every((a) => a.usuarioId === null)).toBe(true);
        expect(audits.every((a) => a.ipAddress === "worker")).toBe(true);
    });

    it("idempotencia: una segunda corrida la misma semana es no-op", async () => {
        const admin = await crearAdmin();
        await ejecutarDigestSemanal(AHORA);
        const r2 = await ejecutarDigestSemanal(AHORA);
        expect(r2.enviados).toBe(0);
        expect(r2.omitidos).toBe(1);
        expect(await digestsDe(admin.id)).toHaveLength(1);
    });

    it("un digest FALLIDO se regenera y envía en la reejecución", async () => {
        const admin = await crearAdmin();
        await ejecutarDigestSemanal(AHORA);
        await prisma.digestSemanal.updateMany({
            where: { periodo: PERIODO, destinatarioId: admin.id },
            data: { estado: ESTADO_DIGEST.FALLIDO },
        });
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.enviados).toBe(1);
        const digest = (await digestsDe(admin.id))[0]!;
        expect(digest.estado).toBe(ESTADO_DIGEST.ENVIADO);
    });

    it("parámetro de correos: resuelve usuarios, envía email-only sin fila y omite correos mal formados", async () => {
        const admin = await crearAdmin();
        const emailOnly = `${unico("externo")}@test.local`;
        await parametro(
            "analisis.digest.destinatarios_emails",
            `${admin.email}, ${emailOnly}, correo-malo`
        );
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.enviados).toBe(2); // admin (con fila) + email-only (sin fila)
        expect(r.generados).toBe(1); // solo el destinatario con usuarioId tiene fila
        expect(await digestsDe(admin.id)).toHaveLength(1);
        const notifEmailOnly = await prisma.notificacion.findMany({
            where: { evento: "analisis.digest.semanal", destinatarioEmail: emailOnly },
        });
        expect(notifEmailOnly.length).toBeGreaterThan(0);
        const auditEmailOnly = await prisma.auditLog.findFirst({
            where: { accion: "ANALISIS_DIGEST_ENVIADO", tipoRecurso: "DigestSemanal", recursoId: null },
        });
        expect(auditEmailOnly).not.toBeNull();
    });

    it("sin destinatarios resolubles → AuditLog FALLIDO sin_destinatarios, sin excepción", async () => {
        const r = await ejecutarDigestSemanal(AHORA); // sin usuarios ADMIN
        expect(r).toMatchObject({ ejecutada: true, motivo: "sin_destinatarios", periodo: PERIODO, enviados: 0 });
        const audit = await prisma.auditLog.findFirst({ where: { accion: "ANALISIS_DIGEST_FALLIDO" } });
        expect(audit).not.toBeNull();
        expect(audit!.usuarioId).toBeNull();
        expect((audit!.metadatos as { motivo?: string }).motivo).toBe("sin_destinatarios");
    });

    it("motor sin reglas activas → digest FALLIDO con motivo documentado", async () => {
        await prisma.notificacionRegla.deleteMany({ where: { evento: "analisis.digest.semanal" } });
        const admin = await crearAdmin();
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.fallidos).toBe(1);
        const digest = (await digestsDe(admin.id))[0]!;
        expect(digest.estado).toBe(ESTADO_DIGEST.FALLIDO);
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANALISIS_DIGEST_FALLIDO", recursoId: digest.id },
        });
        expect((audit!.metadatos as { motivo?: string }).motivo).toBe("sin_reglas_activas_motor");
    });

    it("opt-out del canal email: solo queda IN_APP y el digest NO es fallido", async () => {
        const admin = await crearAdmin();
        await prisma.notificacionPreferencia.create({
            data: { usuarioId: admin.id, eventoRegla: "analisis.digest.semanal.email", habilitado: false },
        });
        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.enviados).toBe(1);
        expect(r.fallidos).toBe(0);
        const notifs = await prisma.notificacion.findMany({
            where: { evento: "analisis.digest.semanal", destinatarioUsuarioId: admin.id },
        });
        expect(notifs.map((n) => n.canal)).toEqual(["IN_APP"]);
        const digest = (await digestsDe(admin.id))[0]!;
        expect(digest.estado).toBe(ESTADO_DIGEST.ENVIADO);
    });

    it("KPIs: recaudo/nuevas/canceladas de la ventana y top 5 por prioridad persistidos en el digest", async () => {
        const admin = await crearAdmin();
        // Los fixtures crean otros ADMIN (planes/suscripciones): fija el
        // destinatario para que el envío sea solo al admin del test.
        await parametro("analisis.digest.destinatarios_emails", admin.email);
        // Semana actual: 1 nueva, 1 cancelada, 2 pagos autorizados (100 + 50 USD).
        const sNueva = await crearSuscripcion({ createdAt: DENTRO });
        const sCancelada = await crearSuscripcion({
            createdAt: new Date("2026-07-01T10:00:00.000Z"),
            canceladaEn: DENTRO,
        });
        await crearPagoAutorizado(sNueva.id, 100, DENTRO);
        await crearPagoAutorizado(sCancelada.id, 50, DENTRO);
        // Fuera de la ventana (semana previa): no cuenta en kpisSemana.
        const sPrevia = await crearSuscripcion({ createdAt: new Date("2026-08-10T10:00:00.000Z") });
        await crearPagoAutorizado(sPrevia.id, 999, new Date("2026-08-11T10:00:00.000Z"));
        // Recomendaciones: 6 PENDIENTE (el top 5 excluye la de menor prioridad) + 1 APLICADA (excluida).
        for (const p of [10, 20, 30, 40, 50, 60]) await crearRecomendacion(p);
        await crearRecomendacion(99, "APLICADA");

        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.enviados).toBe(1);
        const digest = (await digestsDe(admin.id))[0]!;
        const kpis = digest.kpisSemana as {
            recaudoUSD: number;
            recaudoCOP: number;
            nuevas: number;
            canceladas: number;
            churnRate: number | null;
            scorePromedio: number | null;
        };
        expect(kpis.recaudoUSD).toBe(150);
        expect(kpis.recaudoCOP).toBe(600000);
        expect(kpis.nuevas).toBe(1);
        expect(kpis.canceladas).toBe(1);
        expect(kpis.churnRate).not.toBeNull();
        expect(kpis.scorePromedio).toBeNull(); // sin snapshots del período
        const top5 = digest.top5Decisiones as { titulo: string; accion: string | null }[];
        expect(top5).toHaveLength(5);
        expect(top5[0]!.titulo).toBe("Decisión prioridad 60");
        expect(top5.map((d) => d.titulo)).not.toContain("Decisión prioridad 10");
        expect(top5.map((d) => d.titulo)).not.toContain("Decisión prioridad 99");
        // Deltas vs semana previa: recaudo previo 999 → delta -849.
        const deltas = digest.kpisVsPrevia as { recaudoUSD: number; nuevas: number };
        expect(deltas.recaudoUSD).toBe(-849);
        expect(deltas.nuevas).toBe(0); // 1 nueva en cada semana
    });
});

describe("contenido del digest: scores, anomalías y variables renderizadas", () => {
    it("ganadores/perdedores con nombre del cliente y anomalías llegan en las variables de la notificación", async () => {
        const admin = await crearAdmin();
        // Los fixtures crean otros ADMIN: fija el destinatario al admin del test.
        await parametro("analisis.digest.destinatarios_emails", admin.email);
        // 5 snapshots del período 2026-08 (90/70/50/30/10) para top/bottom 3.
        for (const total of [90, 70, 50, 30, 10]) {
            const suscripcion = await crearSuscripcion({ createdAt: new Date("2026-07-01T10:00:00.000Z") });
            await prisma.scoreCliente.create({
                data: {
                    suscripcionId: suscripcion.id,
                    periodo: "2026-08",
                    pesoReportes: 3,
                    pesoCasos: 5,
                    pesoAlertas: 2,
                    pesoSesiones: 1,
                    scoreTotal: total,
                },
            });
        }
        await prisma.anomalia.create({
            data: {
                tipo: "CRECIMIENTO_ANOMALO_CIUDAD",
                severidad: "ALTA",
                descripcion: "Crecimiento anómalo de suscripciones en Cali",
                datosContexto: {},
                detectadaEn: DENTRO,
            },
        });

        const r = await ejecutarDigestSemanal(AHORA);
        expect(r.enviados).toBe(1);
        const notif = await prisma.notificacion.findFirstOrThrow({
            where: { evento: "analisis.digest.semanal", destinatarioUsuarioId: admin.id, canal: "EMAIL" },
        });
        const vars = notif.variables as Record<string, string>;
        expect(vars.periodo).toBe(PERIODO);
        expect(vars.numAnomalias).toBe("1");
        expect(vars.anomalias).toContain("[ALTA] Crecimiento anómalo de suscripciones en Cali");
        expect(vars.ganadoresPerdedores).toContain("Ganadores (top 3):");
        expect(vars.ganadoresPerdedores).toContain("— 90,0");
        expect(vars.ganadoresPerdedores).toContain("Perdedores (bottom 3):");
        expect(vars.ganadoresPerdedores).toContain("— 10,0");
        // Los titulares PADRE sin nombre visible caen al email (cliente B2B, no PII de menores).
        expect(vars.enlacePanel).toContain("/dashboard/admin/estadisticas/dinero-vs-valor");
        const digest = (await digestsDe(admin.id))[0]!;
        const kpis = digest.kpisSemana as { scorePromedio: number | null };
        expect(kpis.scorePromedio).toBeCloseTo(50, 5); // promedio de 90/70/50/30/10
    });
});

describe("seedDigestSemanal", () => {
    it("es idempotente: dos corridas no duplican parámetros, reglas ni plantillas", async () => {
        await seedDigestSemanal(); // beforeEach ya la corrió una vez
        expect(await prisma.parametroSistema.count({ where: { clave: "analisis.digest.enabled" } })).toBe(1);
        expect(
            await prisma.parametroSistema.count({ where: { clave: "analisis.digest.destinatarios_emails" } })
        ).toBe(1);
        expect(
            await prisma.notificacionRegla.count({ where: { evento: "analisis.digest.semanal" } })
        ).toBe(2);
        expect(
            await prisma.notificacionPlantilla.count({ where: { clave: { startsWith: "analisis.digest.semanal." } } })
        ).toBe(2);
        const reglas = await prisma.notificacionRegla.findMany({ where: { evento: "analisis.digest.semanal" } });
        expect(reglas.every((r) => r.obligatoria === false && r.rol === "ADMIN")).toBe(true);
    });
});
