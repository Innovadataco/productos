/**
 * SPEC-817 · globalSetup de INTEGRACIÓN (y journeys). Corre UNA vez, en el proceso principal, antes de los forks.
 *
 *  - Régimen DERIVADO (local, sin DATABASE_URL en el entorno): asegura que la base POR WORKTREE exista
 *    (la crea si falta) y la pone al día con `prisma migrate deploy`. Un worktree nuevo «solo funciona»:
 *    imposibilidad estructural de compartir base, sin convención que recordar.
 *  - Régimen ENTORNO (CI, DATABASE_URL provisto): NO crea ni migra —eso lo hace el workflow— y la derivación
 *    no se dispara. CI no cambia.
 *  - En AMBOS regímenes: VERIFICA el esquema (pieza 2) y, si la base está atrás del repo, ABORTA con un
 *    mensaje que DICE «esquema desactualizado» — no deja que un test caiga como si fuera un defecto.
 *
 * El reset `TRUNCATE` de la suite (515 archivos) queda INTACTO: acá no se toca la disciplina, solo el destino.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { RESOLUCION_DATABASE_URL } from "./test-db-url";
import {
    dirMigracionesPorDefecto,
    mensajeEsquemaDesactualizado,
    migracionesEnCarpeta,
    migracionesFaltantes,
} from "./test-esquema";

// Raíz del paquete (…/002-2026-PROTECCION-INFANTIL) derivada de la UBICACIÓN de este módulo (src/lib/…), no de
// `process.cwd()`: así `prisma migrate deploy` y la lectura de migraciones encuentran el esquema sin importar
// desde dónde lanzó vitest (el cwd del globalSetup no es fiable; por eso el primer intento no aplicó nada).
const RAIZ_PAQUETE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ESQUEMA = path.join(RAIZ_PAQUETE, "prisma", "schema.prisma");

function urlDeMantenimiento(url: string): string {
    const u = new URL(url);
    u.pathname = "/postgres"; // base de mantenimiento para CREATE DATABASE
    return u.toString();
}

function nombreBaseDeUrl(url: string): string {
    return new URL(url).pathname.replace(/^\//, "");
}

async function asegurarBaseExiste(url: string, base: string): Promise<void> {
    const client = new PrismaClient({ datasources: { db: { url: urlDeMantenimiento(url) } } });
    try {
        const filas = await client.$queryRawUnsafe<Array<{ ok: number }>>(
            "SELECT 1 AS ok FROM pg_database WHERE datname = $1",
            base,
        );
        if (filas.length === 0) {
            // `base` sale de nuestra derivación saneada a [a-z0-9_]; interpolar es seguro (CREATE DATABASE no admite parámetro).
            await client.$executeRawUnsafe(`CREATE DATABASE "${base}"`);
            console.log(`[SPEC-817] Base de pruebas por worktree creada: ${base}`);
        }
    } finally {
        await client.$disconnect();
    }
}

async function verificarEsquemaAlDia(url: string, base: string): Promise<void> {
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
        let aplicadas: string[];
        try {
            const filas = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
                'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
            );
            aplicadas = filas.map((f) => f.migration_name);
        } catch {
            // Sin `_prisma_migrations` = base sin migrar: todas faltan. Mensaje claro, no un error de Prisma crudo.
            aplicadas = [];
        }
        const enCarpeta = migracionesEnCarpeta(dirMigracionesPorDefecto(RAIZ_PAQUETE));
        const faltan = migracionesFaltantes(aplicadas, enCarpeta);
        if (faltan.length > 0) {
            throw new Error(mensajeEsquemaDesactualizado(faltan, base));
        }
    } finally {
        await client.$disconnect();
    }
}

export default async function setup(): Promise<void> {
    // Régimen CONGELADO al importar test-db-url (antes de que su efecto mutara process.env): "derivada" en
    // local → provisiona; "entorno" en CI → respeta y no toca. Re-resolver acá daría siempre "entorno".
    const { url, origen } = RESOLUCION_DATABASE_URL;
    process.env.DATABASE_URL = url;
    const base = nombreBaseDeUrl(url);

    if (origen === "derivada") {
        await asegurarBaseExiste(url, base);
        execSync(`npx prisma migrate deploy --schema "${ESQUEMA}"`, {
            env: { ...process.env, DATABASE_URL: url },
            stdio: "pipe",
            cwd: RAIZ_PAQUETE,
        });
    }

    await verificarEsquemaAlDia(url, base);
}
