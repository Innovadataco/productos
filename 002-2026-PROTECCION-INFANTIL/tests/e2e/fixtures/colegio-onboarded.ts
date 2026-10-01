/**
 * SPEC-775 · Fixture de COLEGIO ONBOARDEADO para e2e (Calidad).
 *
 * Tercer builder de la familia (junto a `padre-onboarded.ts` y `profesional-visible.ts`),
 * MISMO patrón: recorre el camino REAL por endpoints, en orden, re-sellando la sesión en
 * cada paso. Sin él, ninguna pantalla de colegio se ejercita end-to-end más allá del
 * onboarding — y el canal de colegios es el que factura.
 *
 * LOS PASOS NO SON UNA LISTA ESCRITA ACÁ: son los que `derivarPasoPendienteColegio`
 * (`estado-colegio.ts`, SPEC-344) EXIGE — consentimiento + datos del rector + plan +
 * profesores + cursos + estudiantes. El builder los completa y al final AFIRMA
 * `derivarPasoPendienteColegio(rector) === null`. Si el camino gana un 7º paso mañana, esa
 * aserción FALLA (el builder se rompe, no queda silenciosamente incompleto): un builder que
 * dice «onboarded» sin estarlo es peor que ninguno. Los cursos (11) y materias (15) los
 * siembra el `completar` (SPEC-344), así que el Paso «cursos» se cumple solo.
 *
 * CONTRATO (las tres condiciones de siempre): VÁLIDO por defecto (`hasta: "completo"`),
 * variaciones por PARÁMETRO (`hasta`), cero estado imposible / cero Prisma directo de estado
 * (solo el TOKEN de registro se crea por Prisma — simula «llegó el correo»; las lecturas de
 * catálogo y la limpieza por id no son estado del camino).
 *
 * Solo para `tests/e2e/**`. La guardia SPEC-770 del globalSetup garantiza BD `*_test`.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import type { RolUsuario } from "@prisma/client";

/** Hasta qué paso del camino del colegio avanzar. `completo` = camino entero. */
export type HastaPasoColegio = "rector" | "datos" | "plan" | "profesores" | "estudiantes" | "completo";

export interface OpcionesColegioOnboarded {
    /** Contexto FRESCO del rector — su sesión (cookie firmada) se re-sella acá. */
    request: APIRequestContext;
    email: string;
    password: string;
    /** Prefijo único de la corrida (para nombre de colegio y NIT únicos). */
    corrida: string;
    /** Hasta qué paso llevar el camino. Por defecto `completo`. */
    hasta?: HastaPasoColegio;
}

export interface ColegioOnboarded {
    rectorUsuarioId: string;
    colegioId: string;
    readonly _limpieza: { usuarios: string[]; colegios: string[]; tenants: string[]; tokens: string[] };
}

/**
 * Registra + onboardea un COLEGIO (su rector SCHOOL_ADMIN) por sus endpoints reales, en
 * orden: registro → login → consentimiento → datos del rector → plan freemium → profesor →
 * estudiante. Afirma el camino COMPLETO con `derivarPasoPendienteColegio`.
 */
export async function crearColegioOnboarded(opts: OpcionesColegioOnboarded): Promise<ColegioOnboarded> {
    const { request, email, password, corrida, hasta = "completo" } = opts;
    const nombreColegio = `Colegio E2E ${corrida}`;
    const nit = `E2E-${corrida}`;
    const limpieza = { usuarios: [] as string[], colegios: [] as string[], tenants: [] as string[], tokens: [] as string[] };

    // (0) Registro. El `completar` crea el colegio+rector y SIEMBRA 11 cursos + 15 materias
    // (SPEC-344). El TOKEN lleva nombreColegio+nit (los lee el completar), como el correo real.
    const solicitar = await request.post("/api/auth/registro-colegio/solicitar", { data: { email, nombreColegio, nit } });
    expect(solicitar.status(), `solicitar colegio body=${await solicitar.text().catch(() => "")}`).toBe(202);

    const token = randomBytes(24).toString("hex");
    const tokenHash = await bcrypt.hash(token, 12);
    const registro = await prisma.tokenRegistro.create({
        data: { email, tokenHash, rol: "SCHOOL_ADMIN" as RolUsuario, expiraEn: new Date(Date.now() + 3_600_000), nombreColegio, nit },
    });
    limpieza.tokens.push(registro.id);

    const completar = await request.post("/api/auth/registro-colegio/completar", {
        data: { token, password, passwordConfirmacion: password },
    });
    expect(completar.status(), `completar colegio body=${await completar.text().catch(() => "")}`).toBe(201);

    const rector = await prisma.usuario.findUnique({ where: { email }, select: { id: true, colegioId: true } });
    if (!rector || !rector.colegioId) throw new Error("[fixture] el completar no creó el rector/colegio");
    limpieza.usuarios.push(rector.id);
    limpieza.colegios.push(rector.colegioId);
    const colegioRow = await prisma.colegio.findUnique({ where: { id: rector.colegioId }, select: { tenantId: true } });
    if (colegioRow?.tenantId) limpieza.tenants.push(colegioRow.tenantId);

    const ctx: ColegioOnboarded = { rectorUsuarioId: rector.id, colegioId: rector.colegioId, _limpieza: limpieza };

    // Login: sella la sesión del rector (SCHOOL_ADMIN).
    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.status(), `login rector body=${await login.text().catch(() => "")}`).toBe(200);

    // (1) Paso 1 · consentimiento del rector (titular; el server deriva el documentoTipo).
    const consent = await request.post("/api/consentimiento/aceptar", {
        data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false },
    });
    expect(consent.status(), `consentimiento rector body=${await consent.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "rector") return finalizar(ctx, hasta);

    // (2) Paso 1 (cont.) · datos del rector (PATCH /api/colegio/rector, como el formulario).
    const documentoNumero = `1${(Date.now() % 1_000_000_000).toString().padStart(9, "0")}`;
    const datos = await request.patch("/api/colegio/rector", {
        data: { documentoTipo: "CC", documentoNumero, nombre: "Rector E2E", apellidos: "Prueba", telefono: "3001234567" },
    });
    expect(datos.status(), `datos rector body=${await datos.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "datos") return finalizar(ctx, hasta);

    // (3) Paso 2 · plan freemium del colegio.
    const plan = await request.post("/api/colegio/suscripcion/activar-freemium", { data: { aceptaTerminos: true } });
    expect(plan.status(), `freemium colegio body=${await plan.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "plan") return finalizar(ctx, hasta);

    // (4) Paso 3 · un profesor activo. Identidad COMPLETA obligatoria (SPEC-320/442): documento,
    // año de nacimiento (18-80), sexo (M/F/OTRO), email y teléfono.
    // ⚠️ CAMPOS DEL DOCUMENTO: el PROFESOR usa `tipoDocumento` / `numeroDocumento`. El ESTUDIANTE
    //    usa `documentoTipo` / `documentoNumero` (ver paso 5) — el MISMO concepto con DOS
    //    convenciones, a propósito (decisión CEO 30-09: no se normalizan hoy, romperían dos
    //    contratos). NO copies esta forma al alumno. Si algún día normalizás una, la otra EXISTE y
    //    hay que cambiarla también (ya nos pasó corregir media de un par y dejar la otra mintiendo).
    const docProfe = `2${(Date.now() % 1_000_000_000).toString().padStart(9, "0")}`;
    const profesor = await request.post("/api/colegio/profesores", {
        data: {
            nombre: "Profe E2E",
            apellidos: `Prueba ${corrida.slice(0, 6)}`,
            tipoDocumento: "CC",
            numeroDocumento: docProfe,
            anioNacimiento: new Date().getFullYear() - 35,
            sexo: "M",
            email: `profe-${corrida}@e2e.local`,
            telefono: "3001234567",
        },
    });
    expect(profesor.status(), `profesor body=${await profesor.text().catch(() => "")}`).toBeLessThan(300);
    if (hasta === "profesores") return finalizar(ctx, hasta);

    // (5) Paso 4 · cursos: los 11 sembrados por el completar YA cumplen. Paso 5 · un estudiante
    // activo en uno de esos cursos. Documento también obligatorio (SPEC-320 §2.2-bis).
    // ⚠️ CAMPOS DEL DOCUMENTO: el ESTUDIANTE usa `documentoTipo` / `documentoNumero` — DISTINTO del
    //    PROFESOR (`tipoDocumento` / `numeroDocumento`, ver paso 4). Difieren a propósito (decisión
    //    CEO 30-09). NO copies la forma del profesor acá. Si normalizás una, la otra existe arriba.
    const curso = await prisma.curso.findFirst({ where: { colegioId: rector.colegioId, estado: "activo" }, select: { id: true } });
    if (!curso) throw new Error("[fixture] el completar no sembró cursos activos (SPEC-344)");
    const docAlumno = `3${(Date.now() % 1_000_000_000).toString().padStart(9, "0")}`;
    const estudiante = await request.post(`/api/colegio/cursos/${curso.id}/alumnos`, {
        data: { nombre: "Alumno E2E", apellidos: `Prueba ${corrida.slice(0, 6)}`, documentoTipo: "CC", documentoNumero: docAlumno },
    });
    expect(estudiante.status(), `estudiante body=${await estudiante.text().catch(() => "")}`).toBeLessThan(300);

    return finalizar(ctx, hasta);
}

/**
 * Afirma que el camino quedó donde se pidió. Para `completo`, EXIGE que
 * `derivarPasoPendienteColegio` devuelva `null` (la fuente única de «terminado»): si el
 * camino crece, esto rompe el builder en vez de dejarlo mentir.
 */
async function finalizar(ctx: ColegioOnboarded, hasta: HastaPasoColegio): Promise<ColegioOnboarded> {
    if (hasta === "completo") {
        const paso = await derivarPasoPendienteColegio(ctx.rectorUsuarioId);
        expect(paso, `el camino del colegio debe quedar COMPLETO (derivarPasoPendienteColegio=null); quedó en "${paso}"`).toBeNull();
    }
    return ctx;
}

/** Limpieza FK-safe: estudiantes → profesores → cursos/materias → suscripción → auditoría →
 *  usuario(rector) → colegio → tenant → token. Idempotente por `deleteMany`. */
export async function limpiarColegioOnboarded(colegio: ColegioOnboarded): Promise<void> {
    const { usuarios, colegios, tenants, tokens } = colegio._limpieza;
    if (colegios.length > 0) {
        await prisma.estudiante.deleteMany({ where: { colegioId: { in: colegios } } }).catch(() => undefined);
        await prisma.profesor.deleteMany({ where: { colegioId: { in: colegios } } }).catch(() => undefined);
        await prisma.curso.deleteMany({ where: { colegioId: { in: colegios } } }).catch(() => undefined);
        await prisma.suscripcion.deleteMany({ where: { colegioId: { in: colegios } } }).catch(() => undefined);
    }
    if (usuarios.length > 0) {
        await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarios } } }).catch(() => undefined);
        await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } }).catch(() => undefined);
    }
    if (colegios.length > 0) {
        await prisma.colegio.deleteMany({ where: { id: { in: colegios } } }).catch(() => undefined);
    }
    if (tenants.length > 0) {
        await prisma.tenant.deleteMany({ where: { id: { in: tenants } } }).catch(() => undefined);
    }
    if (tokens.length > 0) {
        await prisma.tokenRegistro.deleteMany({ where: { id: { in: tokens } } }).catch(() => undefined);
    }
}
