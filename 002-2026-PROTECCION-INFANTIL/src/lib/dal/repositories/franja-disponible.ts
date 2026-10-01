/**
 * SPEC-395 (L4) · Repositorio de FranjaDisponible.
 * Q-3: acceso a Prisma acá; el service la usa. La franja se marca `tomada = true`
 * cuando el padre solicita la cita, y se libera si la solicitud expira sin pago
 * o si el profesional rechaza.
 */
import type { FranjaDisponible, Prisma } from "@prisma/client";
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

    // SPEC-818 · CHOKEPOINT: el padre solo ve lo OFRECIBLE. Si el profesional apagó la modalidad DESPUÉS de
    // publicar la franja, esa franja deja de ofrecerse — nada aguas abajo puede reservar lo incumplible.
    listarLibresDeProfesional(profesionalId: string, desde: Date) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, ...whereFranjaOfrecible(desde) },
            orderBy: { inicio: "asc" },
            take: 60,
        });
    }

    /**
     * SPEC-818 · ¿cuáles de `perfilIds` tienen ≥1 franja OFRECIBLE? MISMA definición que
     * `listarLibresDeProfesional` (el chip del directorio pregunta «¿devuelve ≥1?», no reimplementa el
     * criterio). Una sola consulta para todo el lote (sin N+1). El chip no puede decir «tiene horarios»
     * mientras la pantalla de reserva no muestra nada: comparten `whereFranjaOfrecible`.
     */
    async idsConHorariosDisponibles(perfilIds: string[], desde: Date): Promise<Set<string>> {
        if (perfilIds.length === 0) return new Set();
        const filas = await this.db.franjaDisponible.findMany({
            where: { profesionalId: { in: perfilIds }, ...whereFranjaOfrecible(desde) },
            select: { profesionalId: true },
            distinct: ["profesionalId"],
        });
        return new Set(filas.map((f) => f.profesionalId));
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
                inicio: { lt: fin },
                fin: { gt: inicio },
            },
            select: { id: true, inicio: true, fin: true },
        });
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
