/**
 * SPEC-427 (A-75 · L6) · el cierre de la cita contra la base.
 *
 * Los candados estáticos vigilan la forma; esto prueba la conducta: que un
 * código sirva una sola vez, que uno vencido no cierre nada, que a los 5 días
 * la cita se autocierre — y, sobre todo, **que la bandeja del Verificador
 * muestre esa cita y NO muestre una solicitud impaga recién creada** (I-300).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { CodigoCitaRepository } from "@/lib/dal/repositories/codigo-cita";
import { verificarYUsar, emitirCodigo, trazaDeCodigos, MAX_INTENTOS_CODIGO } from "./codigos";
import {
    cerrarConCodigoDeCita,
    marcarNoAsistioElPadre,
    barrerAutocierre,
    barrerRecordatoriosDeCita,
    DIAS_AUTOCIERRE,
} from "./cierre.service";
import { listarIncidentesCitas } from "@/lib/profesionales/verificador/service";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

async function sembrarReglaRecordatorio() {
    // El servicio falla en cerrado sin regla activa (I-295). `resetDatabase` no
    // siembra el catálogo del motor, así que lo pone el test.
    for (const evento of ["cita.codigo.recordatorio", "cita.autocerrada.padre", "cita.no_asistio.padre"]) {
        const clave = `${evento}.email`;
        await prisma.notificacionPlantilla.upsert({
            where: { clave },
            update: {},
            create: {
                clave,
                canal: "EMAIL",
                asunto: "Prueba",
                cuerpoMarkdown: "{{codigo}}",
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
        });
        await prisma.notificacionRegla.upsert({
            where: {
                evento_canal_plantillaClave_rol: {
                    evento,
                    canal: "EMAIL",
                    plantillaClave: clave,
                    rol: "PARENT",
                },
            },
            update: { activa: true },
            create: {
                evento,
                rol: "PARENT",
                offset: "+0m",
                canal: "EMAIL",
                plantillaClave: clave,
                obligatoria: true,
                activa: true,
            },
        });
    }
}

async function sembrarCitaConfirmada(opciones: { inicioEnHoras?: number } = {}) {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
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
            montoConsulta: 180000,
            montoServicio: 18000,
            montoTotal: 198000,
            porcentajeServicio: 10,
        },
    });
    return { solicitud, perfil, profeUsuario, padre, franja };
}

describe("SPEC-427 · los dos códigos y el cierre", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarReglaRecordatorio();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("el barrido emite el código UNA vez y programa el correo, aunque corra dos veces", async () => {
        const { solicitud } = await sembrarCitaConfirmada({ inicioEnHoras: 0.1 });

        const primera = await barrerRecordatoriosDeCita();
        const segunda = await barrerRecordatoriosDeCita();

        expect(primera.emitidos).toBe(1);
        expect(segunda.emitidos, "una segunda corrida no puede volver a mandarle el código").toBe(0);

        const codigos = await new CodigoCitaRepository().listarPorSolicitud(solicitud.id);
        expect(codigos).toHaveLength(1);
        expect(codigos[0].tipo).toBe("CITA");
        // El envío no se copia: se apunta a la fila del motor.
        expect(codigos[0].notificacionId).not.toBeNull();
    });

    it("el código correcto cierra la cita, y el mismo código NO cierra dos veces", async () => {
        const { solicitud, profeUsuario } = await sembrarCitaConfirmada();
        const emitido = await emitirCodigo({
            solicitudId: solicitud.id,
            tipo: "CITA",
            vigenteDesde: new Date(),
        });

        const r = await cerrarConCodigoDeCita(solicitud.id, profeUsuario.id, emitido.codigo);
        expect(r.estado).toBe("CUMPLIDA");

        await expect(
            cerrarConCodigoDeCita(solicitud.id, profeUsuario.id, emitido.codigo),
        ).rejects.toThrow();

        const fresca = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(fresca?.estado).toBe("CUMPLIDA");
    });

    it("un código vencido no cierra nada y NO gasta intentos", async () => {
        const { solicitud } = await sembrarCitaConfirmada();
        const emitido = await emitirCodigo({
            solicitudId: solicitud.id,
            tipo: "CITA",
            // Vigente desde hace dos horas → ya venció (dura 30 minutos).
            vigenteDesde: new Date(Date.now() - 2 * HORA),
        });

        const r = await verificarYUsar(solicitud.id, "CITA", emitido.codigo, new Date());
        expect(r).toEqual({ ok: false, motivo: "expirado" });

        const fila = await new CodigoCitaRepository().findVigente(solicitud.id, "CITA");
        expect(fila?.intentosFallidos, "vencer no es fallar: el intento no se gasta").toBe(0);
    });

    it("el código equivocado gasta intentos y a los cinco se cierra la puerta", async () => {
        const { solicitud } = await sembrarCitaConfirmada();
        await emitirCodigo({ solicitudId: solicitud.id, tipo: "CITA", vigenteDesde: new Date() });

        for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
            const r = await verificarYUsar(solicitud.id, "CITA", "000000", new Date());
            expect(r).toEqual({ ok: false, motivo: "incorrecto" });
        }
        const r = await verificarYUsar(solicitud.id, "CITA", "000000", new Date());
        expect(r).toEqual({ ok: false, motivo: "max_intentos" });
    });

    it("la traza cuenta las veces que se pidió y si se digitó", async () => {
        const { solicitud, profeUsuario } = await sembrarCitaConfirmada();
        await emitirCodigo({ solicitudId: solicitud.id, tipo: "CITA", vigenteDesde: new Date() });
        const segundo = await emitirCodigo({
            solicitudId: solicitud.id,
            tipo: "CITA",
            vigenteDesde: new Date(),
        });
        await cerrarConCodigoDeCita(solicitud.id, profeUsuario.id, segundo.codigo);

        const traza = (await trazaDeCodigos([solicitud.id])).get(solicitud.id)!;
        expect(traza.cita, "las dos emisiones quedan a la vista").toHaveLength(2);
        expect(traza.cita.filter((e) => e.usadoEn !== null), "solo una se digitó").toHaveLength(1);
        expect(traza.expediente).toEqual([]);
    });

    it("«no se presentó» cierra por el otro lado, sin código", async () => {
        const { solicitud, profeUsuario } = await sembrarCitaConfirmada();
        const r = await marcarNoAsistioElPadre(solicitud.id, profeUsuario.id);
        expect(r.estado).toBe("NO_ASISTIO_PADRE");
    });

    it("a los 5 días sin código la cita se autocierra y deja su marca", async () => {
        const { solicitud, franja } = await sembrarCitaConfirmada();
        // La cita terminó hace seis días.
        await prisma.franjaDisponible.update({
            where: { id: franja.id },
            data: { fin: new Date(Date.now() - (DIAS_AUTOCIERRE + 1) * DIA) },
        });

        const r = await barrerAutocierre();
        expect(r.autocerradas).toBe(1);

        const fresca = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(fresca?.estado).toBe("SIN_CONFIRMAR");
        expect(fresca?.autocerradaEn, "la marca es lo que la separa de una impaga").not.toBeNull();
    });

    it("I-300 · la bandeja del Verificador muestra la autocerrada y NO la impaga recién creada", async () => {
        // La impaga: nace SIN_CONFIRMAR porque nadie pagó todavía. No es un
        // incidente — es el estado normal de una solicitud nueva.
        const impaga = await sembrarCitaConfirmada();
        await prisma.solicitudCita.update({
            where: { id: impaga.solicitud.id },
            data: { estado: "SIN_CONFIRMAR", pagoAprobadoEn: null },
        });

        // La otra sí: se confirmó, pasó, y nadie digitó el código.
        const muerta = await sembrarCitaConfirmada();
        await prisma.franjaDisponible.update({
            where: { id: muerta.franja.id },
            data: { fin: new Date(Date.now() - (DIAS_AUTOCIERRE + 1) * DIA) },
        });
        await barrerAutocierre();

        const bandeja = await listarIncidentesCitas();
        const ids = bandeja.map((f) => f.solicitudId);
        expect(ids).toContain(muerta.solicitud.id);
        expect(ids, "una solicitud que nadie pagó no es un incidente").not.toContain(impaga.solicitud.id);
    });

    it("la bandeja trae la traza instrumentada, no un null", async () => {
        const { solicitud, franja } = await sembrarCitaConfirmada();
        await emitirCodigo({ solicitudId: solicitud.id, tipo: "CITA", vigenteDesde: new Date() });
        await prisma.franjaDisponible.update({
            where: { id: franja.id },
            data: { fin: new Date(Date.now() - (DIAS_AUTOCIERRE + 1) * DIA) },
        });
        await barrerAutocierre();

        const fila = (await listarIncidentesCitas()).find((f) => f.solicitudId === solicitud.id);
        expect(fila).toBeDefined();
        expect(fila!.trazaCodigos.cita).toHaveLength(1);
        expect(fila!.trazaCodigos.cita[0].usadoEn, "nadie lo digitó: por eso está acá").toBeNull();
        // Y la fecha de la cita es la de la cita, no la de cuando se pidió.
        expect(fila!.fechaCita).toBe(franja.inicio.toISOString());
    });
});
