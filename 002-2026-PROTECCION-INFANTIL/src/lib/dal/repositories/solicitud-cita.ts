/**
 * SPEC-395 (L4) · Repositorio de SolicitudCita.
 * Q-3: acceso a Prisma vive acá; los routes y el service llaman al repo.
 */
import type {
    EstadoSolicitudCita,
    Prisma,
    SolicitudCita,
} from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_PADRE_PARA_PROFESIONAL = {
    padreUsuario: { select: { id: true, nombre: true, email: true } },
    franja: { select: { inicio: true, fin: true, modalidad: true } },
} as const;

const INCLUDE_PARA_PADRE = {
    profesional: {
        include: {
            ciudad: { select: { id: true, nombre: true } },
            usuario: { select: { email: true, telefono: true } },
        },
    },
    franja: { select: { inicio: true, fin: true, modalidad: true } },
} as const;

export class SolicitudCitaRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.SolicitudCitaCreateInput) {
        return this.db.solicitudCita.create({ data, include: INCLUDE_PARA_PADRE });
    }

    findById(id: string): Promise<SolicitudCita | null> {
        return this.db.solicitudCita.findUnique({ where: { id } });
    }

    findParaPadre(id: string, padreUsuarioId: string) {
        return this.db.solicitudCita.findFirst({
            where: { id, padreUsuarioId },
            include: INCLUDE_PARA_PADRE,
        });
    }

    findParaProfesional(id: string, profesionalId: string) {
        return this.db.solicitudCita.findFirst({
            where: { id, profesionalId },
            include: INCLUDE_PADRE_PARA_PROFESIONAL,
        });
    }

    listarPorPadre(padreUsuarioId: string) {
        return this.db.solicitudCita.findMany({
            where: { padreUsuarioId },
            include: INCLUDE_PARA_PADRE,
            orderBy: { creadoEn: "desc" },
            take: 100,
        });
    }

    listarPorProfesional(profesionalId: string, estados?: EstadoSolicitudCita[]) {
        return this.db.solicitudCita.findMany({
            where: { profesionalId, ...(estados ? { estado: { in: estados } } : {}) },
            include: INCLUDE_PADRE_PARA_PROFESIONAL,
            orderBy: { creadoEn: "desc" },
            take: 100,
        });
    }

    /**
     * SPEC-425 (L5): el marcador del panel se cuenta EN LA BASE, no sobre
     * `listarPorProfesional` — ese método tiene `take: 100` y a partir de la
     * solicitud 101 el contador empezaría a mentir sin avisar. Un número que
     * se ve bien y no lo está es peor que no mostrarlo.
     */
    contarPorProfesional(profesionalId: string, estados?: EstadoSolicitudCita[]): Promise<number> {
        return this.db.solicitudCita.count({
            where: { profesionalId, ...(estados ? { estado: { in: estados } } : {}) },
        });
    }

    /**
     * Familias DISTINTAS que el profesional atendió. Una familia que pidió tres
     * citas es una familia, no tres — el marcador cuenta personas, no filas.
     */
    async contarFamiliasAtendidas(
        profesionalId: string,
        estados: EstadoSolicitudCita[],
    ): Promise<number> {
        const filas = await this.db.solicitudCita.groupBy({
            by: ["padreUsuarioId"],
            where: { profesionalId, estado: { in: estados } },
        });
        return filas.length;
    }

    listarPendientesAprobacionPago() {
        return this.db.solicitudCita.findMany({
            where: { estado: "SIN_CONFIRMAR", pagoAprobadoEn: null },
            include: {
                padreUsuario: { select: { id: true, nombre: true, email: true } },
                profesional: { select: { id: true, nombreVisible: true, tarifaConsultaCOP: true } },
                franja: { select: { inicio: true, fin: true, modalidad: true } },
            },
            orderBy: { creadoEn: "asc" },
            take: 200,
        });
    }

    listarVencidasSinAvisar48h(ahora: Date) {
        // Candidatas al aviso 48h: PAGADA_PENDIENTE con pagoAprobadoEn + 48h ya pasado.
        // El candado de repetición vive en el service (compara con audit).
        const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
        return this.db.solicitudCita.findMany({
            where: {
                estado: "PAGADA_PENDIENTE",
                pagoAprobadoEn: { lte: hace48h },
            },
            include: INCLUDE_PARA_PADRE,
            take: 200,
        });
    }

    listarSinConfirmarConPlazoVencido(ahora: Date) {
        return this.db.solicitudCita.findMany({
            where: {
                estado: "SIN_CONFIRMAR",
                pagoAprobadoEn: null,
                venceEn: { lt: ahora },
            },
            take: 200,
        });
    }

    contarConsecutivasVencidasPorProfesional(profesionalId: string): Promise<number> {
        // «Consecutivas» = últimas N solicitudes cerradas del profesional donde
        // TODAS son VENCIDA_SIN_RESPUESTA (la primera confirmada corta la racha).
        // Se cuenta desde la más reciente hasta encontrar una que NO sea vencida.
        // (Implementación: se traen las últimas 50 y se cuenta el prefijo).
        return this.db.solicitudCita
            .findMany({
                where: {
                    profesionalId,
                    estado: { in: ["VENCIDA_SIN_RESPUESTA", "CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"] },
                },
                select: { estado: true },
                orderBy: { actualizadoEn: "desc" },
                take: 50,
            })
            .then((rows) => {
                let n = 0;
                for (const r of rows) {
                    if (r.estado === "VENCIDA_SIN_RESPUESTA") n += 1;
                    else break;
                }
                return n;
            });
    }

    async tasaVencimientos(profesionalId: string, desdeUltimosN = 30): Promise<{ total: number; vencidas: number; tasa: number }> {
        const rows = await this.db.solicitudCita.findMany({
            where: {
                profesionalId,
                estado: { in: ["VENCIDA_SIN_RESPUESTA", "CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE", "REPROGRAMADA"] },
            },
            select: { estado: true },
            orderBy: { actualizadoEn: "desc" },
            take: desdeUltimosN,
        });
        const total = rows.length;
        const vencidas = rows.filter((r) => r.estado === "VENCIDA_SIN_RESPUESTA").length;
        const tasa = total === 0 ? 0 : vencidas / total;
        return { total, vencidas, tasa };
    }

    marcarPagoAprobado(id: string, pagoAprobadoEn: Date) {
        return this.db.solicitudCita.update({
            where: { id },
            data: {
                pagoAprobadoEn,
                estado: "PAGADA_PENDIENTE",
            },
        });
    }

    marcarConfirmada(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "CONFIRMADA" } });
    }

    marcarVencida48h(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "VENCIDA_SIN_RESPUESTA" } });
    }

    marcarReprogramadaOriginal(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "REPROGRAMADA" } });
    }

    marcarNoAsistioProfesional(id: string) {
        return this.db.solicitudCita.update({ where: { id }, data: { estado: "NO_ASISTIO_PROFESIONAL" } });
    }

    /**
     * SPEC-427 · el profesional digitó el código de cita: la sesión ocurrió.
     * `updateMany` con el estado esperado en el WHERE para que dos peticiones
     * simultáneas no cierren dos veces (devuelve cuántas filas movió).
     */
    async marcarCumplidaSiConfirmada(id: string): Promise<SolicitudCita | null> {
        const r = await this.db.solicitudCita.updateMany({
            where: { id, estado: "CONFIRMADA" },
            data: { estado: "CUMPLIDA" },
        });
        // Devuelve la fila, no un booleano: quien cierra le informa al padre y a
        // la pantalla el estado REAL que quedó en la base, no el que supone.
        if (r.count !== 1) return null;
        return this.db.solicitudCita.findUnique({ where: { id } });
    }

    /**
     * SPEC-427 · el profesional declara que la familia no se presentó.
     *
     * Mismo molde que `marcarCumplidaSiConfirmada` y a propósito: son los DOS
     * estados de cierre y los escribe el mismo actor desde la misma pantalla.
     * Que vivan juntos es lo que permite custodiar con un candado que ninguno
     * tenga un segundo escritor por ahí suelto.
     */
    async marcarNoAsistioPadreSiConfirmada(id: string): Promise<SolicitudCita | null> {
        const r = await this.db.solicitudCita.updateMany({
            where: { id, estado: "CONFIRMADA" },
            data: { estado: "NO_ASISTIO_PADRE" },
        });
        if (r.count !== 1) return null;
        return this.db.solicitudCita.findUnique({ where: { id } });
    }

    /**
     * SPEC-427 (I-300) · autocierre a los 5 días sin código.
     * Deja `autocerradaEn` además del estado: es la MARCA que separa «la cita
     * pasó y nadie la cerró» de «recién creada y nadie pagó», que comparten
     * `SIN_CONFIRMAR`. La cola 2 del Verificador filtra por esta columna.
     */
    /**
     * SPEC-427 (fix b) · guardia de estado en el WHERE. Entre que el barrido
     * elige las candidatas y las marca, el profesional puede haber cerrado una:
     * sin este `estado: "CONFIRMADA"`, el autocierre PISARÍA una CUMPLIDA o una
     * NO_ASISTIO recién escritas. Devuelve si de verdad la movió.
     */
    async marcarAutocerrada(id: string, autocerradaEn: Date): Promise<boolean> {
        const r = await this.db.solicitudCita.updateMany({
            where: { id, estado: "CONFIRMADA", autocerradaEn: null },
            data: { estado: "SIN_CONFIRMAR", autocerradaEn },
        });
        return r.count === 1;
    }

    /**
     * SPEC-427 · citas confirmadas que arrancan dentro de la ventana y que
     * todavía no tienen código de cita emitido. El recordatorio con el código
     * sale de acá: se emite CERCA de la hora, no días antes.
     */
    listarConfirmadasPorArrancar(desde: Date, hasta: Date) {
        return this.db.solicitudCita.findMany({
            where: {
                estado: "CONFIRMADA",
                franja: { inicio: { gte: desde, lte: hasta } },
                codigos: { none: { tipo: "CITA" } },
            },
            include: {
                franja: { select: { inicio: true, fin: true } },
                padreUsuario: { select: { id: true, email: true, nombre: true } },
                profesional: { select: { id: true, nombreVisible: true } },
            },
            orderBy: { creadoEn: "asc" },
        });
    }

    /** SPEC-427 · una solicitud con lo que hace falta para emitir y avisar. */
    findParaCodigo(id: string) {
        return this.db.solicitudCita.findUnique({
            where: { id },
            include: {
                franja: { select: { inicio: true, fin: true } },
                padreUsuario: { select: { id: true, email: true, nombre: true } },
                profesional: { select: { id: true, nombreVisible: true } },
            },
        });
    }

    /**
     * SPEC-427 · candidatas al autocierre: confirmadas cuya franja terminó hace
     * más de N días y que nadie cerró todavía.
     */
    listarConfirmadasVencidasParaAutocierre(limite: Date) {
        return this.db.solicitudCita.findMany({
            where: {
                estado: "CONFIRMADA",
                autocerradaEn: null,
                franja: { fin: { lt: limite } },
            },
            include: {
                franja: { select: { inicio: true, fin: true } },
                padreUsuario: { select: { id: true, email: true, nombre: true } },
                profesional: { select: { id: true, nombreVisible: true } },
            },
            orderBy: { creadoEn: "asc" },
        });
    }
}
