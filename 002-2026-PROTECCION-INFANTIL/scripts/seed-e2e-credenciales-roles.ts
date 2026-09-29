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
import type { Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
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

    const activos = {
        nombre: cred.nombre,
        rol: cred.rol,
        estado: "activo",
        estadoActivacion: "ACTIVO" as const,
        debeCambiarPassword: false,
        tenantId: colegio?.tenantId ?? null,
        colegioId: colegio?.colegioId ?? null,
    } satisfies Prisma.UsuarioUncheckedUpdateInput;

    if (!existente) {
        const creada = await tx.usuario.create({
            data: { email: cred.email, passwordHash: await hashPassword(cred.secreto), passwordCreadaEn: ahora, ...activos },
            select: { id: true },
        });
        await marcar(tx, "Usuario", [creada.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: `login ${cred.rol}` });
        return { clave: cred.clave, rol: cred.rol, email: cred.email, usuarioId: creada.id, creado: true, rehashClave: true };
    }

    // Idempotencia del hash: re-hashea SOLO si la clave del entorno NO coincide con el hash actual.
    const claveCoincide = await verifyPassword(cred.secreto, existente.passwordHash);
    const cambioClave = claveCoincide ? {} : { passwordHash: await hashPassword(cred.secreto), passwordCreadaEn: ahora };
    await tx.usuario.update({ where: { id: existente.id }, data: { ...activos, ...cambioClave } });
    await marcar(tx, "Usuario", [existente.id], { corrida: CORRIDA_CUENTAS_CALIDAD, script: SCRIPT, notas: `login ${cred.rol}` });
    return { clave: cred.clave, rol: cred.rol, email: cred.email, usuarioId: existente.id, creado: false, rehashClave: !claveCoincide };
}

export async function sembrarCredencialesRoles(
    tx: Prisma.TransactionClient,
    creds: CredencialRol[],
    base: Base,
    ahora: Date = new Date(),
): Promise<{ resultados: ResultadoRol[]; notifAntes: number; notifDespues: number }> {
    const notifAntes = await tx.notificacion.count();
    const resultados: ResultadoRol[] = [];
    for (const cred of creds) resultados.push(await upsertCuentaRol(tx, cred, base, ahora));
    const notifDespues = await tx.notificacion.count();
    if (notifDespues !== notifAntes) {
        throw new Error(`[seed-e2e-cred-roles] la siembra disparó ${notifDespues - notifAntes} notificación(es) — se ABORTA (nada se confirma).`);
    }
    return { resultados, notifAntes, notifDespues };
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

    const { resultados, notifAntes, notifDespues } = await prisma.$transaction((tx) =>
        sembrarCredencialesRoles(tx, creds, { paisId: pais.id, ciudadId: ciudad.id }),
    );

    console.log("");
    console.log("✅ Credenciales e2e de roles RESTABLECIDAS (idempotente, corrida persistente):");
    for (const r of resultados) {
        console.log(`  ${r.rol.padEnd(18)} ${r.email} ${r.creado ? "[creada]" : "[actualizada]"}${r.rehashClave ? " · clave (re)fijada" : " · clave ya OK"}`);
    }
    console.log(`  notificaciones (en la tx): antes=${notifAntes} después=${notifDespues} delta=${notifDespues - notifAntes} ✅`);
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
