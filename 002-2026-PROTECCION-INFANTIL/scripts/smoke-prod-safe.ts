/**
 * Smoke PROD-SAFE por rol (SPEC-118 / cola nocturna 002-PI-041, bloque B8).
 *
 * A diferencia de la suite E2E (src/lib/e2e/), este runner NUNCA ejecuta
 * resetDatabase ni ningún borrado masivo: solo crea cuentas efímeras propias,
 * hace chequeos HTTP de solo lectura y borra EXACTAMENTE las filas que creó
 * (por ID explícito), incluso si falla (try/finally).
 *
 * Por cada rol comprueba el ciclo de sesión completo vía HTTP:
 *   login 200 → endpoint principal del rol 200 → logout 200 con Set-Cookie de
 *   borrado (Path=/, Max-Age=0, Secure en la cookie __Host-) → endpoint 401 sin cookie.
 *
 * Garantías (REGLA DURA del bloque):
 *   - Cero escrituras fuera de sus cuentas efímeras (emails smoke-<ts>-*@test.invalid).
 *   - Sin escrituras de negocio: NO crea reportes (ver "Limitación" abajo).
 *   - Sin secretos en logs: nunca imprime contraseñas, tokens ni valores de cookies.
 *   - Borrado FK-seguro: RateLimit propio → PerfilOperador → Usuario → Colegio → Tenant
 *     (→ Ciudad/Pais solo si los tuvo que crear porque el entorno no tenía).
 *
 * Limitación documentada: el reporte de prueba del padre se OMITE a propósito.
 * Crear un reporte encola un job pg-boss que el worker de producción procesaría
 * (embedding, clasificación, filas de pipeline) y borrarlo FK-completo mientras
 * el worker puede estar procesándolo es una carrera: no se puede garantizar
 * "nada residual / nada destructivo". El smoke queda en solo lectura + sesión.
 *
 * Uso:
 *   node --env-file=<env> --import tsx scripts/smoke-prod-safe.ts [opciones]
 *
 * Opciones:
 *   --dry-run          Imprime el plan sin tocar BD ni red.
 *   --db-only          Solo ciclo de cuentas (crea, verifica y borra; sin HTTP).
 *   --base-url <url>   URL base (también SMOKE_BASE_URL; default NEXT_PUBLIC_APP_URL
 *                      o http://localhost:5005).
 *   --confirm-prod     Obligatorio si la URL base NO es loopback (protección contra
 *                      ejecuciones accidentales contra producción).
 *   --help             Muestra ayuda.
 *
 * Requiere en el entorno (vía --env-file): DATABASE_URL de la BD del entorno objetivo
 * (la misma que usa la app contra la que se ejecuta). Efectos residuales conocidos y
 * aceptados: contadores de ventana de RateLimit por IP (login), compartidos con el
 * tráfico real y efímeros por ventana; NO se borran por ser infraestructura compartida.
 *
 * Códigos de salida: 0 = todo PASS · 1 = algún chequeo FAIL · 2 = error de uso/guarda.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";
// SPEC-442 (I-307): TODO camino que crea `Colegio` en prod pasa por el helper.
// El smoke crea colegios efímeros y los borra al final, pero si el proceso se
// interrumpe entre create y delete, quedaba huérfano y SIN cursos — mismo bug
// que dejó a «sagrado corazon» trabado en el paso 4. Ahora nunca queda huérfano
// sin semilla.
import { sembrarSemillaColegio } from "@/lib/colegio/semilla-colegio";

const DOMINIO_SMOKE = "@test.invalid";
const PREFIJO_SMOKE = "smoke-";
const TIMEOUT_HTTP_MS = 15_000;

interface PlanRol {
    rol: RolUsuario;
    etiqueta: string;
    endpoint: string;
}

// Acción principal por rol (todas GET de solo lectura):
const PLAN_ROLES: PlanRol[] = [
    { rol: "PARENT", etiqueta: "padre", endpoint: "/api/reportes/mis-reportes" },
    { rol: "SCHOOL_ADMIN", etiqueta: "colegio", endpoint: "/api/colegio/estadisticas" },
    { rol: "ADMIN", etiqueta: "admin", endpoint: "/api/admin/estadisticas" },
    { rol: "OPERADOR", etiqueta: "operador", endpoint: "/api/admin/reportes-revision" },
    { rol: "COMITE_VALIDACION", etiqueta: "comité", endpoint: "/api/admin/comite/pendientes" },
];

/** Etiqueta segura para email (ASCII, sin tildes). */
function etiquetaEmail(plan: PlanRol): string {
    return plan.etiqueta.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface CuentasEfimeras {
    ts: number;
    password: string;
    usuarios: Map<RolUsuario, { id: string; email: string }>;
    tenantId: string | null;
    colegioId: string | null;
    paisIdCreado: string | null;
    ciudadIdCreada: string | null;
}

interface Opciones {
    dryRun: boolean;
    dbOnly: boolean;
    confirmProd: boolean;
    baseUrl: string;
    help: boolean;
}

// ---------------------------------------------------------------- utilidades

function parsearOpciones(argv: string[]): Opciones {
    const opts: Opciones = {
        dryRun: false,
        dbOnly: false,
        confirmProd: false,
        baseUrl:
            process.env.SMOKE_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:5005",
        help: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--dry-run") opts.dryRun = true;
        else if (arg === "--db-only") opts.dbOnly = true;
        else if (arg === "--confirm-prod") opts.confirmProd = true;
        else if (arg === "--help" || arg === "-h") opts.help = true;
        else if (arg === "--base-url") {
            const valor = argv[++i];
            if (!valor) throw new Error("--base-url requiere un valor");
            opts.baseUrl = valor;
        } else if (arg.startsWith("--base-url=")) {
            opts.baseUrl = arg.slice("--base-url=".length);
        } else {
            throw new Error(`Opción desconocida: ${arg} (usa --help)`);
        }
    }
    if (process.env.SMOKE_CONFIRM_PROD === "1") opts.confirmProd = true;
    opts.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    return opts;
}

function esLoopback(baseUrl: string): boolean {
    try {
        const host = new URL(baseUrl).hostname.toLowerCase();
        return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
    } catch {
        return false;
    }
}

/** Muestra host:puerto/bd de DATABASE_URL sin credenciales (nunca el valor completo). */
function describirDatabaseUrl(): string {
    const cruda = process.env.DATABASE_URL;
    if (!cruda) return "(DATABASE_URL no definida)";
    try {
        const url = new URL(cruda);
        return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
    } catch {
        return "(DATABASE_URL no parseable; valor oculto)";
    }
}

function obtenerSetCookies(headers: Headers): string[] {
    const conGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
    if (typeof conGetSetCookie.getSetCookie === "function") {
        return conGetSetCookie.getSetCookie();
    }
    const combinado = headers.get("set-cookie");
    return combinado ? [combinado] : [];
}

/** Extrae `nombre=valor` de la cookie de sesión (sin loguear el valor). */
function extraerCookieSesion(setCookies: string[]): string | null {
    let legacy: string | null = null;
    for (const sc of setCookies) {
        const par = sc.split(";")[0] ?? "";
        const idx = par.indexOf("=");
        if (idx <= 0) continue;
        const nombre = par.slice(0, idx).trim();
        const valor = par.slice(idx + 1).trim();
        if (!valor) continue;
        if (nombre === "__Host-token") return `${nombre}=${valor}`;
        if (nombre === "token") legacy = `${nombre}=${valor}`;
    }
    return legacy;
}

async function fetchHttp(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_HTTP_MS) });
}

// ------------------------------------------------------- cuentas efímeras (BD)

async function crearCuentasEfimeras(): Promise<CuentasEfimeras> {
    const ts = Date.now();
    // Contraseña aleatoria por corrida; nunca se imprime.
    const password = crypto.randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);

    // Pais/Ciudad: se REUTILIZAN filas existentes (solo lectura). Solo si el entorno
    // no tiene ninguna (p.ej. una BD de test vacía) se crean propias y se borran luego.
    let paisIdCreado: string | null = null;
    let ciudadIdCreada: string | null = null;
    let pais = await prisma.pais.findFirst({ where: { codigo: "CO" } });
    pais ??= await prisma.pais.findFirst();
    if (!pais) {
        pais = await prisma.pais.create({
            data: { codigo: `SMK${ts}`, nombre: `Smoke Pais ${ts}`, esActivo: true },
        });
        paisIdCreado = pais.id;
    }
    let ciudad = await prisma.ciudad.findFirst({ where: { paisId: pais.id } });
    if (!ciudad) {
        ciudad = await prisma.ciudad.create({
            data: { nombre: `Smoke Ciudad ${ts}`, paisId: pais.id },
        });
        ciudadIdCreada = ciudad.id;
    }

    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 1);
    const fin = new Date(hoy);
    fin.setFullYear(fin.getFullYear() + 1);

    const tenant = await prisma.tenant.create({
        data: { nombre: `smoke-${ts}`, estado: "activo" },
    });
    const colegio = await prisma.colegio.create({
        data: {
            nombre: `Smoke Colegio ${ts}`,
            nit: `SMK-NIT-${ts}`, // SPEC-320 (§2.2-bis)
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Smoke Representante",
            representanteLegalIdentificacion: `SMK-${ts}`,
            representanteLegalEmail: `smoke-${ts}-rep${DOMINIO_SMOKE}`,
            inicioServicio: inicio,
            finServicio: fin,
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
    });
    // SPEC-442: semilla obligatoria (materias + cursos + onboarding). Sin
    // esto, un smoke interrumpido deja un colegio huérfano SIN cursos en
    // producción — mismo bug I-307.
    await sembrarSemillaColegio(colegio.id, prisma);

    const usuarios = new Map<RolUsuario, { id: string; email: string }>();
    for (const plan of PLAN_ROLES) {
        const email = `${PREFIJO_SMOKE}${ts}-${etiquetaEmail(plan)}${DOMINIO_SMOKE}`;
        const usuario = await prisma.usuario.create({
            data: {
                email,
                nombre: `Smoke ${plan.etiqueta}`,
                passwordHash,
                rol: plan.rol,
                estado: "activo",
                ...(plan.rol === "SCHOOL_ADMIN" ? { tenantId: tenant.id, colegioId: colegio.id } : {}),
            },
        });
        usuarios.set(plan.rol, { id: usuario.id, email });
    }

    // PerfilOperador para operador y comité (patrón del alta real por admin);
    // creadoPorId apunta al admin efímero y se borra ANTES que los usuarios.
    const admin = usuarios.get("ADMIN");
    const operador = usuarios.get("OPERADOR");
    const comite = usuarios.get("COMITE_VALIDACION");
    if (!admin || !operador || !comite) throw new Error("Faltan usuarios efímeros recién creados");
    await prisma.perfilOperador.create({
        data: { usuarioId: operador.id, creadoPorId: admin.id, esComite: false },
    });
    await prisma.perfilOperador.create({
        data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
    });

    return {
        ts,
        password,
        usuarios,
        tenantId: tenant.id,
        colegioId: colegio.id,
        paisIdCreado,
        ciudadIdCreada,
    };
}

/** Borra SOLO las filas propias, por ID, en orden FK-seguro. Idempotente (deleteMany). */
async function borrarCuentasEfimeras(c: CuentasEfimeras): Promise<void> {
    const usuarioIds = [...c.usuarios.values()].map((u) => u.id);
    // Contadores admin_read generados por nuestros GET (identifier = usuario efímero).
    await prisma.rateLimit.deleteMany({ where: { identifier: { in: usuarioIds } } });
    await prisma.perfilOperador.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    // SPEC-442: `sembrarSemillaColegio` deja cursos + materias + onboarding
    // — hay que borrarlos antes del `Colegio` para no violar FKs.
    if (c.colegioId) {
        await prisma.cursoMateria.deleteMany({ where: { colegioId: c.colegioId } });
        await prisma.curso.deleteMany({ where: { colegioId: c.colegioId } });
        await prisma.materia.deleteMany({ where: { colegioId: c.colegioId } });
        await prisma.onboardingColegio.deleteMany({ where: { colegioId: c.colegioId } });
        await prisma.colegio.deleteMany({ where: { id: c.colegioId } });
    }
    if (c.tenantId) await prisma.tenant.deleteMany({ where: { id: c.tenantId } });
    if (c.ciudadIdCreada) await prisma.ciudad.deleteMany({ where: { id: c.ciudadIdCreada } });
    if (c.paisIdCreado) await prisma.pais.deleteMany({ where: { id: c.paisIdCreado } });
}

/** Verifica que no quede NADA de esta corrida. Devuelve cuántas filas propias quedan. */
async function contarResiduosPropios(c: CuentasEfimeras): Promise<number> {
    const usuarioIds = [...c.usuarios.values()].map((u) => u.id);
    const [usuarios, perfiles, colegios, tenants, ciudades, paises, rateLimits] = await Promise.all([
        prisma.usuario.count({ where: { id: { in: usuarioIds } } }),
        prisma.perfilOperador.count({ where: { usuarioId: { in: usuarioIds } } }),
        c.colegioId ? prisma.colegio.count({ where: { id: c.colegioId } }) : 0,
        c.tenantId ? prisma.tenant.count({ where: { id: c.tenantId } }) : 0,
        c.ciudadIdCreada ? prisma.ciudad.count({ where: { id: c.ciudadIdCreada } }) : 0,
        c.paisIdCreado ? prisma.pais.count({ where: { id: c.paisIdCreado } }) : 0,
        prisma.rateLimit.count({ where: { identifier: { in: usuarioIds } } }),
    ]);
    return usuarios + perfiles + colegios + tenants + ciudades + paises + rateLimits;
}

// ------------------------------------------------------------------ chequeos

interface ResultadoPaso {
    paso: string;
    ok: boolean;
    detalle: string;
}

async function chequearRol(
    baseUrl: string,
    plan: PlanRol,
    email: string,
    password: string
): Promise<ResultadoPaso[]> {
    const pasos: ResultadoPaso[] = [];

    // 1) Login real vía HTTP
    let cookie: string | null = null;
    try {
        const res = await fetchHttp(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const cuerpo = (await res.json().catch(() => null)) as { user?: { rol?: string } } | null;
        const rolOk = cuerpo?.user?.rol === plan.rol;
        cookie = extraerCookieSesion(obtenerSetCookies(res.headers));
        pasos.push({
            paso: "login",
            ok: res.status === 200 && rolOk && cookie !== null,
            detalle: `HTTP ${res.status}, rol=${cuerpo?.user?.rol ?? "?"}, cookie=${cookie ? "sí" : "no"}`,
        });
    } catch (error) {
        pasos.push({ paso: "login", ok: false, detalle: `error de red: ${(error as Error).message}` });
    }
    if (!cookie) {
        pasos.push({ paso: "endpoint", ok: false, detalle: "omitido (sin cookie de sesión)" });
        pasos.push({ paso: "logout", ok: false, detalle: "omitido (sin cookie de sesión)" });
        pasos.push({ paso: "401-post-logout", ok: false, detalle: "omitido (sin sesión)" });
        return pasos;
    }

    // 2) Endpoint principal del rol, con cookie
    try {
        const res = await fetchHttp(`${baseUrl}${plan.endpoint}`, { headers: { cookie } });
        pasos.push({
            paso: "endpoint",
            ok: res.status === 200,
            detalle: `GET ${plan.endpoint} → HTTP ${res.status}`,
        });
        await res.arrayBuffer().catch(() => undefined); // drenar cuerpo
    } catch (error) {
        pasos.push({ paso: "endpoint", ok: false, detalle: `error de red: ${(error as Error).message}` });
    }

    // 3) Logout real y validación del Set-Cookie de borrado
    try {
        const res = await fetchHttp(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            headers: { cookie },
        });
        const borradas = obtenerSetCookies(res.headers).filter((sc) => /^(?:__Host-token|token)=/.test(sc));
        const todasConPathYMaxAge0 =
            borradas.length > 0 && borradas.every((sc) => /Path=\//i.test(sc) && /Max-Age=0(?:\b|;)/i.test(sc));
        const algunaSecure = borradas.some((sc) => /(?:^|;\s*)Secure(?:;|$)/i.test(sc));
        pasos.push({
            paso: "logout",
            ok: res.status === 200 && todasConPathYMaxAge0 && algunaSecure,
            detalle: `HTTP ${res.status}, cookies borradas=${borradas.length}, Path=/ y Max-Age=0=${todasConPathYMaxAge0 ? "sí" : "no"}, Secure=${algunaSecure ? "sí" : "no"}`,
        });
        await res.arrayBuffer().catch(() => undefined);
    } catch (error) {
        pasos.push({ paso: "logout", ok: false, detalle: `error de red: ${(error as Error).message}` });
    }

    // 4) El endpoint privado debe dar 401 una vez cerrada la sesión (sin cookie)
    try {
        const res = await fetchHttp(`${baseUrl}${plan.endpoint}`);
        pasos.push({
            paso: "401-post-logout",
            ok: res.status === 401,
            detalle: `GET ${plan.endpoint} sin cookie → HTTP ${res.status}`,
        });
        await res.arrayBuffer().catch(() => undefined);
    } catch (error) {
        pasos.push({ paso: "401-post-logout", ok: false, detalle: `error de red: ${(error as Error).message}` });
    }

    return pasos;
}

// --------------------------------------------------------------------- plan

function imprimirPlan(opts: Opciones): void {
    const ts = "<ts>";
    console.log("SMOKE PROD-SAFE — PLAN (dry-run, sin tocar BD ni red)\n");
    console.log(`URL base:            ${opts.baseUrl}`);
    console.log(`BD (sin credenciales): ${describirDatabaseUrl()}`);
    console.log(`Guarda no-loopback:  ${esLoopback(opts.baseUrl) ? "no aplica (loopback)" : opts.confirmProd ? "confirmada (--confirm-prod)" : "PENDIENTE: exige --confirm-prod"}`);
    console.log("\nCuentas efímeras que crearía (y borraría al terminar, incluso si falla):");
    for (const plan of PLAN_ROLES) {
        const extra = plan.rol === "SCHOOL_ADMIN" ? " + Tenant + Colegio efímeros" : plan.rol === "OPERADOR" || plan.rol === "COMITE_VALIDACION" ? " + PerfilOperador" : "";
        console.log(`  - ${PREFIJO_SMOKE}${ts}-${etiquetaEmail(plan)}${DOMINIO_SMOKE}  (${plan.rol})${extra}`);
    }
    console.log("  Pais/Ciudad: reutiliza existentes (solo lectura); los crea SOLO si el entorno no tiene, y los borra.");
    console.log("\nChequeos por rol (HTTP, todo GET de solo lectura salvo login/logout):");
    for (const plan of PLAN_ROLES) {
        console.log(`  ${plan.etiqueta.padEnd(9)}: POST /api/auth/login (200) → GET ${plan.endpoint} (200) → POST /api/auth/logout (200, Set-Cookie Path=/ Max-Age=0 Secure) → GET ${plan.endpoint} (401)`);
    }
    console.log("\nGarantías:");
    console.log("  - NUNCA resetDatabase ni borrados masivos; solo filas propias, por ID.");
    console.log("  - Sin escrituras de negocio (NO crea reportes): ver limitación en la cabecera del script.");
    console.log("  - Sin secretos en logs (contraseña aleatoria por corrida, nunca impresa; cookies/tokens nunca impresos).");
    console.log("  - Borrado FK-seguro: RateLimit propio → PerfilOperador → Usuario → Colegio → Tenant (→ Ciudad/Pais propios).");
    console.log("\nSalida: tabla PASS/FAIL por rol; exit 0 todo verde, 1 algún fallo, 2 error de uso/guarda.");
}

function imprimirAyuda(): void {
    console.log(`Uso: node --env-file=<env> --import tsx scripts/smoke-prod-safe.ts [opciones]

Opciones:
  --dry-run        Imprime el plan sin tocar BD ni red
  --db-only        Solo ciclo de cuentas efímeras en BD (crear/verificar/borrar)
  --base-url <url> URL base de la app (o SMOKE_BASE_URL; default NEXT_PUBLIC_APP_URL o http://localhost:5005)
  --confirm-prod   Requerido si la URL base no es loopback
  --help           Esta ayuda

Requiere DATABASE_URL (misma BD que usa la app objetivo). Ver cabecera del script.`);
}

// --------------------------------------------------------------------- main

async function main(): Promise<number> {
    let opts: Opciones;
    try {
        opts = parsearOpciones(process.argv.slice(2));
    } catch (error) {
        console.error(`[Smoke] ${(error as Error).message}`);
        return 2;
    }
    if (opts.help) {
        imprimirAyuda();
        return 0;
    }
    if (opts.dryRun) {
        imprimirPlan(opts);
        return 0;
    }

    if (!process.env.DATABASE_URL) {
        console.error("[Smoke] Falta DATABASE_URL (usa --env-file=<env>). Nada que hacer.");
        return 2;
    }
    if (!esLoopback(opts.baseUrl) && !opts.confirmProd) {
        console.error(
            `[Smoke] La URL base (${opts.baseUrl}) NO es loopback. ` +
                "Si de verdad apuntas a ese entorno, repite con --confirm-prod (o SMOKE_CONFIRM_PROD=1)."
        );
        return 2;
    }

    console.log(`[Smoke] URL base: ${opts.baseUrl} · BD: ${describirDatabaseUrl()}`);
    const previos = await prisma.usuario.count({
        where: { email: { startsWith: PREFIJO_SMOKE, endsWith: DOMINIO_SMOKE } },
    });
    if (previos > 0) {
        console.log(`[Smoke] Info: ya existían ${previos} usuarios ${PREFIJO_SMOKE}*${DOMINIO_SMOKE} de corridas anteriores (no se tocan).`);
    }

    let cuentas: CuentasEfimeras;
    try {
        cuentas = await crearCuentasEfimeras();
    } catch (error) {
        console.error(`[Smoke] No se pudieron crear las cuentas efímeras: ${(error as Error).message}`);
        return 1;
    }
    console.log(`[Smoke] Cuentas efímeras creadas (corrida ${cuentas.ts}):`);
    for (const plan of PLAN_ROLES) {
        console.log(`  - ${cuentas.usuarios.get(plan.rol)?.email} (${plan.rol})`);
    }

    let huboFallo = false;
    try {
        if (opts.dbOnly) {
            console.log("[Smoke] Modo --db-only: ciclo de cuentas verificado (sin HTTP).");
        } else {
            const resultados = new Map<string, ResultadoPaso[]>();
            for (const plan of PLAN_ROLES) {
                const cuenta = cuentas.usuarios.get(plan.rol);
                if (!cuenta) {
                    resultados.set(plan.etiqueta, [{ paso: "cuenta", ok: false, detalle: "no creada" }]);
                    continue;
                }
                resultados.set(plan.etiqueta, await chequearRol(opts.baseUrl, plan, cuenta.email, cuentas.password));
            }

            console.log("\nROL        PASO              RESULTADO  DETALLE");
            console.log("-".repeat(78));
            for (const plan of PLAN_ROLES) {
                const pasos = resultados.get(plan.etiqueta) ?? [];
                for (const paso of pasos) {
                    if (!paso.ok) huboFallo = true;
                    console.log(
                        `${plan.etiqueta.padEnd(10)} ${paso.paso.padEnd(16)} ${(paso.ok ? "PASS" : "FAIL").padEnd(10)} ${paso.detalle}`
                    );
                }
                const rolOk = pasos.every((p) => p.ok);
                console.log(`${plan.etiqueta.padEnd(10)} TOTAL             ${(rolOk ? "PASS" : "FAIL").padEnd(10)}`);
                console.log("-".repeat(78));
            }
        }
    } finally {
        // El borrado se ejecuta SIEMPRE, falle lo que falle.
        try {
            await borrarCuentasEfimeras(cuentas);
        } catch (error) {
            huboFallo = true;
            console.error(`[Smoke] ERROR al borrar cuentas efímeras: ${(error as Error).message}`);
            console.error(`[Smoke] Quedan filas ${PREFIJO_SMOKE}${cuentas.ts}-*${DOMINIO_SMOKE}: borrarlas a mano.`);
        }
        const residuos = await contarResiduosPropios(cuentas).catch(() => -1);
        if (residuos === 0) {
            console.log("[Smoke] Limpieza verificada: 0 filas propias residuales en BD.");
        } else {
            huboFallo = true;
            console.error(`[Smoke] Limpieza INCOMPLETA: ${residuos} filas propias residuales (o verificación fallida).`);
        }
        await prisma.$disconnect();
    }

    if (huboFallo) {
        console.log("\n[Smoke] RESULTADO GLOBAL: FAIL");
        return 1;
    }
    console.log("\n[Smoke] RESULTADO GLOBAL: PASS");
    return 0;
}

main()
    .then((codigo) => {
        process.exitCode = codigo;
    })
    .catch(async (error) => {
        console.error(`[Smoke] Error inesperado: ${(error as Error).message}`);
        await prisma.$disconnect().catch(() => undefined);
        process.exitCode = 1;
    });
