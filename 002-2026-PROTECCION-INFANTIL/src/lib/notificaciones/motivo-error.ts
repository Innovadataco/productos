/**
 * SPEC-401 (I-283): resumir y sanitizar el error del proveedor de correo para
 * persistirlo en `Notificacion.ultimoError`.
 *
 * Reemplaza el texto genérico "Error al enviar notificación por email" por un
 * resumen `[<name>][<statusCode>] <mensaje sanitizado>`. Diagnóstico de un
 * minuto en lugar de una madrugada.
 *
 * Reglas duras:
 *  1. Ninguna PII sale a la BD: correos del destinatario van hasheados y los
 *     tokens conocidos del proveedor (re_, sk_, pk_, whsec_, Bearer) se
 *     redactan.
 *  2. Helper puro y determinístico — sin `Date.now()`, sin red, sin BD. Todo
 *     se prueba unit con vectores fijos.
 *  3. El formato preserva las palabras que ya vigila `senalCorreosFallidos`
 *     ("quota", "429", "rate limit") — el statusCode va en el prefijo y el
 *     mensaje original se concatena tal cual (solo sanitizado).
 */
import { createHash } from "node:crypto";

const HASH_SALT = process.env.PII_HASH_SALT ?? "pi-notificaciones-motivo-error-v1";
// Cabe cómodo en la columna `ultimoError String?` (Postgres text) y evita que
// un proveedor verborrágico llene la fila con un stacktrace.
const LIMITE_MENSAJE = 500;

export interface ResumenErrorProveedor {
    /** Nombre del error del proveedor (p.ej. "rate_limit_exceeded"). */
    name: string;
    /** Mensaje humano SANITIZADO — ya sin PII ni tokens. */
    message: string;
    /** Código HTTP del proveedor si viene (Resend lo expone en `.statusCode`). */
    statusCode?: number;
    /** Código de error semántico del proveedor si viene (raro en Resend, común en otros). */
    codigo?: string;
}

/**
 * Error dedicado del envío por proveedor. Extiende `Error` (no `AppError`) porque
 * el consumidor primario es el `catch` de `procesar-lote`, que solo mira `.message`.
 * Espeja el patrón de `WebhookResendError` en `webhook-resend.ts:47`.
 */
export class EmailProveedorError extends Error {
    constructor(public readonly resumen: ResumenErrorProveedor) {
        super(serializarMotivoParaPersistencia(resumen));
        this.name = "EmailProveedorError";
    }
}

const RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
// Tokens con prefijo conocido: proveedor, secretos, bearer. Comparten longitud
// mínima 8 para evitar borrar sufijos accidentales de otras cosas.
const RE_TOKEN = /\b(?:re|sk|pk|whsec)_[A-Za-z0-9_\-]{8,}\b/g;
const RE_BEARER = /\bBearer\s+[A-Za-z0-9._\-]{8,}/gi;

/**
 * Sanitiza PII en el mensaje del proveedor.
 *
 * - Emails → `<email:HHHHHHHH>` con HMAC-like hash truncado (SHA-256 con
 *   salt). Mismo destinatario → mismo hash: se puede correlar "todos los
 *   fallos son al mismo buzón" sin exponer la dirección.
 * - Tokens con prefijos conocidos → `<token:re>`, `<token:bearer>`, etc.
 */
export function sanitizarPII(texto: string): string {
    if (!texto) return texto;
    return texto
        .replace(RE_EMAIL, (email) => `<email:${hashPii(email)}>`)
        .replace(RE_TOKEN, (tok) => {
            const prefijo = tok.slice(0, tok.indexOf("_"));
            return `<token:${prefijo}>`;
        })
        .replace(RE_BEARER, "<token:bearer>");
}

function hashPii(valor: string): string {
    // No es HMAC porque no necesitamos autenticación — solo correlación
    // resistente a diccionarios. SHA-256 con salt de módulo alcanza y evita
    // depender de otros módulos del proyecto.
    return createHash("sha256").update(`${HASH_SALT}:${valor.toLowerCase()}`).digest("hex").slice(0, 8);
}

interface ErrorConCampos {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
    code?: unknown;
}

/**
 * Extrae `{name, message, statusCode?, codigo?}` de cualquier forma de error.
 *
 * Casos que cubre:
 *  - Forma del SDK de Resend (`result.error`): `{name, message, statusCode?}`.
 *  - `Error` nativo: usa `.name` y `.message`.
 *  - String: usa como mensaje, name = "Error".
 *  - `null` / `undefined`: name = "UnknownError", mensaje "sin detalle".
 *  - Objeto plano con `.code` (algunos SDKs): lo pasa a `codigo`.
 */
export function resumirErrorProveedor(err: unknown): ResumenErrorProveedor {
    if (err === null || err === undefined) {
        return { name: "UnknownError", message: "sin detalle del proveedor" };
    }
    if (typeof err === "string") {
        return { name: "Error", message: recortar(sanitizarPII(err)) };
    }
    if (typeof err !== "object") {
        return { name: "UnknownError", message: recortar(sanitizarPII(String(err))) };
    }

    const e = err as ErrorConCampos;
    const nameCrudo = typeof e.name === "string" && e.name.length > 0 ? e.name : "Error";
    const messageCrudo = typeof e.message === "string" ? e.message : "sin detalle del proveedor";
    const statusCode = typeof e.statusCode === "number" && Number.isFinite(e.statusCode) ? e.statusCode : undefined;
    const codigo = typeof e.code === "string" && e.code.length > 0 ? e.code : undefined;

    const resumen: ResumenErrorProveedor = {
        name: sanitizarNombre(nameCrudo),
        message: recortar(sanitizarPII(messageCrudo)),
    };
    if (statusCode !== undefined) resumen.statusCode = statusCode;
    if (codigo !== undefined) resumen.codigo = codigo;
    return resumen;
}

function sanitizarNombre(nombre: string): string {
    // El nombre va en un bracket `[...]`; evitamos meter caracteres que rompan
    // parseos aguas abajo o dejen inyectar corchetes falsos en logs.
    return nombre.replace(/[\[\]\n\r\t]+/g, "_").slice(0, 60);
}

function recortar(texto: string): string {
    if (texto.length <= LIMITE_MENSAJE) return texto;
    return `${texto.slice(0, LIMITE_MENSAJE - 3)}...`;
}

/**
 * Formato canónico para `Notificacion.ultimoError`:
 *   `[<name>]` — siempre.
 *   `[<statusCode>]` — si viene.
 *   `[cod:<codigo>]` — si viene.
 *   ` <mensaje sanitizado>` — al final, tal cual habla el proveedor.
 *
 * El regex `PATRON_CUOTA` de `senalCorreosFallidos` sigue casando porque
 * "429" queda en el bracket y el texto del mensaje original está intacto
 * (solo sanitizado).
 */
export function serializarMotivoParaPersistencia(r: ResumenErrorProveedor): string {
    const brackets: string[] = [`[${r.name}]`];
    if (r.statusCode !== undefined) brackets.push(`[${r.statusCode}]`);
    if (r.codigo !== undefined) brackets.push(`[cod:${sanitizarNombre(r.codigo)}]`);
    return `${brackets.join("")} ${r.message}`.trim();
}
