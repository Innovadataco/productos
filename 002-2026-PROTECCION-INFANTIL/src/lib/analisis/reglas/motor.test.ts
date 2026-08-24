/**
 * SPEC-221 (002-PI-122): tests de integración del motor de reglas.
 * Generación + render, dedup (reglaId, sujetoId) en PENDIENTE, re-detención
 * tras resolución, regla inactiva, umbral, sandbox (rechazo auditado y error
 * de ejecución sin tumbar el ciclo), EJECUTA diferida y expiración idempotente.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { evaluarRegla, evaluarReglasPendientes, expirarRecomendacionesVencidas } from "./motor";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearAdmin() {
    return crearUsuario("ADMIN", unico("admin") + "@test.local");
}

async function crearSuscripcionVigente(diasHastaFin = 5) {
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
            estado: "ACTIVA",
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + diasHastaFin * 86_400_000),
            codigoReferidoPropio: unico("REF"),
        },
    });
}

const SQL_VENCIMIENTO = `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo,
       COALESCE(c.nombre, 'Cliente') AS cliente,
       to_char(s."fechaFin" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha_fin
FROM "Suscripcion" s
LEFT JOIN "Colegio" c ON c.id = s."colegioId"
WHERE s.estado = 'ACTIVA'
  AND s."fechaFin" >= now()
  AND s."fechaFin" < now() + INTERVAL '7 days'`;

async function crearRegla(adminId: string, overrides: Partial<Prisma.ReglaRecomendacionUncheckedCreateInput> = {}) {
    return prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.test"),
            nombre: "Regla de prueba",
            descripcion: "Regla de prueba",
            categoria: "renovacion",
            sqlQuery: SQL_VENCIMIENTO,
            plantillaRecomendacion: "Llamar a {{cliente}} · vence {{fecha_fin}}\nDescripción de {{cliente}}",
            prioridad: 90,
            frecuenciaMin: 60,
            creadaPorAdminId: adminId,
            ...overrides,
        },
    });
}

describe("motor de reglas (SPEC-221)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("genera una Recomendacion PENDIENTE renderizada por candidato y deduplica al re-evaluar", async () => {
        const admin = await crearAdmin();
        const suscripcion = await crearSuscripcionVigente(5);
        const regla = await crearRegla(admin.id);

        const primera = await evaluarRegla(regla.id);
        expect(primera.error).toBeUndefined();
        expect(primera.candidatos).toBe(1);
        expect(primera.creadas).toBe(1);

        const recs = await prisma.recomendacion.findMany({ where: { reglaId: regla.id } });
        expect(recs).toHaveLength(1);
        const rec = recs[0]!;
        expect(rec.estado).toBe("PENDIENTE");
        expect(rec.sujetoTipo).toBe("Suscripcion");
        expect(rec.sujetoId).toBe(suscripcion.id);
        expect(rec.titulo).toContain("Llamar a");
        expect(rec.titulo).not.toContain("{{");
        expect(rec.prioridad).toBe(90);
        expect(rec.categoria).toBe("renovacion");
        expect(rec.ejecutadaAutomatica).toBe(false);
        // expiraEn ≈ ahora + 7 días (default del parámetro ausente).
        const diasHastaExpira = (rec.expiraEn.getTime() - Date.now()) / 86_400_000;
        expect(diasHastaExpira).toBeGreaterThan(6.5);
        expect(diasHastaExpira).toBeLessThan(7.5);

        const reglaRecargada = await prisma.reglaRecomendacion.findUnique({ where: { id: regla.id } });
        expect(reglaRecargada?.ultimaEvaluacionEn).not.toBeNull();

        // Segunda evaluación: 0 nuevas, 1 actualizada (dedup por (reglaId, sujetoId)).
        const segunda = await evaluarRegla(regla.id);
        expect(segunda.creadas).toBe(0);
        expect(segunda.actualizadas).toBe(1);
        expect(await prisma.recomendacion.count({ where: { reglaId: regla.id } })).toBe(1);
    });

    it("crea una nueva recomendación si la previa ya fue APLICADA (historial preservado)", async () => {
        const admin = await crearAdmin();
        await crearSuscripcionVigente(5);
        const regla = await crearRegla(admin.id);
        await evaluarRegla(regla.id);
        await prisma.recomendacion.updateMany({
            where: { reglaId: regla.id },
            data: { estado: "APLICADA", resueltaEn: new Date(), resueltaPorAdminId: admin.id },
        });

        const resultado = await evaluarRegla(regla.id);
        expect(resultado.creadas).toBe(1);
        const estados = await prisma.recomendacion.findMany({
            where: { reglaId: regla.id },
            select: { estado: true },
        });
        expect(estados.map((e) => e.estado).sort()).toEqual(["APLICADA", "PENDIENTE"]);
    });

    it("omite reglas inactivas sin error", async () => {
        const admin = await crearAdmin();
        await crearSuscripcionVigente(5);
        const regla = await crearRegla(admin.id, { activa: false });

        const resultado = await evaluarRegla(regla.id);
        expect(resultado.error).toBeUndefined();
        expect(resultado.creadas).toBe(0);
        expect(await prisma.recomendacion.count({ where: { reglaId: regla.id } })).toBe(0);
    });

    it("respeta umbralMinimo: filas con valor bajo el umbral no generan recomendaciones", async () => {
        const admin = await crearAdmin();
        await crearSuscripcionVigente(5);
        const regla = await crearRegla(admin.id, {
            umbralMinimo: 25,
            sqlQuery: `
SELECT s.id AS sujeto_id, 'Suscripcion' AS sujeto_tipo, 10::float AS valor, 'X' AS cliente
FROM "Suscripcion" s
WHERE s.estado = 'ACTIVA'`,
        });

        const resultado = await evaluarRegla(regla.id);
        expect(resultado.candidatos).toBe(0);
        expect(resultado.creadas).toBe(0);
        expect(await prisma.recomendacion.count({ where: { reglaId: regla.id } })).toBe(0);
    });

    it("rechaza queries peligrosas antes de ejecutarlas y registra AuditLog", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id, { sqlQuery: 'DELETE FROM "Usuario"' });

        const resultado = await evaluarRegla(regla.id);
        expect(resultado.error).toBeDefined();
        expect(resultado.creadas).toBe(0);

        const audits = await prisma.auditLog.findMany({
            where: { tipoRecurso: "ReglaRecomendacion", recursoId: regla.id },
        });
        expect(audits).toHaveLength(1);
        expect(audits[0]!.accion).toBe("ACCESO_DENEGADO");
        // La regla NO se desactiva automáticamente.
        const recargada = await prisma.reglaRecomendacion.findUnique({ where: { id: regla.id } });
        expect(recargada?.activa).toBe(true);
        // La tabla objetivo quedó intacta (nunca se ejecutó).
        expect(await prisma.usuario.count()).toBeGreaterThan(0);
    });

    it("una query que falla en ejecución no tumba el ciclo ni marca ultimaEvaluacionEn", async () => {
        const admin = await crearAdmin();
        const reglaMala = await crearRegla(admin.id, { sqlQuery: 'SELECT * FROM "TablaInexistenteXYZ"' });
        await crearSuscripcionVigente(5);
        const reglaBuena = await crearRegla(admin.id);

        const resultadoMala = await evaluarRegla(reglaMala.id);
        expect(resultadoMala.error).toBeDefined();
        const malaRecargada = await prisma.reglaRecomendacion.findUnique({ where: { id: reglaMala.id } });
        expect(malaRecargada?.ultimaEvaluacionEn).toBeNull();

        const resultadoBuena = await evaluarRegla(reglaBuena.id);
        expect(resultadoBuena.error).toBeUndefined();
        expect(resultadoBuena.creadas).toBe(1);
    });

    it("regla en modo EJECUTA genera sin ejecutar acción (ejecutadaAutomatica = false)", async () => {
        const admin = await crearAdmin();
        await crearSuscripcionVigente(5);
        const regla = await crearRegla(admin.id, { modo: "EJECUTA", accionEjecutable: "crear_bono_retencion" });

        const resultado = await evaluarRegla(regla.id);
        expect(resultado.error).toBeUndefined();
        expect(resultado.creadas).toBe(1);
        const rec = await prisma.recomendacion.findFirst({ where: { reglaId: regla.id } });
        expect(rec?.ejecutadaAutomatica).toBe(false);
        expect(rec?.accionSugerida).toBe("crear_bono_retencion");
    });

    it("evaluarReglasPendientes solo evalúa reglas con cadencia vencida", async () => {
        const admin = await crearAdmin();
        await crearSuscripcionVigente(5);
        const reglaVencida = await crearRegla(admin.id);
        const reglaReciente = await crearRegla(admin.id, { ultimaEvaluacionEn: new Date() });

        const resultados = await evaluarReglasPendientes();
        const clavesEvaluadas = resultados.map((r) => r.reglaId);
        expect(clavesEvaluadas).toContain(reglaVencida.id);
        expect(clavesEvaluadas).not.toContain(reglaReciente.id);
    });

    it("expira recomendaciones vencidas de forma idempotente", async () => {
        const admin = await crearAdmin();
        const regla = await crearRegla(admin.id);
        const vencida = await prisma.recomendacion.create({
            data: {
                reglaId: regla.id,
                titulo: "Vencida",
                descripcion: "Vencida",
                categoria: "renovacion",
                prioridad: 50,
                datosContexto: { dedupKey: unico("k") },
                expiraEn: new Date(Date.now() - 3_600_000),
            },
        });
        const vigente = await prisma.recomendacion.create({
            data: {
                reglaId: regla.id,
                titulo: "Vigente",
                descripcion: "Vigente",
                categoria: "renovacion",
                prioridad: 50,
                datosContexto: { dedupKey: unico("k") },
                expiraEn: new Date(Date.now() + 86_400_000),
            },
        });

        const primera = await expirarRecomendacionesVencidas();
        expect(primera).toBe(1);

        const recVencida = await prisma.recomendacion.findUnique({ where: { id: vencida.id } });
        expect(recVencida?.estado).toBe("EXPIRADA");
        expect(recVencida?.motivoResolucion).toBe("EXPIRACION_AUTOMATICA");
        expect(recVencida?.resueltaEn).not.toBeNull();

        const recVigente = await prisma.recomendacion.findUnique({ where: { id: vigente.id } });
        expect(recVigente?.estado).toBe("PENDIENTE");

        // Idempotente: la segunda corrida no marca nada.
        expect(await expirarRecomendacionesVencidas()).toBe(0);
    });
});
