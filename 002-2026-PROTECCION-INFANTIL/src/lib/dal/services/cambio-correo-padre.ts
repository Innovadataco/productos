/**
 * SPEC-547 · cambio de correo del padre CON verificación del buzón nuevo.
 *
 * El correo es la identidad de ingreso: un typo deja al padre fuera de la cuenta
 * con la que protege a su hijo, y sin verificar el buzón una sesión robada se vuelve
 * secuestro de cuenta. Por eso el cambio solo se aplica DESPUÉS de validar un código
 * enviado AL CORREO NUEVO. Reusa el mecanismo de CodigoVerificacion (SPEC-053) en vez
 * de inventar uno.
 *
 * Reglas: unicidad del correo nuevo (no puede ser de nadie), el código va atado al
 * usuario que lo pidió (nadie confirma un código ajeno), y el cambio queda auditado.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { UsuarioRepository } from "../repositories/usuario";
import { CodigoVerificacionRepository } from "../repositories/codigo-verificacion";
import { enviarCodigoVerificacion } from "@/lib/email";
import { logAudit } from "@/lib/audit";

const EXPIRACION_CODIGO_MS = 15 * 60 * 1000;
const MAX_INTENTOS_CODIGO = 5;
const LIMITE_SOLICITUDES = 3;
const VENTANA_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizar(email: string): string {
    return email.trim().toLowerCase();
}
function generarCodigo(): string {
    return randomInt(100000, 1000000).toString();
}

export type ResultadoSolicitudCorreo =
    | { ok: true }
    | { ok: false; tipo: "invalido" | "mismo" | "en_uso" | "limite" };

export type ResultadoConfirmacionCorreo =
    | { ok: true; email: string }
    | { ok: false; tipo: "sin_codigo" | "expirado" | "max_intentos" | "incorrecto" | "en_uso" };

/** Paso 1: el padre pide cambiar a `nuevoEmailRaw`; se envía un código al buzón nuevo. */
export async function solicitarCambioCorreoPadre(
    usuarioId: string,
    nuevoEmailRaw: string
): Promise<ResultadoSolicitudCorreo> {
    const nuevoEmail = normalizar(nuevoEmailRaw);
    if (!EMAIL_RE.test(nuevoEmail)) return { ok: false, tipo: "invalido" };

    const usuarios = new UsuarioRepository();
    const codigos = new CodigoVerificacionRepository();

    const actual = await usuarios.findById(usuarioId);
    if (actual && normalizar(actual.email) === nuevoEmail) return { ok: false, tipo: "mismo" };

    // Unicidad: el correo nuevo no puede pertenecer a NADIE.
    if (await usuarios.findByEmail(nuevoEmail)) return { ok: false, tipo: "en_uso" };

    // Rate-limit por buzón destino (evita bombardear un correo ajeno con códigos).
    const recientes = await codigos.countRecientes(nuevoEmail, new Date(Date.now() - VENTANA_MS));
    if (recientes >= LIMITE_SOLICITUDES) return { ok: false, tipo: "limite" };

    const codigo = generarCodigo();
    const codigoHash = await bcrypt.hash(codigo, 12);
    await codigos.crear({
        email: nuevoEmail,
        codigoHash,
        expiraEn: new Date(Date.now() + EXPIRACION_CODIGO_MS),
        usuarioId, // atado al padre que lo pidió: nadie más puede confirmarlo
    });
    await enviarCodigoVerificacion(nuevoEmail, codigo);
    return { ok: true };
}

/** Paso 2: el padre confirma con el código del buzón nuevo; recién ahí se cambia. */
export async function confirmarCambioCorreoPadre(
    usuarioId: string,
    nuevoEmailRaw: string,
    codigo: string,
    request?: Request
): Promise<ResultadoConfirmacionCorreo> {
    const nuevoEmail = normalizar(nuevoEmailRaw);
    const codigos = new CodigoVerificacionRepository();
    const usuarios = new UsuarioRepository();

    const registro = await codigos.findUltimoNoUsado(nuevoEmail);
    // Debe existir Y estar atado a ESTE padre: no se confirma un código ajeno.
    if (!registro || registro.usuarioId !== usuarioId) return { ok: false, tipo: "sin_codigo" };
    if (new Date() > registro.expiraEn) return { ok: false, tipo: "expirado" };
    if (registro.intentosFallidos >= MAX_INTENTOS_CODIGO) return { ok: false, tipo: "max_intentos" };

    const valido = await bcrypt.compare(codigo, registro.codigoHash);
    if (!valido) {
        await codigos.incrementarIntentos(registro.id);
        return { ok: false, tipo: "incorrecto" };
    }

    // Re-chequear unicidad al aplicar (por si otro tomó el correo en el intervalo).
    const enUso = await usuarios.findByEmail(nuevoEmail);
    if (enUso && enUso.id !== usuarioId) return { ok: false, tipo: "en_uso" };

    return prisma.$transaction(async (tx) => {
        const u = new UsuarioRepository(tx);
        const c = new CodigoVerificacionRepository(tx);
        const previo = await u.findById(usuarioId);
        await u.actualizar(usuarioId, { email: nuevoEmail });
        await c.marcarUsado(registro.id);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: usuarioId,
            usuarioId,
            valorAnterior: JSON.stringify({ email: previo?.email ?? null }),
            valorNuevo: JSON.stringify({ email: nuevoEmail }),
            ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
            userAgent: request?.headers.get("user-agent") || "unknown",
            tx,
        });
        return { ok: true, email: nuevoEmail };
    });
}
