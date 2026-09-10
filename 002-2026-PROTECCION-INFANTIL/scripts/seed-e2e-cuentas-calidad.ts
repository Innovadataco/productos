/**
 * SPEC-612 — Semilla de las cuentas de prueba de Calidad (repone, no limpia).
 *
 * La purga total del 07-09 se llevó las cuentas de prueba y la semilla del deploy no las repone: sin
 * un PROFESIONAL no se puede caminar la punta de SPEC-610 (el psicólogo canjea el pase y lee el caso).
 * Esto NO crea tres usuarios a mano —eso se pierde en la próxima purga— sino la HERRAMIENTA versionada
 * que los repone: se revisa, se repite y deja rastro.
 *
 * Contrato (radicado SPEC-612):
 *  - Idempotente de verdad: correr N veces deja el MISMO estado (solo re-hashea si la clave del entorno
 *    cambió; si ya valida, no reescribe el hash).
 *  - Credenciales del ENTORNO, jamás del código: `E2E_<CUENTA>_EMAIL` / `E2E_<CUENTA>_PASSWORD`. Aborta
 *    ruidoso si falta alguna, ANTES de tocar la BD (ver `leerCredencialesE2E`). Cero literales (SPEC-107).
 *  - Tres cuentas CON CLAVE LOCAL (el arnés entra por /api/auth/login; una cuenta solo-Google no puede):
 *    PARENT, PARENT2 y PROFESIONAL —este con un PerfilProfesional mínimo para alcanzar su panel—.
 *  - Patrón de `seed-e2e-multi-tenant.ts`: usuarios por Prisma directo (no /api/auth/register), guardas
 *    de entorno, marcador de origen (AuditLog.metadatos.origen).
 *  - CERO DELETE / TRUNCATE / DROP. Repone; no limpia. NUNCA toca `soporte@innovadataco.com`
 *    (orden permanente de Jelkin).
 *
 * Datos gatea la semilla (su carril). La corre en PRODUCCIÓN el CEO — NO Dev 1, y NO contra prod.
 *
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/seed-e2e-cuentas-calidad.ts
 */
import type { Prisma, PrismaClient, RolUsuario } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import {
    EMAIL_INTOCABLE,
    leerCredencialesE2E,
    type CredencialCuenta,
} from "./lib/credenciales-e2e-calidad";
// Re-export para no romper importadores: la lectura pura vive en ./lib/credenciales-e2e-calidad.
export { leerCredencialesE2E, type CredencialCuenta } from "./lib/credenciales-e2e-calidad";

// SPEC-612: la lectura de credenciales (pura, sin Prisma) vive aparte para poder probarla en la suite
// unit SIN base — importar ESTE módulo sí instancia Prisma (../src/lib/prisma), así que el candado de
// idempotencia (que toca base) va a integración; el de ausencia, que es puro, a unit.
const ORIGEN = "e2e-calidad";

export interface ResultadoCuenta {
    clave: string;
    email: string;
    rol: RolUsuario;
    usuarioId: string;
    creado: boolean;
}

/**
 * Repone las cuentas por Prisma directo, idempotente. Solo re-hashea cuando la clave del entorno NO
 * coincide con la almacenada: un segundo corte con el mismo entorno no reescribe el hash (mismo estado).
 * Cinturón: jamás toca la cuenta intocable.
 */
export async function sembrarCuentasE2E(
    tx: Prisma.TransactionClient,
    cuentas: CredencialCuenta[],
    ciudadId: string
): Promise<ResultadoCuenta[]> {
    const resultados: ResultadoCuenta[] = [];
    for (const cuenta of cuentas) {
        if (cuenta.email === EMAIL_INTOCABLE) {
            throw new Error(`[seed-e2e-calidad] jamás se siembra la cuenta intocable ${EMAIL_INTOCABLE}`);
        }
        const existente = await tx.usuario.findUnique({ where: { email: cuenta.email } });
        let usuarioId: string;
        let creado = false;
        if (!existente) {
            const creada = await tx.usuario.create({
                data: {
                    email: cuenta.email,
                    nombre: cuenta.nombre,
                    passwordHash: await hashPassword(cuenta.secreto),
                    passwordCreadaEn: new Date(),
                    rol: cuenta.rol,
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    debeCambiarPassword: false,
                },
            });
            usuarioId = creada.id;
            creado = true;
        } else {
            const mismaClave = await verifyPassword(cuenta.secreto, existente.passwordHash);
            await tx.usuario.update({
                where: { id: existente.id },
                data: {
                    nombre: cuenta.nombre,
                    rol: cuenta.rol,
                    estado: "activo",
                    estadoActivacion: "ACTIVO",
                    debeCambiarPassword: false,
                    // Idempotencia real: sin cambio de clave en el entorno, el hash NO se reescribe.
                    ...(mismaClave ? {} : { passwordHash: await hashPassword(cuenta.secreto), passwordCreadaEn: new Date() }),
                },
            });
            usuarioId = existente.id;
        }

        if (cuenta.esProfesional) {
            // Mínimo para alcanzar su panel: sin PerfilProfesional, /dashboard/profesional redirige a
            // /perfil-profesional/completar (onboarding). `update: {}` lo deja idempotente.
            await tx.perfilProfesional.upsert({
                where: { usuarioId },
                create: {
                    usuarioId,
                    nombreVisible: cuenta.nombre,
                    tituloProfesional: "Psicólogo (E2E)",
                    ciudadId,
                    aniosExperiencia: 5,
                    presentacion: "Cuenta de prueba de Calidad (E2E). No atender consultas reales.",
                    tarifaConsultaCOP: 100000,
                    duracionMinutos: 50,
                },
                update: {},
            });
        }

        resultados.push({ clave: cuenta.clave, email: cuenta.email, rol: cuenta.rol, usuarioId, creado });
    }
    return resultados;
}

function nowCOT(): string {
    return new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date());
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        throw new Error("[seed-e2e-calidad] DATABASE_URL requerida");
    }
    if (process.env.NODE_ENV === "test") {
        throw new Error("[seed-e2e-calidad] NODE_ENV=test bloqueado — este script no corre en tests");
    }

    // Aborta por variable ausente ANTES de cualquier escritura.
    const cuentas = leerCredencialesE2E();

    const ciudad = await (prisma as PrismaClient).ciudad.findFirst({ where: { nombre: "Bogotá" } });
    if (!ciudad) {
        throw new Error("[seed-e2e-calidad] Ciudad 'Bogotá' faltante — corre la semilla base antes");
    }

    const resultados = await prisma.$transaction((tx) => sembrarCuentasE2E(tx, cuentas, ciudad.id));

    // Marcador de origen (el schema no tiene metadatos JSON en Usuario): un AuditLog identifica la siembra.
    await prisma.auditLog.create({
        data: {
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "SeedE2ECalidad",
            ipAddress: "script",
            userAgent: "scripts/seed-e2e-cuentas-calidad",
            metadatos: {
                origen: ORIGEN,
                cuentas: resultados.map((r) => ({ clave: r.clave, email: r.email, rol: r.rol, creado: r.creado })),
                ejecutado: nowCOT(),
            } satisfies Prisma.InputJsonValue,
        },
    });

    console.log("");
    console.log("✅ Semilla E2E de Calidad COMPLETA (idempotente). Cuentas repuestas:");
    for (const r of resultados) {
        console.log(`  ${r.clave} (${r.rol}): ${r.email} ${r.creado ? "[creada]" : "[actualizada]"}`);
    }
    console.log(`Ejecutado: ${nowCOT()}`);
}

if (process.argv[1]?.endsWith("seed-e2e-cuentas-calidad.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[seed-e2e-calidad] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
