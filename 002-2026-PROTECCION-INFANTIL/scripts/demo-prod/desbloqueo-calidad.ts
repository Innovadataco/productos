/**
 * SPEC-516 · siembra que DESBLOQUEA a Calidad (10 funcionalidades sin datos).
 *
 * Aditivo, todo marcado en `demo_marcado` (purgable por `lib/orden-borrado` +
 * el chain de expediente que agrega `purgar-demo`). NO toca datos reales.
 *
 * Cubre: CC-01..07 (comité de convivencia con integrantes y casos colegio-scoped),
 * CV-03/05/06 (caso escalado + expediente + informe + aclaración pendiente),
 * PA-16 (identificador visible con reportes aprobados), OP-09 (reporte CLASIFICADO
 * corregible) y OP-06 (caso escalable asignado a un operador).
 */
import { prisma } from "./lib/prisma";
import { marcarDemo } from "./lib/marcar";
import { CORRIDA } from "./lib/config";
import { nombrePersona, textoDemo, numeroSeguimientoDemo, telefonoDemo } from "./lib/datos";
import { hashIdentificacion } from "@/lib/hash-identificacion";
import type { EstadoReporte } from "@prisma/client";

export interface CtxDesbloqueo {
    adminId: string;
    colegioId: string;
    tenantId: string;
    padreId: string;
    comiteValidacionId: string;
    operadorId: string;
    plataformaId: string;
    paisId: string;
    ciudadId: string;
    passwordHash: string;
}

export interface ResumenDesbloqueo {
    comiteConvivenciaEmail: string;
    comiteConvivencia: number;
    integrantesConvivencia: number;
    solicitudesColegio: number;
    solicitudesEscaladas: number;
    alertasColegio: number;
    expedientes: number;
    informesConsolidados: number;
    aclaraciones: number;
    identificadoresVisibles: number;
    reportesClasificados: number;
    casosEscalables: number;
}

const MARCA = { corrida: CORRIDA, script: "sembrar-demo" as const };

/** Crea un reporte demo mínimo y lo marca. Devuelve su id + su identificador. */
async function crearReporteDemo(
    ctx: CtxDesbloqueo,
    idx: number,
    estado: EstadoReporte,
    extra: { operadorId?: string; comiteId?: string } = {},
): Promise<{ id: string; identificador: string }> {
    const identificador = telefonoDemo(920000 + idx);
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: ctx.plataformaId,
            texto: textoDemo("CONTACTO_INSISTENTE"),
            fechaIncidente: new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ctx.paisId,
            ciudadId: ctx.ciudadId,
            estado,
            esAnonimo: false,
            edadVictima: 13,
            numeroSeguimiento: `RPT-DESBLOQ-${String(idx).padStart(4, "0")}`,
            creadoEn: new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000),
            usuarioId: ctx.padreId,
            ...(extra.operadorId ? { operadorId: extra.operadorId } : {}),
            ...(extra.comiteId ? { comiteId: extra.comiteId } : {}),
        },
    });
    await marcarDemo("Reporte", reporte.id, MARCA);
    return { id: reporte.id, identificador };
}

export async function sembrarDesbloqueoCalidad(ctx: CtxDesbloqueo): Promise<ResumenDesbloqueo> {
    const r: ResumenDesbloqueo = {
        comiteConvivenciaEmail: "soporte+comiteconvivencia01@innovadataco.com",
        comiteConvivencia: 0,
        integrantesConvivencia: 0,
        solicitudesColegio: 0,
        solicitudesEscaladas: 0,
        alertasColegio: 0,
        expedientes: 0,
        informesConsolidados: 0,
        aclaraciones: 0,
        identificadoresVisibles: 0,
        reportesClasificados: 0,
        casosEscalables: 0,
    };

    // ── CC-01..07 · comité de convivencia del colegio, con integrantes ──────
    const { nombre: nomCC } = nombrePersona(97010);
    const emailCC = r.comiteConvivenciaEmail;
    const comiteConv = await prisma.usuario.create({
        data: {
            email: emailCC,
            nombre: `Comité Convivencia ${nomCC}`,
            passwordHash: ctx.passwordHash,
            rol: "COMITE_CONVIVENCIA",
            estado: "activo",
            debeCambiarPassword: false,
            tenantId: ctx.tenantId,
            comiteColegioId: ctx.colegioId,
        },
    });
    await marcarDemo("Usuario", comiteConv.id, { ...MARCA, notas: "COMITE_CONVIVENCIA" });
    r.comiteConvivencia++;

    for (let i = 0; i < 2; i++) {
        const { nombre, apellidos } = nombrePersona(97020 + i);
        const doc = `DEMOCONV${String(i).padStart(5, "0")}`;
        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId: comiteConv.id,
                nombres: nombre,
                apellidos,
                tipoIdentificacion: "CEDULA_CIUDADANIA",
                numeroIdentificacion: doc,
                hashIdentificacion: hashIdentificacion(doc),
                email: `soporte+integranteconv${i}@innovadataco.com`,
                estado: "ACTIVO",
                creadoPorId: ctx.adminId,
                modificadoPorId: ctx.adminId,
            },
        });
        await marcarDemo("IntegranteComite", integrante.id, MARCA);
        r.integrantesConvivencia++;
    }

    // 2 casos colegio-scoped (bandeja del comité de convivencia = where colegioId).
    for (let i = 0; i < 2; i++) {
        const rep = await crearReporteDemo(ctx, 100 + i, "REVISION_MANUAL");
        const alerta = await prisma.alertaColegio.create({
            data: {
                colegioId: ctx.colegioId,
                reporteId: rep.id,
                tipoSujeto: "ESTUDIANTE",
                estado: "escalada",
                prioridad: i === 0 ? "alta" : "media",
                vencimientoSla: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                asignadoAId: comiteConv.id,
            },
        });
        await marcarDemo("AlertaColegio", alerta.id, MARCA);
        r.alertasColegio++;
        const sol = await prisma.solicitudComite.create({
            data: {
                reporteId: rep.id,
                numero: `SC-CONV-${String(i).padStart(4, "0")}`,
                estado: "PENDIENTE",
                colegioId: ctx.colegioId,
                alertaColegioId: alerta.id,
                creadoPorId: ctx.adminId,
                motivo: "Caso demo escalado al comité de convivencia para su gestión.",
                analisis: i === 0 ? "Análisis inicial demo (editable durante la deliberación)." : null,
            },
        });
        await marcarDemo("SolicitudComite", sol.id, MARCA);
        r.solicitudesColegio++;
    }

    // ── CV-03/05/06 · caso ESCALADO al comité de validación + expediente ────
    const repEsc = await crearReporteDemo(ctx, 200, "REVISION_MANUAL");
    const solEsc = await prisma.solicitudComite.create({
        data: {
            reporteId: repEsc.id,
            numero: "SC-ESC-0001",
            estado: "PENDIENTE",
            comiteId: null, // sin asignar → aparece en la bandeja del comité de validación
            operadorId: ctx.operadorId,
            motivo: "Caso demo escalado al comité de validación (sin asignar).",
        },
    });
    await marcarDemo("SolicitudComite", solEsc.id, MARCA);
    r.solicitudesEscaladas++;

    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: ctx.padreId,
            identificadorReportado: repEsc.identificador,
            plataformaId: ctx.plataformaId,
            fechaApertura: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            estado: "PENDIENTE_COMITE",
            origenCreacion: "PADRE",
            numEventos: 1,
            ultimoEventoEn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
    });
    await marcarDemo("Expediente", expediente.id, MARCA);
    r.expedientes++;

    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            categoriasDetectadasJson: { CONTACTO_INSISTENTE: 2 },
            resumenTextoGenerado: "Resumen consolidado demo del expediente para revisión del comité.",
            estadoAprobacion: "PENDIENTE_COMITE",
            scoreValor: 45,
            scoreGravedad: "AMARILLO",
            generadoPorId: ctx.adminId,
        },
    });
    await marcarDemo("InformeConsolidado", informe.id, MARCA);
    r.informesConsolidados++;

    const aclaracion = await prisma.aclaracionExpediente.create({
        data: {
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "El comité solicita una aclaración demo sobre el expediente.",
            estado: "PENDIENTE",
            // respondidaEn/respuestaTexto NULL → pendiente de responder (CV-05).
        },
    });
    await marcarDemo("AclaracionExpediente", aclaracion.id, MARCA);
    r.aclaraciones++;

    // ── PA-16 · identificador VISIBLE públicamente (con reportes aprobados) ──
    const identVisible = telefonoDemo(930001);
    const idRep = await prisma.identificadorReportado.create({
        data: {
            identificador: identVisible,
            plataformaId: ctx.plataformaId,
            totalReportes: 3,
            reportesAutenticados: 3,
            reportesAprobados: 3,
            autenticadosAprobados: 3,
            esVisiblePublicamente: true,
            score: 30,
            scoreAutenticado: 30,
            scoreAjustado: 30,
            nivelRiesgo: "MEDIO",
            ultimoReporteEn: new Date(),
        },
    });
    await marcarDemo("IdentificadorReportado", idRep.id, MARCA);
    r.identificadoresVisibles++;

    // ── OP-09 · reporte CLASIFICADO corregible (para «corregir categoría») ──
    const repClas = await crearReporteDemo(ctx, 300, "CLASIFICADO", { operadorId: ctx.operadorId });
    const clasif = await prisma.clasificacionIA.create({
        data: {
            reporteId: repClas.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.82,
            modeloUsado: "ornith:9b",
            latenciaMs: 1200,
        },
    });
    await marcarDemo("ClasificacionIA", clasif.id, MARCA);
    r.reportesClasificados++;

    // ── OP-06 · caso ESCALABLE: reporte asignado a un operador ──────────────
    await crearReporteDemo(ctx, 400, "REVISION_MANUAL", { operadorId: ctx.operadorId });
    r.casosEscalables++;

    return r;
}
