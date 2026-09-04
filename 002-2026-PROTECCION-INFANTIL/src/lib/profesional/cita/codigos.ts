/**
 * SPEC-427 (A-75 · L6 · brief §9 momento 6) — los dos códigos del cierre.
 *
 * El brief los describe como «el corazón del cierre»: dos códigos distintos,
 * únicos, de un solo uso, con vigencia de 30 minutos. El padre se los entrega
 * al profesional **de viva voz, en la sesión**; el profesional los digita.
 *
 *  · **Código de cita** → certifica que la sesión OCURRIÓ. Al digitarlo la cita
 *    queda `CUMPLIDA`. Le llega al padre 10 minutos antes de la hora agendada,
 *    en el recordatorio, diciendo en el mismo mensaje que vence en 30 minutos.
 *  · **Código de expediente** → autoriza a ABRIR el expediente. Solo existe si
 *    el padre eligió compartirlo.
 *
 * Por qué así, con las palabras del brief: «la autorización deja de ser una
 * casilla marcada días antes y pasa a ser un acto del padre, en el momento, con
 * constancia. Si se arrepiente, no entrega el código y no hay nada que revocar.»
 *
 * ## Lo que NO se inventa acá
 * El mecanismo es el mismo del código de verificación del registro
 * (`dal/services/autenticacion.ts:252-295`), que ya está probado: bcrypt,
 * vencimiento, tope de intentos fallidos, y un límite de reemisiones por
 * ventana. Se reusa el criterio, no se copia el código.
 */
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, TipoCodigoCita } from "@prisma/client";
import { CodigoCitaRepository } from "@/lib/dal/repositories/codigo-cita";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";

/** Vigencia dictada por el brief §9 momento 6. */
export const VIGENCIA_CODIGO_MS = 30 * 60 * 1000;
/** El recordatorio con el código sale 10 minutos antes de la hora agendada. */
export const ANTICIPACION_RECORDATORIO_MS = 10 * 60 * 1000;
/**
 * SPEC-427 (B1) · cuánto sigue valiendo el código DESPUÉS de que la franja
 * termina. El profesional cierra al terminar la sesión; el código tiene que
 * seguir vivo un rato más para el cierre y para un imprevisto.
 */
export const MARGEN_TRAS_SESION_MS = 60 * 60 * 1000;
/** Mismo tope que el código de verificación del registro. */
export const MAX_INTENTOS_CODIGO = 5;
/** 6 dígitos, CSPRNG. Se dicta en voz alta: más largo no se recuerda. */
export function generarCodigo(): string {
    return randomInt(100000, 1000000).toString();
}

export type MotivoRechazo =
    | "sin_codigo"
    | "expirado"
    | "max_intentos"
    | "incorrecto"
    | "ya_usado";

export type ResultadoCodigo =
    | { ok: true; codigoId: string }
    | { ok: false; motivo: MotivoRechazo };

export interface CodigoEmitido {
    /**
     * El código EN CLARO. No se persiste hasheado sí, pero SÍ viaja al padre y
     * queda en `Notificacion.variables` del motor (como el código de
     * verificación del registro). Riesgo aceptado y acotado: vigencia corta y
     * un solo uso. Ver el plan de la spec.
     */
    codigo: string;
    codigoId: string;
    expiraEn: Date;
}

export interface EmitirCodigoInput {
    solicitudId: string;
    tipo: TipoCodigoCita;
    /**
     * Cuándo empieza a valer. Para el código de cita es la hora agendada menos
     * 10 minutos (la fila se crea al confirmar, días antes: el correo se
     * programa con `enviarEn` y el motor lo suelta a esa hora).
     */
    vigenteDesde: Date;
    /**
     * SPEC-427 (B1) · el FIN de la franja de la cita. La vigencia se ancla a él,
     * no a la emisión: una consulta dura 45–60 min y el profesional cierra al
     * TERMINAR, así que un código que muere a los 30 min de emitido (≈inicio+20)
     * siempre le daría «expirado» en el camino normal. Se calcula
     * `max(vigenteDesde + 30 min, franjaFin + 60 min)`. Si falta, cae al viejo
     * comportamiento (solo para llamadores sin franja, como un test unitario).
     */
    franjaFin?: Date | undefined;
    tx?: Prisma.TransactionClient | undefined;
}

/** SPEC-427 (B1) · la vigencia real: cubre hasta pasada la sesión. */
export function calcularExpiraEn(vigenteDesde: Date, franjaFin?: Date): Date {
    const minimo = new Date(vigenteDesde.getTime() + VIGENCIA_CODIGO_MS);
    if (!franjaFin) return minimo;
    const trasLaSesion = new Date(franjaFin.getTime() + MARGEN_TRAS_SESION_MS);
    return trasLaSesion > minimo ? trasLaSesion : minimo;
}

/**
 * Emite un código y devuelve el claro para que el llamador lo mande.
 *
 * Emitir NO borra los anteriores: la traza es el conjunto de filas y el brief la
 * exige completa («cuántas veces se pidió cada código»). Lo que invalida al
 * viejo es dejar de ser el último sin usar — ver `findVigente`.
 */
export async function emitirCodigo(input: EmitirCodigoInput): Promise<CodigoEmitido> {
    const codigo = generarCodigo();
    const fila = await new CodigoCitaRepository(input.tx).crear({
        solicitudId: input.solicitudId,
        tipo: input.tipo,
        codigoHash: await bcrypt.hash(codigo, 12),
        expiraEn: calcularExpiraEn(input.vigenteDesde, input.franjaFin),
    });
    return { codigo, codigoId: fila.id, expiraEn: fila.expiraEn };
}

/**
 * Valida el código que digitó el profesional, **sin consumirlo**.
 *
 * El orden importa y es el del registro: primero vencimiento, después tope de
 * intentos, después la comparación. Un código vencido no gasta intentos —el
 * padre pide otro y sigue— y un código con los intentos agotados no vuelve a
 * compararse aunque acierten.
 *
 * SPEC-427 (fix a) · validar y CONSUMIR se separaron a propósito. El consumo
 * (`marcarUsadoSiLibre`) y el cambio de estado de la cita tienen que ocurrir en
 * una MISMA transacción: si se consumía acá y el `CUMPLIDA` fallaba después, el
 * código quedaba quemado y la cita sin cerrar. Por eso esto solo dice «este
 * código sirve, es la fila N»; el llamador consume dentro de su transacción.
 *
 * El incremento por código errado SÍ va acá y fuera de toda transacción del
 * cierre: contar un intento fallido no debe deshacerse si el cierre aborta, o
 * la fuerza bruta dejaría de contarse.
 */
export async function validarCodigo(
    solicitudId: string,
    tipo: TipoCodigoCita,
    codigo: string,
    ahora: Date
): Promise<ResultadoCodigo> {
    const repo = new CodigoCitaRepository();
    const fila = await repo.findVigente(solicitudId, tipo);
    if (!fila) return { ok: false, motivo: "sin_codigo" };
    if (ahora > fila.expiraEn) return { ok: false, motivo: "expirado" };
    if (fila.intentosFallidos >= MAX_INTENTOS_CODIGO) return { ok: false, motivo: "max_intentos" };

    if (!(await bcrypt.compare(codigo, fila.codigoHash))) {
        await repo.incrementarIntentos(fila.id);
        return { ok: false, motivo: "incorrecto" };
    }
    return { ok: true, codigoId: fila.id };
}

/**
 * Una emisión de la traza. El brief la quiere visible para los tres
 * (administrador, padre, profesional); HOY solo la consume la cola 2 del
 * Verificador (autocerradas). Las vistas del padre y del profesional son de
 * specs posteriores.
 */
export interface EmisionEnTraza {
    tipo: TipoCodigoCita;
    pedidoEn: string;
    expiraEn: string;
    /** Cuándo lo digitó el profesional. `null` = no lo digitó. */
    usadoEn: string | null;
    intentosFallidos: number;
    /** Estado real del envío, leído del motor. `null` = todavía no se programó. */
    envio: { estado: string; enviarEn: string | null; sentAt: string | null } | null;
}

export interface TrazaCodigos {
    cita: EmisionEnTraza[];
    expediente: EmisionEnTraza[];
}

export const TRAZA_VACIA: TrazaCodigos = { cita: [], expediente: [] };

/**
 * La traza de una o varias solicitudes, en UNA consulta por tabla.
 *
 * El brief la quiere visible para los tres —administrador, padre y profesional—
 * con tres datos: cuántas veces se pidió cada código, la fecha y hora de cada
 * envío, y si el profesional lo digitó o no. Los dos primeros salen de las filas
 * de `CodigoCita`; el estado del envío se LEE del motor en vez de copiarse,
 * porque un `enviadoEn` propio mentiría el día que el correo falle (I-295).
 */
export async function trazaDeCodigos(
    solicitudIds: string[]
): Promise<Map<string, TrazaCodigos>> {
    const filas = await new CodigoCitaRepository().listarPorSolicitudes(solicitudIds);
    const notifIds = filas.map((f) => f.notificacionId).filter((x): x is string => x !== null);
    const envios = await new NotificacionRepository().listarEstadosPorIds(notifIds);
    const porId = new Map(envios.map((e) => [e.id, e]));

    const salida = new Map<string, TrazaCodigos>();
    for (const id of solicitudIds) salida.set(id, { cita: [], expediente: [] });

    for (const f of filas) {
        const traza = salida.get(f.solicitudId);
        if (!traza) continue;
        const envio = f.notificacionId ? porId.get(f.notificacionId) : undefined;
        const emision: EmisionEnTraza = {
            tipo: f.tipo,
            pedidoEn: f.creadoEn.toISOString(),
            expiraEn: f.expiraEn.toISOString(),
            usadoEn: f.usadoEn ? f.usadoEn.toISOString() : null,
            intentosFallidos: f.intentosFallidos,
            envio: envio
                ? {
                    estado: envio.estado,
                    enviarEn: envio.enviarEn ? envio.enviarEn.toISOString() : null,
                    sentAt: envio.sentAt ? envio.sentAt.toISOString() : null,
                }
                : null,
        };
        if (f.tipo === "CITA") traza.cita.push(emision);
        else traza.expediente.push(emision);
    }
    return salida;
}
