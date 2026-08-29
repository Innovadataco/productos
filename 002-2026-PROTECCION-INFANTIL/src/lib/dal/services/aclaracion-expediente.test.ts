/**
 * SPEC-238 (002-PI-mega-cola): tests de integración del servicio de
 * orquestación de la aclaración padre-comité (T010) y del tick del worker
 * (T020): flujo completo, concurrencia, atomicidad (compensación),
 * idempotencia del cierre forzoso y SLA en America/Bogota.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import type { Expediente, InformeConsolidado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AppError } from "@/lib/errors";
import { aplicarTransicion } from "@/lib/expediente/estados/aplicar-transicion";
import {
    solicitarAclaracion,
    responderAclaracion,
    cerrarForzosamente,
} from "./aclaracion-expediente";
import { cerrarAclaracionesSlaVencidas } from "@/lib/expediente/motor/tareas-aclaracion";

// Motor Notif no debe frenar las transiciones: se simula la API estricta.
vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

// Spy sobre aplicarTransicion para forzar fallos puntuales (test de atomicidad);
// la implementación por defecto es la real.
vi.mock("@/lib/expediente/estados/aplicar-transicion", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@/lib/expediente/estados/aplicar-transicion")>();
    return { ...mod, aplicarTransicion: vi.fn(mod.aplicarTransicion) };
});

async function crearExpedienteEInforme(
    padreId: string,
    estado: EstadoExpediente = EstadoExpediente.EN_APROBACION_PADRE
): Promise<{ expediente: Expediente; informe: InformeConsolidado }> {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
            fechaApertura: new Date(),
            estado,
            numEventos: 3,
        },
    });
    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            scoreValor: 10,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: { CONTACTO_INSISTENTE: 3 },
            resumenTextoGenerado: "Resumen consolidado de prueba",
            estadoAprobacion: "APROBADO",
        },
    });
    return { expediente, informe };
}

async function sembrarSla(horas = 48) {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.comite.sla_horas_normal" },
        update: { valor: String(horas) },
        create: {
            clave: "padre.comite.sla_horas_normal",
            valor: String(horas),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "SLA de comité (test)",
        },
    });
}

describe("servicio aclaracion-expediente (SPEC-238)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarSla();
        vi.mocked(aplicarTransicion).mockClear();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("solicitarAclaracion crea PENDIENTE, transita a EN_ACLARACION y audita sin textos", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);

        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "No entiendo la conclusión sobre el identificador.",
        });

        expect(aclaracion.estado).toBe("PENDIENTE");

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.EN_ACLARACION);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ACLARACION_SOLICITADA", recursoId: aclaracion.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(padre.id);
        expect(JSON.stringify(audit?.metadatos)).not.toContain("No entiendo");
    });

    it("solicitarAclaracion rechaza la segunda aclaración con 409", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);
        await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Primera duda",
        });

        await expect(
            solicitarAclaracion({
                expedienteId: expediente.id,
                padreUsuarioId: padre.id,
                solicitudTexto: "Segunda duda",
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(1);
    });

    it("solicitarAclaracion rechaza a un padre no titular (403) y estado inválido (409)", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);

        await expect(
            solicitarAclaracion({ expedienteId: expediente.id, padreUsuarioId: otro.id, solicitudTexto: "Duda" })
        ).rejects.toMatchObject({ statusCode: 403 });

        const { expediente: activo } = await crearExpedienteEInforme(padre.id, EstadoExpediente.ACTIVO);
        await expect(
            solicitarAclaracion({ expedienteId: activo.id, padreUsuarioId: padre.id, solicitudTexto: "Duda" })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("concurrencia: dos solicitudes simultáneas terminan en una 201 y una 409", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);

        const resultados = await Promise.allSettled([
            solicitarAclaracion({ expedienteId: expediente.id, padreUsuarioId: padre.id, solicitudTexto: "Duda A" }),
            solicitarAclaracion({ expedienteId: expediente.id, padreUsuarioId: padre.id, solicitudTexto: "Duda B" }),
        ]);

        const exitosas = resultados.filter((r) => r.status === "fulfilled");
        const fallidas = resultados.filter((r) => r.status === "rejected");
        expect(exitosas).toHaveLength(1);
        expect(fallidas).toHaveLength(1);
        expect((fallidas[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });

        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(1);
    });

    it("atomicidad: si la transición falla no queda aclaración huérfana", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);

        vi.mocked(aplicarTransicion).mockRejectedValueOnce(
            new AppError("Transición forzada a fallar (test)", "CONFLICT", 409)
        );

        await expect(
            solicitarAclaracion({ expedienteId: expediente.id, padreUsuarioId: padre.id, solicitudTexto: "Duda" })
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(0);
    });

    it("responderAclaracion marca RESPONDIDA y devuelve el expediente a EN_APROBACION_PADRE", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { expediente } = await crearExpedienteEInforme(padre.id);
        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda del padre",
        });

        const respondida = await responderAclaracion({
            aclaracionId: aclaracion.id,
            comite: { id: comite.id, comiteColegioId: null },
            respuestaTexto: "El informe detalla 3 reportes independientes validados.",
        });

        expect(respondida.estado).toBe("RESPONDIDA");
        expect(respondida.respondidaPor).toBe(comite.id);

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.EN_APROBACION_PADRE);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ACLARACION_RESPONDIDA", recursoId: aclaracion.id },
        });
        expect(audit).not.toBeNull();
        expect(JSON.stringify(audit?.metadatos)).not.toContain("3 reportes independientes");
    });

    it("responderAclaracion rechaza re-respuesta (409) y comité con ámbito de colegio (404)", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { expediente } = await crearExpedienteEInforme(padre.id);
        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda",
        });

        await expect(
            responderAclaracion({
                aclaracionId: aclaracion.id,
                comite: { id: comite.id, comiteColegioId: "colegio-123" },
                respuestaTexto: "Respuesta",
            })
        ).rejects.toMatchObject({ statusCode: 404 });

        await responderAclaracion({
            aclaracionId: aclaracion.id,
            comite: { id: comite.id, comiteColegioId: null },
            respuestaTexto: "Respuesta válida",
        });

        await expect(
            responderAclaracion({
                aclaracionId: aclaracion.id,
                comite: { id: comite.id, comiteColegioId: null },
                respuestaTexto: "Otra respuesta",
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("cerrarForzosamente cierra expediente y aclaración; la segunda llamada es idempotente", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { expediente } = await crearExpedienteEInforme(padre.id);
        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda",
        });
        await responderAclaracion({
            aclaracionId: aclaracion.id,
            comite: { id: comite.id, comiteColegioId: null },
            respuestaTexto: "Respuesta",
        });

        const resultado = await cerrarForzosamente({
            expedienteId: expediente.id,
            actor: { id: padre.id, tipo: "usuario", rol: "PARENT" },
        });
        expect(resultado.yaCerrado).toBe(false);
        expect(resultado.estadoExpediente).toBe(EstadoExpediente.CERRADO);
        expect(resultado.aclaracionEstado).toBe("CERRADA_FORZOSAMENTE");

        const aclaracionActual = await prisma.aclaracionExpediente.findUnique({ where: { id: aclaracion.id } });
        expect(aclaracionActual?.estado).toBe("CERRADA_FORZOSAMENTE");

        const auditoriasCierre = await prisma.auditLog.count({
            where: { accion: "ACLARACION_CERRADA_FORZOSAMENTE", recursoId: aclaracion.id },
        });
        expect(auditoriasCierre).toBe(1);

        const repetido = await cerrarForzosamente({
            expedienteId: expediente.id,
            actor: { id: padre.id, tipo: "usuario", rol: "PARENT" },
        });
        expect(repetido.yaCerrado).toBe(true);

        const auditoriasTrasRepetir = await prisma.auditLog.count({
            where: { accion: "ACLARACION_CERRADA_FORZOSAMENTE", recursoId: aclaracion.id },
        });
        expect(auditoriasTrasRepetir).toBe(1);
    });

    it("cerrarForzosamente exige aclaración respondida (409) y padre titular (403)", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { expediente } = await crearExpedienteEInforme(padre.id);

        // Sin aclaración → 409.
        await expect(
            cerrarForzosamente({ expedienteId: expediente.id, actor: { id: padre.id, tipo: "usuario", rol: "PARENT" } })
        ).rejects.toMatchObject({ statusCode: 409 });

        // Aclaración PENDIENTE con expediente forzado a EN_APROBACION_PADRE → 409.
        const { expediente: exp2, informe: inf2 } = await crearExpedienteEInforme(padre.id);
        await prisma.aclaracionExpediente.create({
            data: {
                expedienteId: exp2.id,
                informeConsolidadoId: inf2.id,
                solicitudTexto: "Duda pendiente",
                estado: "PENDIENTE",
            },
        });
        await expect(
            cerrarForzosamente({ expedienteId: exp2.id, actor: { id: padre.id, tipo: "usuario", rol: "PARENT" } })
        ).rejects.toMatchObject({ statusCode: 409 });

        // No titular → 403 (con una aclaración respondida válida de por medio).
        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda",
        });
        await responderAclaracion({
            aclaracionId: aclaracion.id,
            comite: { id: comite.id, comiteColegioId: null },
            respuestaTexto: "Respuesta",
        });
        await expect(
            cerrarForzosamente({ expedienteId: expediente.id, actor: { id: otro.id, tipo: "usuario", rol: "PARENT" } })
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("worker: cierra aclaraciones PENDIENTE con SLA vencido e ignora las demás", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteEInforme(padre.id);
        const aclaracion = await solicitarAclaracion({
            expedienteId: expediente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda que el comité no responderá",
        });
        // Simula una solicitud de hace 72h (SLA 48h): vencida en cualquier zona.
        await prisma.aclaracionExpediente.update({
            where: { id: aclaracion.id },
            data: { solicitadaEn: new Date(Date.now() - 72 * 3_600_000) },
        });

        // Aclaración no vencida en otro expediente: no se toca.
        const { expediente: expReciente } = await crearExpedienteEInforme(padre.id);
        const aclaracionReciente = await solicitarAclaracion({
            expedienteId: expReciente.id,
            padreUsuarioId: padre.id,
            solicitudTexto: "Duda reciente",
        });

        const cerradas = await cerrarAclaracionesSlaVencidas(new Date());
        expect(cerradas).toBe(1);

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.CERRADO);
        const aclaracionActual = await prisma.aclaracionExpediente.findUnique({ where: { id: aclaracion.id } });
        expect(aclaracionActual?.estado).toBe("CERRADA_FORZOSAMENTE");

        const recienteActual = await prisma.aclaracionExpediente.findUnique({
            where: { id: aclaracionReciente.id },
        });
        expect(recienteActual?.estado).toBe("PENDIENTE");
        const expRecienteActual = await prisma.expediente.findUnique({ where: { id: expReciente.id } });
        expect(expRecienteActual?.estado).toBe(EstadoExpediente.EN_ACLARACION);

        // Segundo tick: la aclaración ya cerrada no se reprocesa (idempotencia).
        const cerradasSegundoTick = await cerrarAclaracionesSlaVencidas(new Date());
        expect(cerradasSegundoTick).toBe(0);
    });
});
