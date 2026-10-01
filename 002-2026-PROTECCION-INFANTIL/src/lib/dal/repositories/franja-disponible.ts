/**
 * SPEC-395 (L4) · Repositorio de FranjaDisponible.
 * Q-3: acceso a Prisma acá; el service la usa. La franja se marca `tomada = true`
 * cuando el padre solicita la cita, y se libera si la solicitud expira sin pago
 * o si el profesional rechaza.
 */
import type { FranjaDisponible, ModalidadCita, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";
// SPEC-825: la elegibilidad REPS vive en un módulo compartido (sin ciclo con perfil-profesional). El mapeo
// modalidad-de-cita→eje-REPS (VIRTUAL→TELEMEDICINA, PRESENCIAL→PRESENCIAL) es su propia fuente única.
import { idsRepsElegiblesLote } from "@/lib/profesional/reps/elegibilidad-reps-lote";
import { modalidadRepsRequerida } from "@/lib/profesional/reps/modalidad-cita-a-reps";

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

    /**
     * SPEC-825 · la pieza que cierra la costura: candidatos por banderas (`whereFranjaOfrecible`) →
     * intersección con el REPS-elegible POR MODALIDAD. El picker y el chip la COMPARTEN — ninguno decide
     * ofrecible por su cuenta. Dos consultas por LOTE (no N+1): el set elegible por cada eje REPS.
     *
     * ⚠️ Siempre con la modalidad CONCRETA de la franja (nunca `null`): `null` = «elegible para ALGUNA
     * modalidad», correcto para el DIRECTORIO pero el BUG a nivel de franja (un REPS-solo-PRESENCIAL se colaría
     * con su franja virtual). El mapeo franja→eje-REPS es `modalidadRepsRequerida` (fuente única); sin mapeo →
     * fail-closed (se excluye).
     */
    private async filtrarRepsElegibles<T extends { profesionalId: string; modalidad: string }>(
        franjas: T[],
        ahora: Date,
    ): Promise<T[]> {
        if (franjas.length === 0) return franjas;
        const perfilIds = [...new Set(franjas.map((f) => f.profesionalId))];
        const [elegiblesTelemedicina, elegiblesPresencial] = await Promise.all([
            idsRepsElegiblesLote(this.db, perfilIds, "TELEMEDICINA", ahora),
            idsRepsElegiblesLote(this.db, perfilIds, "PRESENCIAL", ahora),
        ]);
        return franjas.filter((f) => {
            const reps = modalidadRepsRequerida(f.modalidad);
            if (reps === null) return false; // modalidad sin mapeo al eje REPS → no se ofrece (fail-closed)
            return (reps === "TELEMEDICINA" ? elegiblesTelemedicina : elegiblesPresencial).has(f.profesionalId);
        });
    }

    // SPEC-818 · CHOKEPOINT: el padre solo ve lo OFRECIBLE. SPEC-825: «ofrecible» = banderas ∧ REPS-por-modalidad
    // (la reserva exige lo mismo; antes el display miraba solo banderas y dejaba un callejón sin salida).
    async listarLibresDeProfesional(profesionalId: string, desde: Date) {
        const candidatas = await this.db.franjaDisponible.findMany({
            where: { profesionalId, ...whereFranjaOfrecible(desde) },
            orderBy: { inicio: "asc" },
            take: 60,
        });
        return this.filtrarRepsElegibles(candidatas, desde);
    }

    /**
     * SPEC-818 · ¿cuáles de `perfilIds` tienen ≥1 franja OFRECIBLE? MISMA definición que
     * `listarLibresDeProfesional` (el chip del directorio pregunta «¿devuelve ≥1?», no reimplementa el
     * criterio): ambos pasan por `whereFranjaOfrecible` + `filtrarRepsElegibles`. El chip no puede decir «tiene
     * horarios» mientras la pantalla de reserva muestra nada. SPEC-825: se trae la `modalidad` para poder
     * aplicar el REPS por modalidad.
     */
    async idsConHorariosDisponibles(perfilIds: string[], desde: Date): Promise<Set<string>> {
        if (perfilIds.length === 0) return new Set();
        const candidatas = await this.db.franjaDisponible.findMany({
            where: { profesionalId: { in: perfilIds }, ...whereFranjaOfrecible(desde) },
            select: { profesionalId: true, modalidad: true },
            distinct: ["profesionalId", "modalidad"],
        });
        const elegibles = await this.filtrarRepsElegibles(candidatas, desde);
        return new Set(elegibles.map((f) => f.profesionalId));
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
     * franja OFRECIBLE que SOLAPA `[inicio, fin)`. «Ofrecible» = la MISMA definición de dos etapas que usa el
     * padre: `whereFranjaOfrecible` (libre · FUTURA · modalidad que el perfil atiende) ∩ `filtrarRepsElegibles`
     * (REPS al día POR MODALIDAD, vía `idsRepsElegiblesLote`, la fuente única). No reimplementa el criterio: un
     * destino que la reserva rechazaría no puede proponerse acá. La cota de futuro (`inicio >= ahora`) viene de
     * `whereFranjaOfrecible` — antes este método la omitía (hallazgo de Datos: sobre una cita pasada devolvía
     * franjas pasadas). El solape usa el fragmento compartido `whereSolapa`. `distinct` por profesional: la
     * candidatura es por PERSONA; el turno concreto a tomar se elige al reubicar.
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
            select: { profesionalId: true, modalidad: true },
            distinct: ["profesionalId"],
        });
        // La mitad REPS de «ofrecible», POR MODALIDAD concreta de la franja (nunca `null`): el mismo cinturón
        // que el picker del padre, para no quedar fuera del criterio único.
        const elegibles = await this.filtrarRepsElegibles(franjas, ahora);
        return elegibles.map((f) => ({ profesionalId: f.profesionalId }));
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
