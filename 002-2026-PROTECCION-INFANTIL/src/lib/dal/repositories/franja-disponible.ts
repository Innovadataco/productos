/**
 * SPEC-395 (L4) · Repositorio de FranjaDisponible.
 * Q-3: acceso a Prisma acá; el service la usa. La franja se marca `tomada = true`
 * cuando el padre solicita la cita, y se libera si la solicitud expira sin pago
 * o si el profesional rechaza.
 */
import type { FranjaDisponible, ModalidadCita, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

/**
 * SPEC-818 · ÚNICA definición de «franja OFRECIBLE»: libre, futura, y cuya modalidad el perfil VIGENTE
 * atiende (cruzada por la RELACIÓN → se lee el flag al consultar, no uno cacheado al crear). La consulta del
 * padre (`listarLibresDeProfesional`) y el chip del directorio (`idsConHorariosDisponibles`) la COMPARTEN:
 * una sola fuente, no pueden divergir. Apagar el flag OCULTA (no borra); re-encenderlo DEVUELVE la franja.
 */
function whereFranjaOfrecible(desde: Date): Prisma.FranjaDisponibleWhereInput {
    return {
        tomada: false,
        inicio: { gte: desde },
        OR: [
            { modalidad: "VIRTUAL", profesional: { atiendeVirtual: true } },
            { modalidad: "PRESENCIAL", profesional: { atiendePresencial: true } },
        ],
    };
}

/**
 * SPEC-832 · El predicado de SOLAPE `[inicio, fin)` como where-fragment ÚNICO (medio-abierto:
 * `inicio < fin' ∧ fin > inicio'`) — el MISMO que `ventanasSolapan` resuelve en JS. Lo comparten
 * `existeSolapada` (publicar) y `profesionalesConFranjaLibreSolapando` (reubicar) para no duplicar el
 * predicado en dos consultas. Va como objeto propio (para combinar en un `AND` sin pisar otra cláusula
 * sobre `inicio`, p. ej. la cota de futuro de `whereFranjaOfrecible`).
 */
function whereSolapa(inicio: Date, fin: Date): Prisma.FranjaDisponibleWhereInput {
    return { inicio: { lt: fin }, fin: { gt: inicio } };
}

export class FranjaDisponibleRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.FranjaDisponibleCreateInput) {
        return this.db.franjaDisponible.create({ data });
    }

    findById(id: string): Promise<FranjaDisponible | null> {
        return this.db.franjaDisponible.findUnique({ where: { id } });
    }

    // SPEC-818 · CHOKEPOINT: el padre solo ve lo OFRECIBLE = libre, futura y de una modalidad que el perfil
    // VIGENTE atiende (`whereFranjaOfrecible`, cruzada por la relación). El chip del directorio comparte la
    // misma definición (SPEC-852 retiró la mitad REPS; la verificación interna gatea al nivel del perfil).
    async listarLibresDeProfesional(profesionalId: string, desde: Date) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, ...whereFranjaOfrecible(desde) },
            orderBy: { inicio: "asc" },
            take: 60,
        });
    }

    /**
     * SPEC-818 · ¿cuáles de `perfilIds` tienen ≥1 franja OFRECIBLE? MISMA definición que
     * `listarLibresDeProfesional` (el chip del directorio pregunta «¿devuelve ≥1?», no reimplementa el
     * criterio): ambos pasan por `whereFranjaOfrecible`. El chip no puede decir «tiene horarios» mientras la
     * pantalla de reserva no muestra nada.
     */
    async idsConHorariosDisponibles(perfilIds: string[], desde: Date): Promise<Set<string>> {
        if (perfilIds.length === 0) return new Set();
        const candidatas = await this.db.franjaDisponible.findMany({
            where: { profesionalId: { in: perfilIds }, ...whereFranjaOfrecible(desde) },
            select: { profesionalId: true },
            distinct: ["profesionalId"],
        });
        return new Set(candidatas.map((f) => f.profesionalId));
    }

    listarDeProfesional(profesionalId: string) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, inicio: { gte: new Date() } },
            orderBy: { inicio: "asc" },
            take: 200,
        });
    }

    /**
     * SPEC-714 · el calendario nivel dios lee un RANGO (una semana / un día) con
     * la reserva de cada franja: el estado del bloque sale de `solicitud.estado`
     * (libre si no hay reserva). Trae el relato (`presentacion`) y el contacto del
     * padre; el DTO decide qué exponer por H-2 (correo solo en CONFIRMADA).
     */
    listarConSolicitud(profesionalId: string, desde: Date, hasta: Date) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, inicio: { gte: desde, lt: hasta } },
            orderBy: { inicio: "asc" },
            include: {
                solicitud: {
                    select: {
                        id: true,
                        estado: true,
                        presentacion: true,
                        // SPEC-778: para DERIVAR el estado del enlace en el calendario del
                        // profesional (gateado por `enlace-derivado`); NO salen crudos al DTO.
                        enlaceReunion: true,
                        enlacePublicadoEn: true,
                        padreUsuario: { select: { nombre: true, email: true } },
                    },
                },
            },
        });
    }

    /**
     * SPEC-447 (I-311): ¿hay ya una franja del profesional que se pise con
     * `[inicio, fin)`? Dos franjas se solapan cuando cada una empieza antes de
     * que termine la otra. Se comparan en UTC —que es como se guardan— así que
     * no hay zona horaria de por medio.
     *
     * Incluye las TOMADAS a propósito: una franja reservada ocupa la agenda
     * igual que una libre, y publicar encima sería prometer dos citas a la vez.
     */
    existeSolapada(profesionalId: string, inicio: Date, fin: Date, excluirId?: string) {
        return this.db.franjaDisponible.findFirst({
            where: {
                profesionalId,
                ...(excluirId ? { id: { not: excluirId } } : {}),
                ...whereSolapa(inicio, fin),
            },
            select: { id: true, inicio: true, fin: true },
        });
    }

    /**
     * SPEC-832 (T7 de 790) · EL CUELLO de la reubicación: profesionales (≠ `excluirProfesionalId`) con una
     * franja OFRECIBLE que SOLAPA `[inicio, fin)`. «Ofrecible» = `whereFranjaOfrecible` (libre · FUTURA ·
     * modalidad que el perfil atiende) — la MISMA definición que usa el padre, así que un destino que la
     * reserva rechazaría no puede proponerse acá (SPEC-852 retiró la mitad REPS). La cota de futuro
     * (`inicio >= ahora`) viene de `whereFranjaOfrecible` — antes este método la omitía (hallazgo de Datos:
     * sobre una cita pasada devolvía franjas pasadas). El solape usa el fragmento compartido `whereSolapa`.
     * `distinct` por profesional: la candidatura es por PERSONA; el turno concreto a tomar se elige al reubicar.
     */
    async profesionalesConFranjaLibreSolapando(
        inicio: Date,
        fin: Date,
        modalidad: ModalidadCita,
        excluirProfesionalId: string,
        ahora: Date = new Date(),
    ): Promise<{ profesionalId: string }[]> {
        const franjas = await this.db.franjaDisponible.findMany({
            where: {
                AND: [
                    whereFranjaOfrecible(ahora), // libre + inicio>=ahora + modalidad-flag del perfil
                    whereSolapa(inicio, fin), // inicio<fin ∧ fin>inicio (combina con la cota de futuro sin pisarla)
                    { modalidad, profesionalId: { not: excluirProfesionalId } },
                ],
            },
            select: { profesionalId: true },
            distinct: ["profesionalId"],
        });
        return franjas.map((f) => ({ profesionalId: f.profesionalId }));
    }

    /**
     * SPEC-832 (pieza 2) · Los TURNOS concretos de UN candidato B que el admin puede elegir al reubicar:
     * las franjas OFRECIBLES de B (`whereFranjaOfrecible`) que SOLAPAN la ventana de la cita. El matcher da
     * PERSONAS; esto da los turnos de una persona para el segundo paso del picker. Mismo criterio que
     * `profesionalesConFranjaLibreSolapando` — no reimplementa el filtro.
     */
    async franjasOfreciblesSolapando(
        profesionalId: string,
        inicio: Date,
        fin: Date,
        modalidad: ModalidadCita,
        ahora: Date = new Date(),
    ): Promise<{ id: string; inicio: Date; fin: Date }[]> {
        const franjas = await this.db.franjaDisponible.findMany({
            where: {
                AND: [whereFranjaOfrecible(ahora), whereSolapa(inicio, fin), { modalidad, profesionalId }],
            },
            select: { id: true, inicio: true, fin: true },
            orderBy: { inicio: "asc" },
        });
        return franjas.map((f) => ({ id: f.id, inicio: f.inicio, fin: f.fin }));
    }

    marcarTomadaSiLibre(id: string) {
        return this.db.franjaDisponible.updateMany({
            where: { id, tomada: false },
            data: { tomada: true },
        });
    }

    liberar(id: string) {
        return this.db.franjaDisponible.update({ where: { id }, data: { tomada: false } });
    }

    borrarSiLibre(id: string) {
        return this.db.franjaDisponible.deleteMany({ where: { id, tomada: false } });
    }
}
