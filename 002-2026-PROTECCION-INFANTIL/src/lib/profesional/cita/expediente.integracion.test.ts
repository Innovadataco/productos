/**
 * SPEC-427b · el código de expediente, de punta a punta, contra la base.
 *
 * Cubre lo que el brief §9 momento 6 pide del segundo código: que solo se
 * emita si el padre compartió el expediente, que abra en solo lectura únicamente
 * al digitarlo, que sea de un solo uso, que otro profesional no pueda, y —clave
 * legal— que CADA lectura deje su fila de auditoría (H-2).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import type { AccionAudit } from "@prisma/client";
import { CodigoCitaRepository } from "@/lib/dal/repositories/codigo-cita";
import { emitirCodigo } from "./codigos";
import {
    abrirExpedienteConCodigo,
    lecturaExpedienteParaProfesional,
    tieneAccesoAlExpediente,
    barrerRecordatoriosDeExpediente,
} from "./expediente.service";

const HORA = 60 * 60 * 1000;

async function sembrarReglaExpediente() {
    const clave = "cita.codigo_expediente.recordatorio.email";
    await prisma.notificacionPlantilla.upsert({
        where: { clave },
        update: {},
        create: {
            clave,
            canal: "EMAIL",
            asunto: "Código de expediente",
            cuerpoMarkdown: "{{codigo}}",
            variablesSchema: { type: "object", properties: {} },
            activa: true,
        },
    });
    await prisma.notificacionRegla.upsert({
        where: {
            evento_canal_plantillaClave_rol: {
                evento: "cita.codigo_expediente.recordatorio",
                canal: "EMAIL",
                plantillaClave: clave,
                rol: "PARENT",
            },
        },
        update: { activa: true },
        create: {
            evento: "cita.codigo_expediente.recordatorio",
            rol: "PARENT",
            offset: "+0m",
            canal: "EMAIL",
            plantillaClave: clave,
            obligatoria: false,
            activa: true,
        },
    });
}

async function sembrarCitaConExpediente(opciones: { compartido?: boolean; inicioEnHoras?: number } = {}) {
    const compartido = opciones.compartido ?? true;
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }));
    const plataforma = await crearPlataforma(`wa-${Date.now()}-${Math.random()}`.slice(0, 20));

    const profeUsuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profeUsuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    const padre = await crearUsuario("PARENT", `papa.${Date.now()}.${Math.random()}@ejemplo.local`);

    const identificador = `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padre.id,
            identificadorReportado: identificador,
            fechaApertura: new Date(),
            estado: "ACTIVO",
            origenCreacion: "PADRE",
        },
    });
    // Dos hechos del padre para que la lectura devuelva algo real.
    for (const dia of [3, 10]) {
        await prisma.reporte.create({
            data: {
                usuarioId: padre.id,
                identificador,
                plataformaId: plataforma.id,
                texto: "Texto de prueba.",
                fechaIncidente: new Date(Date.now() - dia * 24 * HORA),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                estado: "CLASIFICADO",
                eliminado: false,
            },
        });
    }

    const inicio = new Date(Date.now() + (opciones.inicioEnHoras ?? 1) * HORA);
    const franja = await prisma.franjaDisponible.create({
        data: {
            profesionalId: perfil.id,
            inicio,
            fin: new Date(inicio.getTime() + HORA),
            modalidad: "VIRTUAL",
            tomada: true,
        },
    });
    const solicitud = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: perfil.id,
            franjaId: franja.id,
            presentacion: "Necesito orientación.",
            urgencia: "SIN_APURO",
            estado: "CONFIRMADA",
            venceEn: new Date(Date.now() + 48 * HORA),
            pagoAprobadoEn: new Date(),
            expedienteCompartidoId: compartido ? expediente.id : null,
            montoConsulta: 180000,
            montoServicio: 18000,
            montoTotal: 198000,
            porcentajeServicio: 10,
        },
    });
    return { solicitud, perfil, profeUsuario, padre, expediente, franja };
}

async function contarAuditoria(accion: AccionAudit, recursoId: string): Promise<number> {
    return prisma.auditLog.count({ where: { accion, recursoId } });
}

describe("SPEC-427b · el código de expediente", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarReglaExpediente();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("el barrido emite el código SOLO si el padre compartió el expediente", async () => {
        await sembrarCitaConExpediente({ compartido: true, inicioEnHoras: 0.1 });
        await sembrarCitaConExpediente({ compartido: false, inicioEnHoras: 0.1 });

        const r = await barrerRecordatoriosDeExpediente();
        expect(r.emitidos, "solo la cita con expediente compartido").toBe(1);
    });

    it("el barrido es idempotente: una segunda corrida no reemite", async () => {
        await sembrarCitaConExpediente({ inicioEnHoras: 0.1 });
        const a = await barrerRecordatoriosDeExpediente();
        const b = await barrerRecordatoriosDeExpediente();
        expect(a.emitidos).toBe(1);
        expect(b.emitidos).toBe(0);
    });

    it("sin digitar el código, la lectura del expediente se niega (403)", async () => {
        const { solicitud, profeUsuario } = await sembrarCitaConExpediente();
        expect(await tieneAccesoAlExpediente(solicitud.id)).toBe(false);
        await expect(lecturaExpedienteParaProfesional(solicitud.id, profeUsuario.id)).rejects.toMatchObject({
            statusCode: 403,
        });
    });

    it("con el código correcto abre en solo lectura, y es de un solo uso", async () => {
        const { solicitud, profeUsuario } = await sembrarCitaConExpediente();
        const emitido = await emitirCodigo({ solicitudId: solicitud.id, tipo: "EXPEDIENTE", vigenteDesde: new Date() });

        const r = await abrirExpedienteConCodigo(solicitud.id, profeUsuario.id, emitido.codigo);
        expect(r.expedienteId).toBeTruthy();
        expect(await tieneAccesoAlExpediente(solicitud.id)).toBe(true);

        // El mismo código no abre dos veces.
        await expect(
            abrirExpedienteConCodigo(solicitud.id, profeUsuario.id, emitido.codigo),
        ).rejects.toMatchObject({ statusCode: 409 });

        const lectura = await lecturaExpedienteParaProfesional(solicitud.id, profeUsuario.id);
        expect(lectura?.lectura.total, "los dos hechos del padre").toBe(2);
    });

    it("H-2 · CADA lectura deja su fila de auditoría", async () => {
        const { solicitud, profeUsuario, expediente } = await sembrarCitaConExpediente();
        const emitido = await emitirCodigo({ solicitudId: solicitud.id, tipo: "EXPEDIENTE", vigenteDesde: new Date() });
        await abrirExpedienteConCodigo(solicitud.id, profeUsuario.id, emitido.codigo);

        await lecturaExpedienteParaProfesional(solicitud.id, profeUsuario.id);
        await lecturaExpedienteParaProfesional(solicitud.id, profeUsuario.id);

        const leidas = await contarAuditoria("CITA_PROFESIONAL_EXPEDIENTE_ABIERTO" as AccionAudit, expediente.id);
        expect(leidas, "dos lecturas, dos filas de auditoría").toBe(2);
    });

    it("otro profesional no puede abrir el expediente de una cita ajena", async () => {
        const { solicitud, expediente } = await sembrarCitaConExpediente();
        const otro = await crearUsuario("PROFESIONAL", `otro.${Date.now()}@ejemplo.local`);
        await prisma.perfilProfesional.create({
            data: {
                usuarioId: otro.id,
                nombreVisible: "Otro",
                tituloProfesional: "Psicología",
                especialidades: ["infantil"],
                ciudadId: (await prisma.ciudad.findFirst())!.id,
                aniosExperiencia: 3,
                presentacion: "x",
                tarifaConsultaCOP: 100000,
                duracionMinutos: 45,
                estado: "ACTIVO",
            },
        });
        const emitido = await emitirCodigo({ solicitudId: solicitud.id, tipo: "EXPEDIENTE", vigenteDesde: new Date() });
        await expect(
            abrirExpedienteConCodigo(solicitud.id, otro.id, emitido.codigo),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(await contarAuditoria("CITA_PROFESIONAL_EXPEDIENTE_ABIERTO" as AccionAudit, expediente.id)).toBe(0);
    });
});
