/**
 * SPEC-775 · Fixture de PADRE ONBOARDEADO para e2e (Calidad).
 *
 * POR QUÉ POR ENDPOINTS (decisión CEO): el estado de sesión (consentimiento, vigencia,
 * camino) NO se lee de la BD en cada request — el middleware corre en Edge y no puede
 * consultar la base; el estado viaja en una COOKIE FIRMADA que un endpoint Node re-sella
 * cada ~5 min. Un fixture que siembra datos/hijo/suscripción por PRISMA DIRECTO cambia la
 * BD por debajo pero NO re-sella la cookie → la sesión sigue diciendo lo viejo (así el
 * `sembrarPadreConCaminoCompleto` anterior daba 403 al aceptar consentimiento: la sesión
 * no llevaba el rol titular). Este builder recorre el CAMINO REAL por endpoints, EN ORDEN,
 * así que cada paso re-sella la sesión como le pasa a un padre de verdad. El problema
 * desaparece por construcción.
 *
 * CONTRATO (las tres condiciones del CEO):
 *   1. VÁLIDO por defecto: `hasta: "completo"` deja el camino entero (permiso→datos→hijos→plan).
 *   2. Las VARIACIONES son PARÁMETROS (`hasta`), no estado armado a mano — y cada parada es
 *      un estado que el producto SÍ produce (un padre a mitad de camino).
 *   3. CERO estado imposible y CERO Prisma DIRECTO de estado: los pasos van por sus endpoints,
 *      en orden; solo el TOKEN de registro se crea por Prisma (simula «llegó el correo»,
 *      no hay Resend en test), y las lecturas/limpieza son por id.
 *
 * Solo para `tests/e2e/**`. La guardia SPEC-770 del globalSetup garantiza BD `*_test`.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

/** Hasta qué paso del camino avanzar. `completo` = plan (camino entero). */
export type HastaPasoPadre = "permiso" | "datos" | "hijos" | "completo";

export interface OpcionesPadreOnboarded {
    /** Contexto FRESCO del padre — su sesión (cookie firmada) persiste y se re-sella acá. */
    request: APIRequestContext;
    email: string;
    password: string;
    /** Documento único del padre (Paso 2). Si falta, se genera uno. */
    documentoNumero?: string;
    /** Hasta qué paso llevar el camino. Por defecto `completo`. */
    hasta?: HastaPasoPadre;
}

export interface PadreOnboarded {
    usuarioId: string;
    readonly _limpieza: { usuarios: string[]; tokens: string[] };
}

/**
 * Registra + onboardea un PADRE por sus endpoints reales, en orden:
 * registro → login → consentimiento (Paso 1) → datos (Paso 2) → hijo (Paso 3) →
 * freemium (Paso 4). Cada paso RE-SELLA la cookie de sesión.
 */
export async function crearPadreOnboarded(opts: OpcionesPadreOnboarded): Promise<PadreOnboarded> {
    const { request, email, password, hasta = "completo" } = opts;
    const documentoNumero = opts.documentoNumero ?? `1${(Date.now() % 1_000_000_000).toString().padStart(9, "0")}`;

    // (0) Registro. El TOKEN se crea por Prisma porque simula «llegó el correo con el enlace»
    // (Resend no corre en test); el ESTADO del camino NO — ese va por endpoints, abajo.
    const solicitar = await request.post("/api/auth/registro/solicitar", { data: { email } });
    expect(solicitar.status(), `solicitar padre body=${await solicitar.text().catch(() => "")}`).toBeLessThan(300);

    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol: "PARENT" as RolUsuario, expiraEn: new Date(Date.now() + 3_600_000) },
    });

    const completar = await request.post("/api/auth/registro/completar", {
        data: { token, password, passwordConfirmacion: password },
    });
    expect(completar.status(), `completar padre body=${await completar.text().catch(() => "")}`).toBe(201);

    const padre = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (!padre) throw new Error("[fixture] el completar no creó el Usuario padre");
    const ctx: PadreOnboarded = { usuarioId: padre.id, _limpieza: { usuarios: [padre.id], tokens: [registro.id] } };

    // Login: establece la sesión en `request` (cookie firmada con el rol PARENT).
    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.status(), `login padre body=${await login.text().catch(() => "")}`).toBe(200);

    // (1) Paso 1 · consentimiento (POLITICA_DATOS). Re-sella la sesión.
    const consent = await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
    expect(consent.status(), `consentimiento padre body=${await consent.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "permiso") return ctx;

    // (2) Paso 2 · datos personales (PATCH /api/padre/perfil, como el formulario real).
    // El Paso 2 EXIGE país + ciudad (CAMPOS_PERFIL_OBLIGATORIOS en camino/estado.ts):
    // sin ellos `derivarPasoPendiente` devuelve "datos" y el directorio/cita del padre
    // responde 403 aunque el freemium ya esté activo. Se LEEN del catálogo (lectura, no
    // estado armado a mano) y viajan por el MISMO PATCH del formulario real; se usa una
    // ciudad con su propio paisId para que el par sea coherente (como lo produce la UI).
    const ciudad = await prisma.ciudad.findFirst({ select: { id: true, paisId: true } });
    if (!ciudad) throw new Error("[fixture] la BD de prueba no tiene ninguna Ciudad sembrada");
    const datos = await request.patch("/api/padre/perfil", {
        data: {
            nombre: "Padre E2E",
            apellidos: "Prueba",
            documentoTipo: "CC",
            documentoNumero,
            telefono: "3001234567",
            paisId: ciudad.paisId,
            ciudadId: ciudad.id,
        },
    });
    expect(datos.status(), `datos padre body=${await datos.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "datos") return ctx;

    // (3) Paso 3 · un menor activo (POST /api/padre/hijos).
    const hijo = await request.post("/api/padre/hijos", { data: { nombre: "Menor E2E" } });
    expect(hijo.status(), `hijo padre body=${await hijo.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "hijos") return ctx;

    // (4) Paso 4 · plan freemium (POST /api/padre/suscripcion/activar-freemium) — estado producible,
    // NO una fila de facturación armada a mano.
    const freemium = await request.post("/api/padre/suscripcion/activar-freemium", { data: { aceptaTerminos: true } });
    expect(freemium.status(), `freemium padre body=${await freemium.text().catch(() => "")}`).toBeLessThan(300);

    return ctx;
}

/**
 * Borra lo creado, FK-safe: solicitudes → suscripción → hijos → auditoría → usuario
 * → token. Las solicitudes del padre (si el consumidor agendó una cita) se borran
 * acá por `padreUsuarioId`; el resto del árbol del profesional lo limpia su propio
 * fixture. Idempotente: cada `deleteMany` tolera que la fila ya no esté.
 */
export async function limpiarPadreOnboarded(padre: PadreOnboarded): Promise<void> {
    const ids = padre._limpieza.usuarios;
    if (ids.length > 0) {
        await prisma.solicitudCita.deleteMany({ where: { padreUsuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.suscripcion.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.hijo.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: ids } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
    if (padre._limpieza.tokens.length > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: padre._limpieza.tokens } } }).catch(() => undefined);
    }
}
