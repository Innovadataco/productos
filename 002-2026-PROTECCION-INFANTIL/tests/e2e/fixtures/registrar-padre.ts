/**
 * SPEC-809 (Calidad) · Helper FINO de registro de PADRE por el flujo de ENLACE.
 *
 * POR QUÉ EXISTE: el arnés registraba al padre por el flujo de CÓDIGO del colegio
 * (`/api/auth/verificar/*`) y leía `devCode` de la respuesta. Ese `devCode` solo
 * aparece en NO-producción Y SOLO cuando el correo FALLA al salir
 * (`verificar/solicitar/route.ts:96-97`). O sea: ese helper solo podía andar mientras
 * el mailer estuviera roto — su verde medía una falla, no el registro. El padre, desde
 * SPEC-339 (A-67 §2.1), se registra por ENLACE, no por código.
 *
 * QUÉ HACE (SIN apoyarse NUNCA en un camino de error):
 *   1. POST /api/auth/registro/solicitar {email} → 202. Anti-enumeración (SPEC-338):
 *      la respuesta NO trae el token; por eso NO se lee de ahí.
 *   2. El token se PLANTA por Prisma (`tokenRegistro`) — puerta SOLO de pruebas que
 *      simula «llegó el correo»; el valor en claro lo conoce el arnés porque lo generó
 *      (de la base solo sale el hash). NUNCA se agrega un endpoint/flag/campo de producto
 *      que devuelva el token: eso es exactamente lo que SPEC-338 existe para impedir.
 *   3. POST /api/auth/registro/completar {token, password} → 201.
 *   4. (opcional) login — deja la sesión del `request` autenticada como PARENT.
 *
 * FINO a propósito (decisión CEO, SPEC-809): NO es `crearPadreOnboarded`. Un test que
 * necesita una CUENTA no debe acoplarse a la cadena de onboarding (consentimiento → datos
 * → hijo → freemium): un cambio en freemium no puede poner rojo un test de reset. Para una
 * FAMILIA completa, `crearPadreOnboarded` sigue donde está.
 *
 * `password` es un valor de PRUEBA que pasa el llamador (como en los demás fixtures); nunca
 * una credencial real. Solo para `tests/e2e/**`. La guardia SPEC-770 garantiza BD `*_test`.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";
import type { RolUsuario } from "@prisma/client";

export interface PadreRegistrado {
    usuarioId: string;
    email: string;
    readonly _limpieza: { usuarios: string[]; tokensRegistro: string[]; tokensRecuperacion: string[] };
}

export interface OpcionesRegistrarPadre {
    /** Contexto cuya sesión se usa/sella. Para un test de `page`, pasá `page.request`. */
    request: APIRequestContext;
    email: string;
    /** Valor de PRUEBA que elige el llamador (nunca una credencial real). */
    password: string;
    /** Dejar la sesión autenticada tras completar. Por defecto `true`. */
    login?: boolean;
}

/**
 * Planta un token de registro VÁLIDO por Prisma (puerta SOLO de pruebas que simula «llegó el correo»):
 * genera el valor EN CLARO, guarda solo el hash y crea la fila `tokenRegistro`. Devuelve el claro — para
 * `registro/completar` (helper de abajo) o para abrir `/registro/crear-clave/[token]` por la UI SIN
 * consumirlo acá — y el id de la fila para la limpieza. NUNCA se agrega un endpoint/flag/campo de
 * producto que devuelva el token: eso es exactamente lo que SPEC-338 existe para impedir.
 */
export async function plantarTokenRegistro(
    email: string,
    rol: RolUsuario = "PARENT" as RolUsuario,
): Promise<{ token: string; registroId: string }> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    return { token, registroId: registro.id };
}

/**
 * Registra un PADRE por el flujo de ENLACE y (por defecto) lo deja logueado. Devuelve el id,
 * el email y el rastro para la limpieza FK-safe.
 */
export async function registrarPadre(opts: OpcionesRegistrarPadre): Promise<PadreRegistrado> {
    const { request, email, password, login = true } = opts;

    // (0) Solicitar el enlace. Anti-enum: 202 y SIN token en la respuesta (no se lee de ahí).
    const solicitar = await request.post("/api/auth/registro/solicitar", { data: { email } });
    expect(solicitar.status(), `solicitar padre body=${await solicitar.text().catch(() => "")}`).toBe(202);

    // (1) Token PLANTADO por Prisma (puerta solo-pruebas; simula «llegó el correo»). Fuente única con la
    //     UI de crear-clave (DRY): el mismo plantado que consume `/registro/crear-clave/[token]`.
    const { token, registroId } = await plantarTokenRegistro(email);

    // (2) Completar con el token plantado + la contraseña de prueba.
    const completar = await request.post("/api/auth/registro/completar", {
        data: { token, password, passwordConfirmacion: password },
    });
    expect(completar.status(), `completar padre body=${await completar.text().catch(() => "")}`).toBe(201);

    const padre = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (!padre) throw new Error("[registrarPadre] el completar no creó el Usuario padre");

    // (3) Login opcional: deja la sesión del `request` como PARENT (reportes autenticado lo necesita).
    if (login) {
        const res = await request.post("/api/auth/login", { data: { email, password } });
        expect(res.status(), `login padre body=${await res.text().catch(() => "")}`).toBe(200);
    }

    return { usuarioId: padre.id, email, _limpieza: { usuarios: [padre.id], tokensRegistro: [registroId], tokensRecuperacion: [] } };
}

/**
 * Planta un token de recuperación VÁLIDO por Prisma (misma puerta solo-pruebas) para ejercitar el
 * recorrido de reset SIN depender de `devToken` (que, como `devCode`, solo llega si el correo FALLA).
 * Devuelve el valor en claro (64 hex, como `generarTokenRecuperacion`) para abrir `/recuperar/[token]`.
 * Registra el id del token en el rastro del padre para la limpieza.
 */
export async function plantarTokenRecuperacion(padre: PadreRegistrado): Promise<string> {
    const token = generarTokenRecuperacion();
    const tokenHash = await hashToken(token);
    const fila = await prisma.tokenRecuperacion.create({
        data: { email: padre.email, usuarioId: padre.usuarioId, tokenHash, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    padre._limpieza.tokensRecuperacion.push(fila.id);
    return token;
}

/** Limpieza FK-safe: solicitudes/suscripción/hijos/auditoría → usuario → tokens (registro + recuperación). */
export async function limpiarPadre(padre: PadreRegistrado): Promise<void> {
    const ids = padre._limpieza.usuarios;
    if (ids.length > 0) {
        await prisma.solicitudCita.deleteMany({ where: { padreUsuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.suscripcion.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.hijo.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
    }
    if (padre._limpieza.tokensRecuperacion.length > 0) {
        await prisma.tokenRecuperacion.deleteMany({ where: { id: { in: padre._limpieza.tokensRecuperacion } } }).catch(() => undefined);
    }
    if (ids.length > 0) {
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
    if (padre._limpieza.tokensRegistro.length > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: padre._limpieza.tokensRegistro } } }).catch(() => undefined);
    }
}
