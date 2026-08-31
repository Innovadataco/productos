/**
 * SPEC-288 (002-PI-188) — Seed E2E multi-tenant.
 *
 * Crea 2 colegios ("Calidad · Colegio A/B") + 2 rectores SCHOOL_ADMIN
 * dedicados (soporte+e2e-colegio-{a,b}@innovadataco.com) + siembra mínima
 * (curso, 2 estudiantes, 1 profesor, 1 reporte OTRO) para desbloquear la
 * Campaña 6 de Calidad (aislamiento multi-tenant, D-89).
 *
 * Idempotente por diseño: correr N veces produce el mismo estado, con
 * regeneración de contraseñas de los rectores para permitir rotación limpia.
 *
 * Marcadores de origen (spec §Ajustes) — el schema no tiene metadatos JSON
 * en Colegio/Usuario/Reporte, así que se usan:
 *   - Tenant.nombre = "e2e-multi-tenant-{A,B}"     ← filtrado principal
 *   - Colegio.nombre = "Calidad · Colegio {A,B}"
 *   - Usuario.email = "soporte+e2e-colegio-{a,b}@innovadataco.com"
 *   - AuditLog.metadatos.origen = "e2e-multi-tenant" (al cierre)
 *
 * Candados: cero DROP/TRUNCATE/DELETE, cero cambios a "Sagrado corazón",
 * rectores por Prisma directo (NO por /api/auth/register), guard NODE_ENV
 * y PARAM_ENCRYPTION_KEY antes de tocar la BD.
 *
 * Uso (dev):
 *   node --env-file=.env --import tsx scripts/seed-e2e-multi-tenant.ts
 *
 * PRODUCCIÓN: NO lo corre ODIN. Lo ejecuta el responsable del despliegue
 * tras directriz explícita del CEO (spec §Candados).
 */
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
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
    adminPassword: string;
}

const ALFANUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const SIMBOLOS = "!@#$%^&*";
const TEXTO_REPORTE = "Reporte de prueba E2E multi-tenant. NO tocar.";

function generarPassword(): string {
    // 15 chars alfanuméricos + 1 símbolo posicionado aleatoriamente = 16 chars.
    const bytes = randomBytes(15);
    const chars = Array.from(bytes, (b) => ALFANUM[b % ALFANUM.length]).join("");
    const simbolo = SIMBOLOS[randomBytes(1)[0]! % SIMBOLOS.length]!;
    const pos = randomBytes(1)[0]! % (chars.length + 1);
    return chars.slice(0, pos) + simbolo + chars.slice(pos);
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

async function sembrarColegioE2E(
    tx: Prisma.TransactionClient,
    letra: "A" | "B",
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

    const password = generarPassword();
    const passwordHash = await hashPassword(password);

    const admin = await tx.usuario.upsert({
        where: { email: emailAdmin },
        create: {
            email: emailAdmin,
            nombre: `Rector E2E ${letra}`,
            passwordHash,
            rol: "SCHOOL_ADMIN",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
            tenantId: tenant.id,
            colegioId: colegio.id,
        },
        update: {
            passwordHash,
            debeCambiarPassword: false,
            estadoActivacion: "ACTIVO",
            tenantId: tenant.id,
            colegioId: colegio.id,
        },
    });

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
        const reporte = await tx.reporte.create({
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
        adminEmail: admin.email,
        adminPassword: password,
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
        const a = await sembrarColegioE2E(tx, "A", plataforma.id, pais.id, ciudad.id);
        const b = await sembrarColegioE2E(tx, "B", plataforma.id, pais.id, ciudad.id);
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
                regeneradoContrasenas: true,
                ejecutado: nowCOT(),
            } satisfies Prisma.InputJsonValue,
        },
    });

    const intocablesDespues = await snapshotIntocables(prisma);
    assertIntocablesSinCambios(intocablesAntes, intocablesDespues);

    console.log("");
    console.log("✅ Seed E2E multi-tenant COMPLETO (idempotente).");
    console.log("");
    console.log("Copiar en ~/.config/pi-e2e/.env.e2e:");
    console.log("");
    console.log(`E2E_COLEGIO_A_ADMIN_EMAIL=${resultadoA.adminEmail}`);
    console.log(`E2E_COLEGIO_A_ADMIN_PASSWORD=${resultadoA.adminPassword}`);
    console.log(`E2E_COLEGIO_A_ADMIN_COLEGIO_ID=${resultadoA.colegioId}`);
    console.log("");
    console.log(`E2E_COLEGIO_B_ADMIN_EMAIL=${resultadoB.adminEmail}`);
    console.log(`E2E_COLEGIO_B_ADMIN_PASSWORD=${resultadoB.adminPassword}`);
    console.log(`E2E_COLEGIO_B_ADMIN_COLEGIO_ID=${resultadoB.colegioId}`);
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
