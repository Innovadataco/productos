/**
 * Fixture de Calidad · RESTABLECE las credenciales de login de los 3 roles que hoy dan 401 en prod:
 * COLEGIO (SCHOOL_ADMIN), OPERADOR y COMITE_VALIDACION. Calidad no puede crear cuentas (prohibido),
 * y hoy solo camina 2 de 7 roles porque estas 3 rebotan en el login.
 *
 * CAUSA RAÍZ (por rol):
 *  - OPERADOR / COMITE_VALIDACION: NO existía ningún sembrador e2e para ellos → las cuentas que
 *    Calidad usaba se crearon ad-hoc y se perdieron (o nunca estuvieron en esta BD). 401 = faltantes.
 *  - COLEGIO: `seed-e2e-multi-tenant.ts` (SPEC-288) REGENERA una clave aleatoria en cada corrida
 *    → cualquier re-siembra desincroniza la clave que Calidad tiene guardada → 401. Este sembrador
 *    da una cuenta de colegio con clave ESTABLE (del entorno), independiente de esa rotación.
 *
 * DISCIPLINA (encargo del CEO):
 *  - IDEMPOTENTE + ATÓMICO: upsert por email; correr N veces deja el mismo estado (una transacción).
 *  - PARAMETRIZABLE: credenciales por ENTORNO (`E2E_<CLAVE>_EMAIL` / `E2E_<CLAVE>_PASSWORD`), cero
 *    literal de credencial en código (SPEC-107); aborta ruidoso si falta una variable, sin escribir.
 *  - Clave ESTABLE: re-hashea SOLO si la clave del entorno cambió (idempotencia del hash) → no rota.
 *  - CORRIDA PERSISTENTE `e2e-calidad-cuentas` (no la purgable): una purga de estado NO borra la
 *    cuenta fija de Calidad (lección SPEC-722). `demo_marcado` = 1 fila por entidad.
 *  - CERO notificaciones: create/update directo (no transita servicios que encolan avisos); el
 *    conteo se toma dentro de la tx y si crece se DESHACE.
 *  - Cuenta intocable (`soporte@`) jamás es destino.
 *
 * Datos gatea la semilla; la corre en PRODUCCIÓN el CEO (write con OK de Jelkin) — NO contra prod
 * a mano, y las credenciales viven SOLO en el entorno, nunca en el chat/commit.
 *
 * Uso (dev): node --env-file=.env --import tsx scripts/seed-e2e-credenciales-roles.ts
 */
import { TipoTitular, type Prisma, type PrismaClient, type RolUsuario } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { ConsentimientoService } from "../src/lib/dal/services/consentimiento";
import { esTitularDelDato } from "../src/lib/routing/roles-titulares";
import { crearCursosPorDefecto } from "../src/lib/colegio/cursos-seed";
import { crearSuscripcionCliente } from "../src/lib/pagos/freemium.service";
import { EMAIL_INTOCABLE } from "./lib/credenciales-e2e-calidad";
import { marcar } from "./demo/_marcado";

/** Corrida PERSISTENTE de cuentas fijas de Calidad (compartida con el fixture del profesional habilitado). */
export const CORRIDA_CUENTAS_CALIDAD = "e2e-calidad-cuentas";
const SCRIPT = "seed-e2e-credenciales-roles";

interface DefinicionRol {
    // COMITE_VALIDACION explícito (NO `COMITE` a secas): al lado vive la cuenta REAL de colegio
    // `E2E_COMITE_CONVIVENCIA_*` que Calidad respeta y no camina; un nombre ambiguo sería un
    // foot-gun (llenar la variable equivocada escribiría sobre datos reales). Calza con el nombre
    // que Calidad ya usa en su .env.e2e → cero divergencia.
    clave: "COLEGIO" | "OPERADOR" | "COMITE_VALIDACION";
    rol: RolUsuario;
    nombre: string;
    /** SCHOOL_ADMIN necesita un colegio/tenant; OPERADOR/COMITE son de plataforma (sin tenant). */
    requiereColegio: boolean;
}

export const DEFINICIONES_ROL: readonly DefinicionRol[] = [
    { clave: "COLEGIO", rol: "SCHOOL_ADMIN", nombre: "Colegio Calidad (E2E · login)", requiereColegio: true },
    { clave: "OPERADOR", rol: "OPERADOR", nombre: "Operador Calidad (E2E)", requiereColegio: false },
    { clave: "COMITE_VALIDACION", rol: "COMITE_VALIDACION", nombre: "Comité-Validación Calidad (E2E)", requiereColegio: false },
];

export interface CredencialRol extends DefinicionRol {
    email: string;
    secreto: string;
}

/** Lee correo+clave de cada rol del ENTORNO. Pura: aborta si falta una variable, sin escribir nada. */
export function leerCredencialesRoles(env: Record<string, string | undefined> = process.env): CredencialRol[] {
    const faltantes: string[] = [];
    for (const def of DEFINICIONES_ROL) {
        if (!env[`E2E_${def.clave}_EMAIL`]?.trim()) faltantes.push(`E2E_${def.clave}_EMAIL`);
        if (!env[`E2E_${def.clave}_PASSWORD`]?.trim()) faltantes.push(`E2E_${def.clave}_PASSWORD`);
    }
    if (faltantes.length > 0) {
        throw new Error(`[seed-e2e-cred-roles] Faltan variables de entorno (${faltantes.join(", ")}). Aborto sin escribir nada.`);
    }
    return DEFINICIONES_ROL.map((def) => {
        const email = env[`E2E_${def.clave}_EMAIL`]!.trim().toLowerCase();
        const secreto = env[`E2E_${def.clave}_PASSWORD`]!.trim();
        if (email === EMAIL_INTOCABLE) {
            throw new Error(`[seed-e2e-cred-roles] E2E_${def.clave}_EMAIL no puede ser la cuenta intocable ${EMAIL_INTOCABLE}.`);
        }
        return { ...def, email, secreto };
    });
}

interface Base {
    paisId: string;
    ciudadId: string;
}

export interface ResultadoRol {
    clave: string;
    rol: RolUsuario;
    email: string;
    usuarioId: string;
    creado: boolean;
    rehashClave: boolean;
    /** Colegio asociado (solo el rol SCHOOL_ADMIN). Necesario para completar su camino. */
    colegioId: string | null;
}

/** Colegio+tenant DEDICADO a la cuenta de login de colegio (aparte de los A/B de aislamiento SPEC-288). */
async function asegurarColegioLogin(tx: Prisma.TransactionClient, base: Base): Promise<{ tenantId: string; colegioId: string }> {
    const nombreTenant = "e2e-calidad-colegio-login";
    let tenant = await tx.tenant.findFirst({ where: { nombre: nombreTenant }, select: { id: true } });
    if (!tenant) tenant = await tx.tenant.create({ data: { nombre: nombreTenant }, select: { id: true } });
    const colegio = await tx.colegio.upsert({
        where: { tenantId: tenant.id },
        create: {
            nombre: "Calidad · Colegio (login E2E)",
            nit: "E2E-NIT-LOGIN",
            paisId: base.paisId,
            ciudadId: base.ciudadId,
            representanteLegalNombre: "Representante E2E login",
            representanteLegalIdentificacion: "E2E-LOGIN-000",
            representanteLegalEmail: "soporte+e2e-colegio-login@innovadataco.com",
            inicioServicio: new Date("2026-01-01T00:00:00Z"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
        update: { estado: "activo" },
        select: { id: true },
    });
    await marcar(tx, "Tenant", [tenant.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "tenant colegio login" });
    await marcar(tx, "Colegio", [colegio.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "colegio login" });
    return { tenantId: tenant.id, colegioId: colegio.id };
}

/** Upsert idempotente de la cuenta de un rol, con clave ESTABLE del entorno (re-hash solo si cambió). */
async function upsertCuentaRol(
    tx: Prisma.TransactionClient,
    cred: CredencialRol,
    base: Base,
    ahora: Date,
): Promise<ResultadoRol> {
    const colegio = cred.requiereColegio ? await asegurarColegioLogin(tx, base) : null;
    const existente = await tx.usuario.findUnique({ where: { email: cred.email }, select: { id: true, passwordHash: true } });

    // SPEC-761: el Paso 1 del camino del colegio valida estos campos EN `Usuario`
    // (no en `Colegio.representanteLegal*`): apellidos, documentoTipo,
    // documentoNumero, telefono. Valores sintéticos del colegio de PRUEBA (marcador
    // E2E-LOGIN-000, igual que el Colegio; `Usuario` NO tiene unique sobre
    // (documentoTipo, documentoNumero), así que no colisiona). Solo el rector.
    const identidadRector = cred.requiereColegio
        ? { apellidos: "Calidad E2E", documentoTipo: "CC", documentoNumero: "E2E-LOGIN-000", telefono: "3000000000" }
        : {};

    const activos = {
        nombre: cred.nombre,
        rol: cred.rol,
        estado: "activo",
        estadoActivacion: "ACTIVO" as const,
        debeCambiarPassword: false,
        tenantId: colegio?.tenantId ?? null,
        colegioId: colegio?.colegioId ?? null,
        ...identidadRector,
    } satisfies Prisma.UsuarioUncheckedUpdateInput;

    const colegioId = colegio?.colegioId ?? null;

    if (!existente) {
        const creada = await tx.usuario.create({
            data: { email: cred.email, passwordHash: await hashPassword(cred.secreto), passwordCreadaEn: ahora, ...activos },
            select: { id: true },
        });
        await marcar(tx, "Usuario", [creada.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: `login ${cred.rol}` });
        return { clave: cred.clave, rol: cred.rol, email: cred.email, usuarioId: creada.id, creado: true, rehashClave: true, colegioId };
    }

    // Idempotencia del hash: re-hashea SOLO si la clave del entorno NO coincide con el hash actual.
    const claveCoincide = await verifyPassword(cred.secreto, existente.passwordHash);
    const cambioClave = claveCoincide ? {} : { passwordHash: await hashPassword(cred.secreto), passwordCreadaEn: ahora };
    await tx.usuario.update({ where: { id: existente.id }, data: { ...activos, ...cambioClave } });
    await marcar(tx, "Usuario", [existente.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: `login ${cred.rol}` });
    return { clave: cred.clave, rol: cred.rol, email: cred.email, usuarioId: existente.id, creado: false, rehashClave: !claveCoincide, colegioId };
}

/**
 * SPEC-757: siembra la aceptación del consentimiento para las cuentas TITULARES
 * del dato (`esTitularDelDato` — hoy solo el SCHOOL_ADMIN de Calidad), para que
 * crucen la puerta (SPEC-756) como cruzaría una cuenta real. Los NO titulares
 * (OPERADOR/COMITE_VALIDACION) JAMÁS reciben firma: sembrarla fabricaría la firma
 * inválida que el auditor (SPEC-755) marca y que la puerta (SPEC-756) impide crear.
 * La decisión deriva de la MISMA fuente única que 755/756.
 *
 * - `documentoTipo` DERIVADO de `documentoPorRol(rol)` — nunca quemado.
 * - versión y hash REALES del servicio (versionVigente + hash del documento vigente).
 * - SIN notificación: NO pasa por `aceptar()` (que encola un aviso); escribe directo.
 *   El guard de notificaciones de la tx lo confirma.
 * - Idempotente por (usuario, versión): re-correr no duplica. `AuditConsentimiento`
 *   cae por Cascade con el `Usuario` (corrida persistente), no se marca aparte.
 * Devuelve `true` solo si CREÓ una fila nueva.
 */
async function sembrarConsentimientoTitular(
    tx: Prisma.TransactionClient,
    resultado: ResultadoRol,
    svc: ConsentimientoService,
    ahora: Date,
): Promise<boolean> {
    if (!esTitularDelDato(resultado.rol)) return false; // no-titular: jamás firma
    const documentoTipo = svc.documentoPorRol(resultado.rol);
    const version = await svc.versionVigente();

    const existente = await tx.auditConsentimiento.findFirst({
        where: { usuarioId: resultado.usuarioId, version },
        select: { id: true },
    });
    if (existente) {
        // La compuerta LEE `usuario.consentimientoVersion`; lo dejamos consistente
        // por si la fila de audit existía sin el reflejo en Usuario (idempotencia).
        await tx.usuario.update({ where: { id: resultado.usuarioId }, data: { consentimientoVersion: version } });
        return false;
    }

    const documentoHash = svc.calcularHash(await svc.obtenerDocumentoVigente(documentoTipo));
    await tx.auditConsentimiento.create({
        data: {
            usuarioId: resultado.usuarioId,
            version,
            documentoTipo,
            documentoHash,
            aceptadoEn: ahora,
            ip: "seed",
            userAgent: SCRIPT,
            // Declaración del titular de PRUEBA (cuenta fixture): a un titular real la
            // interfaz se la pregunta (SPEC-756); acá el fixture la asienta para Calidad.
            esRepresentanteLegal: true,
        },
    });
    await tx.usuario.update({
        where: { id: resultado.usuarioId },
        data: {
            consentimientoVersion: version,
            consentimientoAceptadoEn: ahora,
            consentimientoDocumentoHash: documentoHash,
            consentimientoIP: "seed",
        },
    });
    return true;
}

/**
 * SPEC-761: deja el estado que el asistente del colegio habría dejado, para que
 * `derivarPasoPendienteColegio` devuelva null y la cuenta alcance /dashboard/colegio.
 * Cubre pasos 3/4/5 (profesor activo, cursos activos, estudiante activo + acudiente);
 * los CAMPOS del rector (paso 1) los pone `upsertCuentaRol` en el Usuario. El paso 2
 * (suscripción) NO va acá: se crea con el SERVICIO fuera de la tx (ver
 * `completarSuscripcionColegio`). Datos SINTÉTICOS del colegio de PRUEBA (marcadores
 * E2E), idempotente. SPEC-763: SÍ se `marcar`n, en la corrida PERSISTENTE
 * `e2e-calidad-cuentas` (la MISMA de Tenant/Colegio) — para que sean IDENTIFICABLES por el
 * mecanismo estándar (`demo_marcado`): en un producto de protección infantil, un menor
 * sintético debe poder listarse como dato de prueba por consulta directa, no rastrearse por
 * marcadores dentro de sus campos ni transitivamente por el Colegio. Corrida PERSISTENTE ⇒ la
 * purga de ESTADO NO los borra (la cuenta sigue alcanzando /dashboard/colegio). La cobertura
 * vive en `ENTIDADES_ORDEN_BORRADO` (demo/_marcado), que ya trae estas entidades: la invariante
 * de PERTENENCIA es del catálogo, no de la corrida.
 */
async function sembrarEntidadesCaminoColegio(tx: Prisma.TransactionClient, colegioId: string, ahora: Date): Promise<void> {
    // Paso 3 · Profesor activo. Unique (colegioId, tipoDocumento, numeroDocumento).
    const prof =
        (await tx.profesor.findFirst({
            where: { colegioId, tipoDocumento: "CC", numeroDocumento: "E2E-PROF-000" },
            select: { id: true },
        })) ??
        (await tx.profesor.create({
            data: {
                colegioId,
                nombre: "Profesor",
                apellidos: "Calidad E2E",
                tipoDocumento: "CC",
                numeroDocumento: "E2E-PROF-000",
                anioNacimiento: 1990,
                sexo: "OTRO",
                email: "soporte+e2e-profesor@innovadataco.com",
                telefono: "3000000001",
                estado: "activo",
            },
            select: { id: true },
        }));
    // SPEC-763: marca en la corrida PERSISTENTE — identificable, no purgado.
    await marcar(tx, "Profesor", [prof.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "profesor del camino colegio" });

    // Paso 4 · Cursos activos: reusa el sembrador de los 11 grados (idempotente).
    await crearCursosPorDefecto(colegioId, String(ahora.getUTCFullYear()), tx);
    const cursos = await tx.curso.findMany({ where: { colegioId }, select: { id: true } });
    if (cursos.length > 0) {
        await marcar(tx, "Curso", cursos.map((c) => c.id), { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "cursos del camino colegio" });
    }

    // Paso 5 · Estudiante activo (menor sintético) + acudiente, en el primer curso activo.
    let est = await tx.estudiante.findFirst({
        where: { colegioId, documentoNumero: "E2E-EST-000" },
        select: { id: true },
    });
    if (!est) {
        const curso = await tx.curso.findFirst({ where: { colegioId, estado: "activo" }, select: { id: true } });
        if (curso) {
            est = await tx.estudiante.create({
                data: {
                    cursoId: curso.id,
                    colegioId,
                    nombre: "Estudiante",
                    apellidos: "Calidad E2E",
                    documentoTipo: "TI",
                    documentoNumero: "E2E-EST-000",
                    estado: "activo",
                },
                select: { id: true },
            });
            await tx.acudienteEstudiante.create({
                data: { estudianteId: est.id, orden: 1, nombre: "Acudiente Calidad E2E", relacion: "acudiente", estado: "activo" },
            });
        }
    }
    if (est) {
        // El MENOR sintético: marcado para que «listame todos los menores de prueba» lo alcance.
        await marcar(tx, "Estudiante", [est.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "estudiante (menor sintético) del camino colegio" });
        const acudientes = await tx.acudienteEstudiante.findMany({ where: { estudianteId: est.id }, select: { id: true } });
        if (acudientes.length > 0) {
            await marcar(tx, "AcudienteEstudiante", acudientes.map((a) => a.id), { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: "acudiente del menor del camino colegio" });
        }
    }
}

/**
 * SPEC-761 · Paso 2 del camino: la suscripción del colegio. Se crea con el SERVICIO
 * canónico `crearSuscripcionCliente` (NO se escribe la fila directo: el servicio
 * resuelve el plan básico MES_1, el código de referido, la ventana freemium y el
 * AuditLog). Por eso NO es tx-aware y corre en SU PROPIA transacción, fuera de la del
 * resto del sembrado (LÍMITE DECLARADO: dos transacciones, no una — la alternativa
 * era escribir la fila directo y saltar la lógica del servicio). Idempotente: si el
 * colegio ya tiene suscripción, no crea otra. El servicio escribe AuditLog, no
 * Notificacion, así que no toca el guard de cero-notificaciones. `true` si creó una.
 */
export async function completarSuscripcionColegio(colegioId: string): Promise<boolean> {
    const yaTiene = await prisma.suscripcion.count({ where: { colegioId } });
    if (yaTiene > 0) return false;
    await crearSuscripcionCliente({ tipoTitular: TipoTitular.COLEGIO, colegioId });
    return true;
}

export async function sembrarCredencialesRoles(
    tx: Prisma.TransactionClient,
    creds: CredencialRol[],
    base: Base,
    ahora: Date = new Date(),
): Promise<{ resultados: ResultadoRol[]; notifAntes: number; notifDespues: number; consentimientosSembrados: RolUsuario[] }> {
    const notifAntes = await tx.notificacion.count();
    const resultados: ResultadoRol[] = [];
    for (const cred of creds) resultados.push(await upsertCuentaRol(tx, cred, base, ahora));

    // SPEC-757: aceptación de consentimiento SOLO para titulares del dato, dentro
    // de la MISMA tx y ANTES del guard de notificaciones (así el guard también
    // cubre este paso: si algo encolara un aviso, se DESHACE todo).
    const svc = new ConsentimientoService();
    const consentimientosSembrados: RolUsuario[] = [];
    for (const r of resultados) {
        if (await sembrarConsentimientoTitular(tx, r, svc, ahora)) consentimientosSembrados.push(r.rol);
    }

    // SPEC-761: entidades del camino del colegio (pasos 3/4/5) para el/los rol(es)
    // con colegio. El paso 2 (suscripción) se completa fuera de la tx (servicio).
    for (const r of resultados) {
        if (r.colegioId) await sembrarEntidadesCaminoColegio(tx, r.colegioId, ahora);
    }

    const notifDespues = await tx.notificacion.count();
    if (notifDespues !== notifAntes) {
        throw new Error(`[seed-e2e-cred-roles] la siembra disparó ${notifDespues - notifAntes} notificación(es) — se ABORTA (nada se confirma).`);
    }
    return { resultados, notifAntes, notifDespues, consentimientosSembrados };
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("[seed-e2e-cred-roles] DATABASE_URL requerida");
    if (process.env.NODE_ENV === "test") throw new Error("[seed-e2e-cred-roles] NODE_ENV=test bloqueado — este script no corre en tests");

    const creds = leerCredencialesRoles();
    const [pais, ciudad] = await Promise.all([
        (prisma as PrismaClient).pais.findFirst({ where: { OR: [{ codigo: "CO" }, { nombre: "Colombia" }] }, select: { id: true } }),
        (prisma as PrismaClient).ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true } }),
    ]);
    if (!pais) throw new Error("[seed-e2e-cred-roles] País 'Colombia' faltante — corre `prisma db seed` antes");
    if (!ciudad) throw new Error("[seed-e2e-cred-roles] Ciudad 'Bogotá' faltante — corre `prisma db seed` antes");

    const { resultados, notifAntes, notifDespues, consentimientosSembrados } = await prisma.$transaction((tx) =>
        sembrarCredencialesRoles(tx, creds, { paisId: pais.id, ciudadId: ciudad.id }),
    );

    // SPEC-761 · Paso 2 (suscripción) FUERA de la tx: el servicio canónico no es
    // tx-aware (ver completarSuscripcionColegio). Idempotente. Completa el camino
    // del colegio junto con los pasos 1/3/4/5 que dejó la tx.
    const suscripcionesColegio: string[] = [];
    for (const r of resultados) {
        if (r.colegioId && (await completarSuscripcionColegio(r.colegioId))) suscripcionesColegio.push(r.rol);
    }

    console.log("");
    console.log("✅ Credenciales e2e de roles RESTABLECIDAS (idempotente, corrida persistente):");
    for (const r of resultados) {
        console.log(`  ${r.rol.padEnd(18)} ${r.email} ${r.creado ? "[creada]" : "[actualizada]"}${r.rehashClave ? " · clave (re)fijada" : " · clave ya OK"}`);
    }
    console.log(`  notificaciones (en la tx): antes=${notifAntes} después=${notifDespues} delta=${notifDespues - notifAntes} ✅`);
    console.log(
        consentimientosSembrados.length > 0
            ? `  consentimiento sembrado (titulares del dato): ${consentimientosSembrados.join(", ")} — cruza la puerta SPEC-756`
            : "  consentimiento: sin firmas nuevas (ya vigentes o sin titulares) ✅",
    );
    console.log(
        suscripcionesColegio.length > 0
            ? `  camino colegio completado (suscripción creada): ${suscripcionesColegio.join(", ")} — /dashboard/colegio alcanzable`
            : "  camino colegio: suscripción ya existía o sin colegio ✅ (pasos 1/3/4/5 idempotentes)",
    );
    console.log("  → Calidad entra con E2E_<ROL>_PASSWORD del entorno; sin claves en logs.");
}

if (process.argv[1]?.endsWith("seed-e2e-credenciales-roles.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[seed-e2e-cred-roles] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
