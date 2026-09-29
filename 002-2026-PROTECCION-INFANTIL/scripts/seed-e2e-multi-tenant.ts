/**
 * SPEC-288 (002-PI-188) — Seed E2E multi-tenant.
 *
 * Crea 2 colegios ("Calidad · Colegio A/B") + 2 rectores SCHOOL_ADMIN
 * dedicados (soporte+e2e-colegio-{a,b}@innovadataco.com) + siembra mínima
 * (curso, 2 estudiantes, 1 profesor, 1 reporte OTRO) para desbloquear la
 * Campaña 6 de Calidad (aislamiento multi-tenant, D-89).
 *
 * Idempotente por diseño: correr N veces produce el mismo estado. La clave de
 * cada rector es ESTABLE, del ENTORNO (E2E_COLEGIO_{A,B}_ADMIN_PASSWORD), y se
 * re-hashea SOLO si cambió — mismo patrón que #709 (SPEC-612). Antes se generaba
 * una clave ALEATORIA en cada corrida: cualquier re-siembra desincronizaba la
 * clave que Calidad tenía guardada → 401 (el defecto que esto cierra). Las dos
 * claves son INDEPENDIENTES (una variable por colegio): estables pero distintas,
 * nunca una compartida. El aislamiento A/B lo da el TENANT, no la clave.
 *
 * Marcadores de origen (spec §Ajustes) — el schema no tiene metadatos JSON
 * en Colegio/Usuario/Reporte, así que se usan:
 *   - Tenant.nombre = "e2e-multi-tenant-{A,B}"     ← filtrado principal
 *   - Colegio.nombre = "Calidad · Colegio {A,B}"
 *   - Usuario.email = "soporte+e2e-colegio-{a,b}@innovadataco.com"
 *   - AuditLog.metadatos.origen = "e2e-multi-tenant" (al cierre)
 *
 * Candados: cero DROP/TRUNCATE/DELETE, cero cambios a "Sagrado corazón",
 * rectores por Prisma directo (NO por /api/auth/register), guard NODE_ENV,
 * PARAM_ENCRYPTION_KEY y claves del entorno antes de tocar la BD. La clave
 * NUNCA se imprime (SPEC-107): es un INPUT del entorno, no una salida.
 *
 * Uso (dev):
 *   E2E_COLEGIO_A_ADMIN_PASSWORD=… E2E_COLEGIO_B_ADMIN_PASSWORD=… \
 *   node --env-file=.env --import tsx scripts/seed-e2e-multi-tenant.ts
 *
 * PRODUCCIÓN: NO lo corre ODIN. Lo ejecuta el responsable del despliegue
 * tras directriz explícita del CEO (spec §Candados).
 */
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { encryptParameter } from "../src/lib/param-encryption";

interface IntocableSnapshot {
    id: string;
    nombre: string;
    tenantId: string;
    adminId: string | null;
    adminEmail: string | null;
}

interface ResultadoColegioE2E {
    letra: "A" | "B";
    colegioId: string;
    adminEmail: string;
    /** true si esta corrida (re)hasheó la clave (cuenta nueva o clave del entorno distinta). */
    rehashClave: boolean;
}

const TEXTO_REPORTE = "Reporte de prueba E2E multi-tenant. NO tocar.";

/** Nombre de la variable de entorno con la clave estable del rector de cada colegio. */
const ENV_PASSWORD: Record<"A" | "B", string> = {
    A: "E2E_COLEGIO_A_ADMIN_PASSWORD",
    B: "E2E_COLEGIO_B_ADMIN_PASSWORD",
};

/**
 * Lee del ENTORNO la clave estable de cada rector (A y B). Pura: aborta ruidoso si falta alguna,
 * SIN escribir nada (SPEC-107: cero literal de credencial en código). Dos variables separadas →
 * claves independientes (estables pero distintas), nunca una compartida.
 */
export function leerPasswordsColegios(env: Record<string, string | undefined> = process.env): Record<"A" | "B", string> {
    const faltantes: string[] = [];
    const a = env[ENV_PASSWORD.A]?.trim();
    const b = env[ENV_PASSWORD.B]?.trim();
    if (!a) faltantes.push(ENV_PASSWORD.A);
    if (!b) faltantes.push(ENV_PASSWORD.B);
    if (faltantes.length > 0) {
        throw new Error(`[seed-e2e] Faltan variables de entorno (${faltantes.join(", ")}). Aborto sin escribir nada.`);
    }
    return { A: a!, B: b! };
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

async function snapshotIntocables(client: PrismaClient | Prisma.TransactionClient): Promise<IntocableSnapshot[]> {
    const filas = await client.colegio.findMany({
        where: { nombre: { contains: "Sagrado", mode: "insensitive" } },
        select: {
            id: true,
            nombre: true,
            tenantId: true,
            admin: { select: { id: true, email: true } },
        },
    });
    return filas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tenantId: c.tenantId,
        adminId: c.admin?.id ?? null,
        adminEmail: c.admin?.email ?? null,
    }));
}

function assertIntocablesSinCambios(antes: IntocableSnapshot[], despues: IntocableSnapshot[]): void {
    if (antes.length !== despues.length) {
        throw new Error(
            `[seed-e2e] HALLAZGO: número de colegios "Sagrado" cambió (${antes.length} → ${despues.length})`,
        );
    }
    const mapaDespues = new Map(despues.map((c) => [c.id, c]));
    for (const a of antes) {
        const b = mapaDespues.get(a.id);
        if (!b) throw new Error(`[seed-e2e] HALLAZGO: colegio Sagrado desapareció id=${a.id}`);
        if (a.nombre !== b.nombre || a.tenantId !== b.tenantId || a.adminId !== b.adminId || a.adminEmail !== b.adminEmail) {
            throw new Error(
                `[seed-e2e] HALLAZGO: colegio Sagrado modificado id=${a.id} — antes=${JSON.stringify(a)} despues=${JSON.stringify(b)}`,
            );
        }
    }
}

export interface ResultadoRector {
    adminEmail: string;
    adminId: string;
    /** true si esta corrida (re)hasheó la clave (cuenta nueva o clave del entorno distinta). */
    rehashClave: boolean;
}

/**
 * Rector SCHOOL_ADMIN del colegio {letra} con clave ESTABLE del entorno: re-hashea SOLO si la clave
 * cambió (idempotencia del hash, patrón #709/SPEC-612) → una re-siembra NO rota la clave que Calidad
 * tiene guardada, así que no reaparece el 401. Afirma LOGIN POSIBLE (existe + rol + activo + hash que
 * verifica la clave del entorno), no la forma del sembrador. Aislado para el candado de conducta.
 */
export async function upsertRectorColegio(
    tx: Prisma.TransactionClient,
    letra: "A" | "B",
    password: string,
    tenantId: string,
    colegioId: string,
): Promise<ResultadoRector> {
    const emailAdmin = `soporte+e2e-colegio-${letra.toLowerCase()}@innovadataco.com`;
    const existente = await tx.usuario.findUnique({ where: { email: emailAdmin }, select: { passwordHash: true } });
    const claveCoincide = existente ? await verifyPassword(password, existente.passwordHash) : false;
    const passwordHash = claveCoincide ? existente!.passwordHash : await hashPassword(password);

    const admin = await tx.usuario.upsert({
        where: { email: emailAdmin },
        create: {
            email: emailAdmin,
            nombre: `Rector E2E ${letra}`,
            passwordHash,
            rol: "SCHOOL_ADMIN",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
            tenantId,
            colegioId,
        },
        update: {
            passwordHash,
            debeCambiarPassword: false,
            estadoActivacion: "ACTIVO",
            tenantId,
            colegioId,
        },
        select: { id: true, email: true },
    });
    return { adminEmail: admin.email, adminId: admin.id, rehashClave: !claveCoincide };
}

export async function sembrarColegioE2E(
    tx: Prisma.TransactionClient,
    letra: "A" | "B",
    password: string,
    plataformaId: string,
    paisId: string,
    ciudadId: string,
): Promise<ResultadoColegioE2E> {
    const nombreTenant = `e2e-multi-tenant-${letra}`;
    const nombreColegio = `Calidad · Colegio ${letra}`;
    const emailAdmin = `soporte+e2e-colegio-${letra.toLowerCase()}@innovadataco.com`;
    const nombreCurso = "Grado 10 (E2E)";
    const identificadorReporte = `@e2e-${letra}-target`;

    let tenant = await tx.tenant.findFirst({ where: { nombre: nombreTenant } });
    if (!tenant) tenant = await tx.tenant.create({ data: { nombre: nombreTenant } });

    const colegio = await tx.colegio.upsert({
        where: { tenantId: tenant.id },
        create: {
            nombre: nombreColegio,
            nit: `E2E-NIT-${letra}`, // SPEC-320 (§2.2-bis)
            paisId,
            ciudadId,
            representanteLegalNombre: `Representante E2E ${letra}`,
            representanteLegalIdentificacion: `E2E-${letra}-000`,
            representanteLegalEmail: emailAdmin,
            inicioServicio: new Date("2026-01-01T00:00:00Z"),
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
        update: { estado: "activo", nombre: nombreColegio },
    });

    // Rector SCHOOL_ADMIN con clave ESTABLE del entorno (re-hash solo si cambió, patrón #709).
    const { adminEmail, rehashClave } = await upsertRectorColegio(tx, letra, password, tenant.id, colegio.id);

    const curso = await tx.curso.upsert({
        where: {
            colegioId_nombre_grado_anioLectivo: {
                colegioId: colegio.id,
                nombre: nombreCurso,
                grado: "10",
                anioLectivo: "2026",
            },
        },
        create: {
            colegioId: colegio.id,
            nombre: nombreCurso,
            grado: "10",
            anioLectivo: "2026",
            estado: "activo",
        },
        update: {},
    });

    for (const idx of [1, 2] as const) {
        const nombreEstudiante = `Estudiante E2E ${letra}-${idx}`;
        const existente = await tx.estudiante.findFirst({
            where: { cursoId: curso.id, nombre: nombreEstudiante, apellidos: "Prueba" },
            select: { id: true },
        });
        if (!existente) {
            await tx.estudiante.create({
                data: {
                    cursoId: curso.id,
                    colegioId: colegio.id,
                    nombre: nombreEstudiante,
                    apellidos: "Prueba",
                    // SPEC-320 (§2.2-bis): documento del alumno obligatorio y ÚNICO por
                    // (colegioId, documentoTipo, documentoNumero). El número se deriva del `idx`
                    // del bucle → único por alumno y escala solo a N alumnos; con `E2E-EST-${letra}`
                    // a secas el 2º chocaba con el 1º y reventaba la tx en BD fresca (bug latente:
                    // la constraint es de SPEC-320, posterior al sembrador).
                    documentoTipo: "TI",
                    documentoNumero: `E2E-EST-${letra}-${idx}`,
                    estado: "activo",
                },
            });
        }
    }

    const nombreProfesor = `Profesor E2E ${letra}`;
    const profesorExistente = await tx.profesor.findFirst({
        where: { colegioId: colegio.id, nombre: nombreProfesor, apellidos: "Prueba" },
        select: { id: true },
    });
    if (!profesorExistente) {
        await tx.profesor.create({
            data: {
                colegioId: colegio.id,
                nombre: nombreProfesor,
                apellidos: "Prueba",
                // SPEC-320 (§2.2): identidad obligatoria del profesor.
                tipoDocumento: "CC",
                numeroDocumento: `E2E-${colegio.id.slice(-8)}`,
                anioNacimiento: 1985,
                sexo: "OTRO",
                email: `profesor.e2e.${colegio.id.slice(-8)}@example.com`,
                telefono: "+573000000000",
                estado: "activo",
            },
        });
    }

    const reporteExistente = await tx.reporte.findFirst({
        where: { identificador: identificadorReporte, tenantId: tenant.id },
        select: { id: true },
    });
    if (!reporteExistente) {
        const reporte = await crearReporteFixture(tx, {
            data: {
                identificador: identificadorReporte,
                plataformaId,
                texto: encryptParameter(TEXTO_REPORTE),
                fechaIncidente: new Date("2026-08-01T12:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                paisId,
                ciudadId,
                estado: "REVISION_MANUAL",
                esAnonimo: true,
                tenantId: tenant.id,
                numeroSeguimiento: `E2E-${letra}-TARGET`,
            },
        });
        await tx.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OTRO",
                confianza: 0.5,
                modeloUsado: "seed-e2e",
                latenciaMs: 0,
            },
        });
    }

    return {
        letra,
        colegioId: colegio.id,
        adminEmail,
        rehashClave,
    };
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) {
        throw new Error("[seed-e2e] DATABASE_URL requerida");
    }
    if (process.env.NODE_ENV === "test") {
        throw new Error("[seed-e2e] NODE_ENV=test bloqueado — este script no corre en tests");
    }
    if (!process.env.PARAM_ENCRYPTION_KEY) {
        throw new Error("[seed-e2e] PARAM_ENCRYPTION_KEY requerida (cifra el texto del reporte)");
    }
    // Claves ESTABLES del entorno (aborta ANTES de tocar la BD si falta alguna).
    const passwords = leerPasswordsColegios();

    const [plataforma, pais, ciudad] = await Promise.all([
        prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }),
        prisma.pais.findFirst({ where: { OR: [{ codigo: "CO" }, { nombre: "Colombia" }] } }),
        prisma.ciudad.findFirst({ where: { nombre: "Bogotá" } }),
    ]);
    if (!plataforma) throw new Error("[seed-e2e] Plataforma 'whatsapp' faltante — corre `prisma db seed` antes");
    if (!pais) throw new Error("[seed-e2e] País 'Colombia' faltante — corre `prisma db seed` antes");
    if (!ciudad) throw new Error("[seed-e2e] Ciudad 'Bogotá' faltante — corre `prisma db seed` antes");

    const intocablesAntes = await snapshotIntocables(prisma);

    const [resultadoA, resultadoB] = await prisma.$transaction(async (tx) => {
        const a = await sembrarColegioE2E(tx, "A", passwords.A, plataforma.id, pais.id, ciudad.id);
        const b = await sembrarColegioE2E(tx, "B", passwords.B, plataforma.id, pais.id, ciudad.id);
        return [a, b];
    });

    await prisma.auditLog.create({
        data: {
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "SeedE2E",
            ipAddress: "script",
            userAgent: "scripts/seed-e2e-multi-tenant",
            metadatos: {
                origen: "e2e-multi-tenant",
                colegios: [resultadoA.colegioId, resultadoB.colegioId],
                admins: [resultadoA.adminEmail, resultadoB.adminEmail],
                rehashClave: [resultadoA.rehashClave, resultadoB.rehashClave],
                ejecutado: nowCOT(),
            } satisfies Prisma.InputJsonValue,
        },
    });

    const intocablesDespues = await snapshotIntocables(prisma);
    assertIntocablesSinCambios(intocablesAntes, intocablesDespues);

    console.log("");
    console.log("✅ Seed E2E multi-tenant COMPLETO (idempotente).");
    console.log("");
    console.log("La clave viene del ENTORNO (E2E_COLEGIO_{A,B}_ADMIN_PASSWORD) y NO se imprime.");
    console.log("Confirmar en ~/.config/pi-e2e/.env.e2e (email + colegio_id, que sí se generan):");
    console.log("");
    console.log(`E2E_COLEGIO_A_ADMIN_EMAIL=${resultadoA.adminEmail}`);
    console.log(`E2E_COLEGIO_A_ADMIN_COLEGIO_ID=${resultadoA.colegioId}   (clave ${resultadoA.rehashClave ? "(re)fijada" : "ya OK"})`);
    console.log("");
    console.log(`E2E_COLEGIO_B_ADMIN_EMAIL=${resultadoB.adminEmail}`);
    console.log(`E2E_COLEGIO_B_ADMIN_COLEGIO_ID=${resultadoB.colegioId}   (clave ${resultadoB.rehashClave ? "(re)fijada" : "ya OK"})`);
    console.log("");
    console.log(`Ejecutado: ${nowCOT()}`);
}

if (process.argv[1]?.endsWith("seed-e2e-multi-tenant.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[seed-e2e] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
