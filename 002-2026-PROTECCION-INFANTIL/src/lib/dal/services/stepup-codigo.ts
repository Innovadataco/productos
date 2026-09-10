/**
 * SPEC-606 (2026-09-09) · Ciclo de vida del código de step-up del texto sensible.
 *
 * Relevación con correo, SIN contraseña (estándar industria — decisión del
 * dueño): cualquier padre con sesión vieja recibe un código de 6 dígitos en SU
 * correo. Reemplaza al step-up por contraseña (SPEC-340, endpoint eliminado) y
 * al token firmado stateless de SPEC-592 (las cuentas OAuth eran su único
 * público; ahora el código es el único camino para todas las cuentas).
 *
 * Reglas (brief SPEC-606):
 *  - código CSPRNG de 6 dígitos; en reposo vive SOLO su sha-256 (`codigoHash`);
 *  - vigencia = parámetro `padre.texto.codigo_minutos` (default 10 min);
 *  - un solo código vigente por usuario: pedir otro expira los anteriores;
 *  - máximo 5 intentos de verificación: al agotarlos el código se consume;
 *  - un solo uso: al verificar bien queda consumido;
 *  - cooldown de reenvío de 60 s (mira el código más reciente, vigente o no);
 *  - TODO queda en AuditLog SIN el código ni el texto (solo hash y metadatos);
 *  - el correo sale por el motor de notificaciones y es fail-closed: sin regla
 *    activa la solicitud responde 502 (mismo patrón que SPEC-296/592/598).
 */
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import { hashCodigoAcceso } from "@/lib/acceso-codigo";
import { logAudit } from "@/lib/audit";
import { programar } from "@/lib/notificaciones";

const EVENTO_STEPUP_CODIGO = "padre.stepup.codigo";

/** Tope de intentos de verificación por código (decisión del dueño: 5). */
export const MAX_INTENTOS_CODIGO_STEPUP = 5;
/** Segundos mínimos entre dos envíos de código al mismo padre. */
export const COOLDOWN_REENVIO_CODIGO_SEG = 60;
/** Vigencia por defecto si falta el parámetro `padre.texto.codigo_minutos`. */
export const VIGENCIA_CODIGO_STEPUP_DEFAULT_MIN = 10;

/** Código de 6 dígitos con el CSPRNG de Node (ceros a la izquierda incluidos). */
export function generarCodigoStepUp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** sha-256 hex del código. Es lo único que se persiste en reposo. */
export function hashCodigoStepUp(codigo: string): string {
    return hashCodigoAcceso(codigo);
}

/** j•••••@gmail.com — la UI muestra a dónde salió el código sin regalar el correo. */
export function enmascararCorreo(email: string): string {
    const [local = "", dominio = ""] = email.split("@");
    return `${local.charAt(0)}•••••@${dominio}`;
}

async function vigenciaMinutosCodigo(): Promise<number> {
    const crudo = parseInt(
        (await getParametroSistemaValor("padre.texto.codigo_minutos")) ?? String(VIGENCIA_CODIGO_STEPUP_DEFAULT_MIN),
        10
    );
    return Number.isFinite(crudo) && crudo > 0 ? crudo : VIGENCIA_CODIGO_STEPUP_DEFAULT_MIN;
}

export type ResultadoSolicitudCodigo =
    | {
          estado: "enviado";
          vigenciaMinutos: number;
          cooldownSegundos: number;
          correoEnmascarado: string;
      }
    | { estado: "cooldown"; reintentaEnSegundos: number; correoEnmascarado: string };

/**
 * PASO 1 · El padre pide el código. Crea la fila (solo hash), audita y manda
 * el correo. Si el motor no tiene regla activa, la fila recién creada se
 * BORRA (ningún correo salió: el reintento no paga cooldown) y se lanza 502.
 */
export async function solicitarCodigoStepUp(params: {
    usuarioId: string;
    email: string;
    ip?: string;
}): Promise<ResultadoSolicitudCodigo> {
    const ahora = new Date();

    // Cooldown de reenvío: mira el código MÁS RECIENTE (vigente o no).
    const ultimo = await prisma.codigoStepUp.findFirst({
        where: { usuarioId: params.usuarioId },
        orderBy: { creadoEn: "desc" },
        select: { creadoEn: true },
    });
    if (ultimo) {
        const transcurridosSeg = Math.floor((ahora.getTime() - ultimo.creadoEn.getTime()) / 1000);
        if (transcurridosSeg < COOLDOWN_REENVIO_CODIGO_SEG) {
            return {
                estado: "cooldown",
                reintentaEnSegundos: COOLDOWN_REENVIO_CODIGO_SEG - transcurridosSeg,
                correoEnmascarado: enmascararCorreo(params.email),
            };
        }
    }

    const codigo = generarCodigoStepUp();
    const codigoHash = hashCodigoStepUp(codigo);
    const vigenciaMinutos = await vigenciaMinutosCodigo();
    const vigenteHasta = new Date(ahora.getTime() + vigenciaMinutos * 60 * 1000);

    const registro = await prisma.$transaction(async (tx) => {
        // Un solo código vigente por usuario: la nueva solicitud expira los
        // anteriores sin consumir (mismo patrón que CodigoAccesoContenido).
        await tx.codigoStepUp.updateMany({
            where: { usuarioId: params.usuarioId, consumidoEn: null, vigenteHasta: { gt: ahora } },
            data: { vigenteHasta: ahora },
        });
        return tx.codigoStepUp.create({
            data: { usuarioId: params.usuarioId, codigoHash, vigenteHasta },
        });
    });

    await logAudit({
        accion: "STEP_UP_CODIGO_SOLICITADO",
        tipoRecurso: "Usuario",
        recursoId: params.usuarioId,
        usuarioId: params.usuarioId,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        // El código en claro NUNCA va a la auditoría: solo su hash (rastreable, no usable).
        metadatos: { codigoHash },
    });

    // El correo con el código (canal oficial). Fail-closed: sin regla activa no
    // se promete un correo que jamás sale; la fila se expira para no bloquear
    // el reintento con el cooldown (ningún correo salió).
    const resultado = await programar({
        evento: EVENTO_STEPUP_CODIGO,
        sujetoTipo: "Usuario",
        sujetoId: params.usuarioId,
        destinatarios: [
            {
                usuarioId: params.usuarioId,
                rol: "PARENT",
                variables: { codigo, vigenciaMinutos },
            },
        ],
    });
    if (resultado.programadas === 0) {
        // La fila huérfana se BORRA: ningún correo salió, así que el reintento
        // no puede pagar cooldown por un código que el padre jamás recibió.
        await prisma.codigoStepUp.deleteMany({ where: { id: registro.id, consumidoEn: null } });
        throw new AppError("No pudimos enviar el código. Intenta de nuevo.", ERROR_CODES.BAD_GATEWAY, 502);
    }

    return {
        estado: "enviado",
        vigenciaMinutos,
        cooldownSegundos: COOLDOWN_REENVIO_CODIGO_SEG,
        correoEnmascarado: enmascararCorreo(params.email),
    };
}

export type ResultadoVerificacionCodigo =
    | { estado: "verificado" }
    | { estado: "incorrecto"; intentosRestantes: number }
    | { estado: "bloqueado" }
    | { estado: "expirado" }
    | { estado: "sin_codigo" };

type MotivoFalloCodigo = "incorrecto" | "expirado" | "bloqueado";

async function auditarFalloCodigo(
    params: { usuarioId: string; ip?: string },
    motivo: MotivoFalloCodigo,
    codigoStepUpId: string,
    intentos: number
): Promise<void> {
    await logAudit({
        accion: "STEP_UP_CODIGO_FALLIDO",
        tipoRecurso: "Usuario",
        recursoId: params.usuarioId,
        usuarioId: params.usuarioId,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        // Motivo y conteo, JAMÁS el código digitado.
        metadatos: { motivo, codigoStepUpId, intentos },
    });
}

/**
 * PASO 2 · El padre digita el código. Opera SIEMPRE sobre el código vigente
 * más reciente del usuario. La ruta emite el sello step-up solo con
 * `estado: "verificado"` — el servicio no conoce cookies (frontera DAL).
 */
export async function verificarCodigoStepUp(params: {
    usuarioId: string;
    codigo: string;
    ip?: string;
}): Promise<ResultadoVerificacionCodigo> {
    const ahora = new Date();
    const registro = await prisma.codigoStepUp.findFirst({
        where: { usuarioId: params.usuarioId, consumidoEn: null },
        orderBy: { creadoEn: "desc" },
    });
    if (!registro) return { estado: "sin_codigo" };

    if (registro.vigenteHasta.getTime() <= ahora.getTime()) {
        await auditarFalloCodigo(params, "expirado", registro.id, registro.intentos);
        return { estado: "expirado" };
    }

    if (registro.codigoHash !== hashCodigoStepUp(params.codigo)) {
        const intentos = registro.intentos + 1;
        if (intentos >= MAX_INTENTOS_CODIGO_STEPUP) {
            // Al 5º fallo el código MUERE (se consume): hay que pedir uno nuevo.
            await prisma.codigoStepUp.updateMany({
                where: { id: registro.id, consumidoEn: null },
                data: { intentos, consumidoEn: ahora },
            });
            await auditarFalloCodigo(params, "bloqueado", registro.id, intentos);
            return { estado: "bloqueado" };
        }
        await prisma.codigoStepUp.update({ where: { id: registro.id }, data: { intentos } });
        await auditarFalloCodigo(params, "incorrecto", registro.id, intentos);
        return { estado: "incorrecto", intentosRestantes: MAX_INTENTOS_CODIGO_STEPUP - intentos };
    }

    // Correcto: un solo uso. La condición `consumidoEn: null` hace que una
    // carrera de dos verificaciones paralelas solo la gane una.
    const consumido = await prisma.codigoStepUp.updateMany({
        where: { id: registro.id, consumidoEn: null },
        data: { consumidoEn: ahora },
    });
    if (consumido.count === 0) return { estado: "sin_codigo" };

    await logAudit({
        accion: "STEP_UP_CODIGO_VERIFICADO",
        tipoRecurso: "Usuario",
        recursoId: params.usuarioId,
        usuarioId: params.usuarioId,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        metadatos: { codigoHash: registro.codigoHash },
    });
    return { estado: "verificado" };
}
