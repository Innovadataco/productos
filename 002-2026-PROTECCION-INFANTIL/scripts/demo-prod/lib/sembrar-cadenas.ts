/**
 * SPEC-676/814 · Sembradores de CADENA de la Red de Apoyo. Extraídos de `poblar-red-apoyo.ts` por el
 * límite de tamaño de archivo (max-lines, mismo corte que `email-padre.ts` y los repositorios): las dos
 * cadenas «nacieron juntas» — una cita original TERMINAL + una hija que HEREDA el pago (sin re-cobro):
 *   · REPROGRAMADA → mismo profesional, franja original LIBERADA.
 *   · REUBICADA (SPEC-814, art. 19) → OTRO profesional, franja original OCUPADA (no libera: el
 *     profesional dejó de estar disponible), + prueba de continuidad (reubicadaEnId/reubicadaEn/reubicadaPorId).
 *
 * Reciben por INYECCIÓN los helpers con ESTADO de la corrida (`entero` = rng SEMBRADO determinista,
 * `fechaEnVentana`, `marcar`, `montos`): así la reproducibilidad del poblador no se rompe (un rng propio
 * daría otra secuencia) y no se duplican. El resto (prisma, franjaBogota, franjaTomadaPara) se importa
 * directo porque no depende del estado de la corrida.
 */
import type { Prisma, ModalidadCita } from "@prisma/client";
import { prisma } from "./prisma";
import { franjaBogota, HORA_FRANJA_MIN, HORA_FRANJA_MAX } from "./franja-hora-bogota";
import { franjaTomadaPara, CORRIDA_RED } from "./red-apoyo-plan";

type Tx = Prisma.TransactionClient;
const MS_DIA = 24 * 60 * 60 * 1000;

export interface ProfSembrado {
    perfilId: string;
    modalidades: ModalidadCita[];
    tarifa: number;
    bucket: "alta" | "media" | "baja";
}

/** Helpers con ESTADO de la corrida que el poblador inyecta (ver cabecera). */
export interface CadenaDeps {
    entero: (min: number, max: number) => number;
    fechaEnVentana: () => Date;
    marcar: (tx: Tx, entidad: string, entidadId: string, notas?: string) => Promise<void>;
    montos: (
        esPrimera: boolean,
        tarifa: number,
        precioEstandar: number,
        pct: number,
    ) => { montoConsulta: number; montoServicio: number; montoTotal: number; porcentajeServicio: number };
}

/**
 * SPEC-814 · actor de la reubicación demo (`reubicadaPorId`). En prod lo pone el OPERADOR/ADMIN que
 * hace el escalamiento manual; el demo NO siembra operadores, así que usa un SENTINEL ESTABLE: el
 * rastro del art. 19 es DURABLE (String sin FK) y a propósito NO resuelve a una cuenta — igual que en
 * prod, donde la cuenta del actor puede haberse borrado y la cita no (schema SolicitudCita.reubicadaPorId,
 * «las cuentas se borran, las citas no»). Derivado de CORRIDA_RED y ESTABLE entre corridas (no rota):
 * cualquier consumidor (BI) lee siempre el mismo rastro.
 */
const REUBICADA_POR_DEMO = `demo:${CORRIDA_RED}:operador-reubicacion`;

export function crearSembradoresDeCadena(deps: CadenaDeps) {
    const { entero, fechaEnVentana, marcar, montos } = deps;

    /** Reprograma largo-1: la hija hereda el pago del original; el original queda REPROGRAMADA. */
    async function sembrarReprogramacion(opts: {
        prof: ProfSembrado;
        padreUsuarioId: string;
        esPrimeraDelPadre: boolean;
        precioEstandar: number;
        pct: number;
    }): Promise<void> {
        const { prof, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct } = opts;
        const modalidad = prof.modalidades[entero(0, prof.modalidades.length - 1)]!;
        const creadoEn = fechaEnVentana();
        const m = montos(esPrimeraDelPadre, prof.tarifa, precioEstandar, pct);

        await prisma.$transaction(async (tx) => {
            // Original: franja LIBERADA (REPROGRAMADA la libera), estado REPROGRAMADA.
            // Día = creadoEn+2; hora en zona de Bogotá (7am–7pm), no la del contenedor.
            const horaOrig = franjaBogota(new Date(creadoEn.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
            const franjaOrig = await tx.franjaDisponible.create({
                data: {
                    profesionalId: prof.perfilId,
                    inicio: horaOrig.inicio,
                    fin: horaOrig.fin,
                    modalidad,
                    tomada: false,
                },
            });
            await marcar(tx, "FranjaDisponible", franjaOrig.id, "cita REPROGRAMADA (liberada)");
            const original = await tx.solicitudCita.create({
                data: {
                    padreUsuarioId,
                    profesionalId: prof.perfilId,
                    franjaId: franjaOrig.id,
                    presentacion: "Solicitud DEMO reprogramada (poblador SPEC-676).",
                    urgencia: "SIN_APURO",
                    estado: "REPROGRAMADA",
                    venceEn: new Date(creadoEn.getTime() + 72 * 60 * 60 * 1000),
                    pagoAprobadoEn: new Date(creadoEn.getTime() + 6 * 60 * 60 * 1000),
                    ...m,
                    creadoEn,
                },
            });
            await marcar(tx, "SolicitudCita", original.id, "REPROGRAMADA");

            // Hija: franja NUEVA tomada, hereda el pago del original (sin cobro nuevo), CUMPLIDA.
            const creadoHija = new Date(creadoEn.getTime() + 3 * MS_DIA);
            const horaHija = franjaBogota(new Date(creadoHija.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
            const franjaHija = await tx.franjaDisponible.create({
                data: {
                    profesionalId: prof.perfilId,
                    inicio: horaHija.inicio,
                    fin: horaHija.fin,
                    modalidad,
                    tomada: true,
                },
            });
            await marcar(tx, "FranjaDisponible", franjaHija.id, "cita hija de reprogramación");
            const hija = await tx.solicitudCita.create({
                data: {
                    padreUsuarioId,
                    profesionalId: prof.perfilId,
                    franjaId: franjaHija.id,
                    presentacion: "Solicitud DEMO (hija de reprogramación, hereda pago).",
                    urgencia: "SIN_APURO",
                    estado: "CUMPLIDA",
                    venceEn: new Date(creadoHija.getTime() + 72 * 60 * 60 * 1000),
                    pagoAprobadoEn: new Date(creadoHija.getTime() + 6 * 60 * 60 * 1000),
                    pagoHeredadoDeId: original.id,
                    solicitudPreviaId: original.id,
                    ...m, // hereda los montos del original (no re-cobra)
                    creadoEn: creadoHija,
                },
            });
            await marcar(tx, "SolicitudCita", hija.id, "hija reprogramación (CUMPLIDA)");
        });
    }

    /**
     * Reubicación largo-1 (SPEC-814 · [NORMA] Ley 1581 art. 19): el profesional ORIGINAL dejó de estar
     * disponible, su cita confirmada queda REUBICADA (terminal) y la atención CONTINÚA en una fila NUEVA
     * con OTRO profesional que HEREDA el pago (sin re-cobro). A diferencia de REPROGRAMADA: (a) la franja
     * original NO se libera (`franjaTomadaPara("REUBICADA")` = true — el profesional ya no está), y (b) la
     * hija es con un profesional DISTINTO. La original cierra la prueba de continuidad del art. 19:
     * `reubicadaEnId` → la hija, `reubicadaEn`, `reubicadaPorId` (actor durable).
     */
    async function sembrarReubicacion(opts: {
        profOrigen: ProfSembrado;
        profDestino: ProfSembrado;
        padreUsuarioId: string;
        esPrimeraDelPadre: boolean;
        precioEstandar: number;
        pct: number;
    }): Promise<void> {
        const { profOrigen, profDestino, padreUsuarioId, esPrimeraDelPadre, precioEstandar, pct } = opts;
        const modalidadOrig = profOrigen.modalidades[entero(0, profOrigen.modalidades.length - 1)]!;
        const modalidadDest = profDestino.modalidades[entero(0, profDestino.modalidades.length - 1)]!;
        const creadoEn = fechaEnVentana();
        const m = montos(esPrimeraDelPadre, profOrigen.tarifa, precioEstandar, pct);

        await prisma.$transaction(async (tx) => {
            // Original: franja OCUPADA (REUBICADA no libera), estado REUBICADA (terminal).
            const horaOrig = franjaBogota(new Date(creadoEn.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
            const franjaOrig = await tx.franjaDisponible.create({
                data: {
                    profesionalId: profOrigen.perfilId,
                    inicio: horaOrig.inicio,
                    fin: horaOrig.fin,
                    modalidad: modalidadOrig,
                    tomada: franjaTomadaPara("REUBICADA"),
                },
            });
            await marcar(tx, "FranjaDisponible", franjaOrig.id, "cita REUBICADA (ocupada)");
            const original = await tx.solicitudCita.create({
                data: {
                    padreUsuarioId,
                    profesionalId: profOrigen.perfilId,
                    franjaId: franjaOrig.id,
                    presentacion: "Solicitud DEMO reubicada (poblador SPEC-676/814).",
                    urgencia: "SIN_APURO",
                    estado: "REUBICADA",
                    venceEn: new Date(creadoEn.getTime() + 72 * 60 * 60 * 1000),
                    pagoAprobadoEn: new Date(creadoEn.getTime() + 6 * 60 * 60 * 1000),
                    ...m,
                    creadoEn,
                },
            });
            await marcar(tx, "SolicitudCita", original.id, "REUBICADA");

            // Hija: profesional DISTINTO, franja NUEVA tomada, HEREDA el pago del original (sin re-cobro), CUMPLIDA.
            const creadoHija = new Date(creadoEn.getTime() + 3 * MS_DIA);
            const horaHija = franjaBogota(new Date(creadoHija.getTime() + 2 * MS_DIA), 50, entero(HORA_FRANJA_MIN, HORA_FRANJA_MAX));
            const franjaHija = await tx.franjaDisponible.create({
                data: {
                    profesionalId: profDestino.perfilId,
                    inicio: horaHija.inicio,
                    fin: horaHija.fin,
                    modalidad: modalidadDest,
                    tomada: true,
                },
            });
            await marcar(tx, "FranjaDisponible", franjaHija.id, "cita hija de reubicación (otro profesional)");
            const hija = await tx.solicitudCita.create({
                data: {
                    padreUsuarioId,
                    profesionalId: profDestino.perfilId,
                    franjaId: franjaHija.id,
                    presentacion: "Solicitud DEMO (hija de reubicación, otro profesional, hereda pago).",
                    urgencia: "SIN_APURO",
                    estado: "CUMPLIDA",
                    venceEn: new Date(creadoHija.getTime() + 72 * 60 * 60 * 1000),
                    pagoAprobadoEn: new Date(creadoHija.getTime() + 6 * 60 * 60 * 1000),
                    pagoHeredadoDeId: original.id,
                    solicitudPreviaId: original.id,
                    ...m, // hereda los montos del original (no re-cobra)
                    creadoEn: creadoHija,
                },
            });
            await marcar(tx, "SolicitudCita", hija.id, "hija reubicación (CUMPLIDA, otro profesional)");

            // Cierra la prueba de continuidad del art. 19: la original APUNTA a la hija + actor/momento durables.
            await tx.solicitudCita.update({
                where: { id: original.id },
                data: { reubicadaEnId: hija.id, reubicadaEn: creadoHija, reubicadaPorId: REUBICADA_POR_DEMO },
            });
        });
    }

    return { sembrarReprogramacion, sembrarReubicacion };
}
