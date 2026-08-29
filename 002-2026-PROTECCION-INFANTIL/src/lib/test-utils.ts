import { prisma } from "./prisma";
import { CATALOGO_MODULOS } from "./permisos-catalogo";
import { RolUsuario } from "@prisma/client";

/**
 * Tras el reset, otorga a TODOS los roles del enum acceso a todo el catálogo:
 * reproduce el comportamiento implícito que los tests existentes asumen (los
 * guards de módulo son una capa adicional, no un reemplazo). Los tests de
 * permisos crean sus propios módulos/permisos y no se ven afectados.
 */
export async function otorgarTodosLosPermisos() {
    const moduloIds = new Map<string, string>();
    for (const m of CATALOGO_MODULOS.filter((x) => !x.padre)) {
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const m of CATALOGO_MODULOS.filter((x) => x.padre)) {
        const padreId = moduloIds.get(m.padre!)!;
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const rol of Object.values(RolUsuario)) {
        for (const moduloId of moduloIds.values()) {
            await prisma.permisoModulo.upsert({
                where: { rol_moduloId: { rol, moduloId } },
                update: { activo: true },
                create: { rol, moduloId, activo: true },
            });
        }
    }
}

const EXCLUDED_TABLES = new Set([
    "_prisma_migrations",
    "TestMutex",
    // Catálogos estáticos sembrados por prisma/seed.ts; truncarlos rompe tests
    // que los dan por sentado (ej. asignador.test.ts busca plataforma "whatsapp").
    "Pais",
    "Departamento",
    "Ciudad",
    "Plataforma",
]);

async function asegurarPlataformas() {
    const plataformas = [
        { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
        { clave: "instagram", nombre: "Instagram", categoria: "red_social" },
        { clave: "tiktok", nombre: "TikTok", categoria: "red_social" },
        { clave: "facebook", nombre: "Facebook", categoria: "red_social" },
        { clave: "minecraft", nombre: "Minecraft", categoria: "juego" },
        { clave: "telegram", nombre: "Telegram", categoria: "mensajeria" },
        { clave: "snapchat", nombre: "Snapchat", categoria: "red_social" },
        { clave: "otro", nombre: "Otra plataforma", categoria: "otro" },
    ];
    for (const pl of plataformas) {
        await prisma.plataforma.upsert({
            where: { clave: pl.clave },
            update: {},
            create: pl,
        });
    }
}

async function truncateAtomic(tablas: string[]): Promise<void> {
    if (tablas.length === 0) return;
    const listado = tablas.map((t) => `"${t}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${listado} CASCADE`);
}

async function obtenerTablasDePGTables(): Promise<string[]> {
    const rows: { tablename: string }[] = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    return rows.map((r) => r.tablename).filter((t) => !EXCLUDED_TABLES.has(t));
}

/**
 * SPEC-282 (002-PI-180): variante con lista explícita de tablas.
 *
 * - `resetDatabase()` (sin args): vacía las 96 tablas de `pg_tables` menos las
 *   excluidas (comportamiento actual, sin cambios).
 * - `resetDatabase(["Usuario", "Reporte"])`: vacía SOLO esas tablas (más las que
 *   caen por CASCADE). Ignora silenciosamente las que estén en `EXCLUDED_TABLES`.
 *   Lanza error si alguna no existe en `pg_tables`.
 * - `resetDatabase([])`: NO trunca nada, pero SÍ ejecuta seed de permisos y
 *   plataformas (mantiene la parte determinista del reset).
 *
 * En los tres casos, ejecuta `otorgarTodosLosPermisos()` + `asegurarPlataformas()`
 * al final para mantener el mismo contrato de estado inicial.
 */
export async function resetDatabase(tablas?: string[]): Promise<void> {
    // El aislamiento real lo proporciona test-setup.ts con un mutex en BD;
    // este reset solo limpia y re-seedea de forma atómica con TRUNCATE CASCADE.
    if (!Array.isArray(tablas)) {
        await truncateAtomic(await obtenerTablasDePGTables());
    } else if (tablas.length > 0) {
        const efectivas: string[] = [];
        for (const t of tablas) {
            if (EXCLUDED_TABLES.has(t)) {
                console.error(`[resetDatabase] tabla excluida ignorada: ${t}`);
                continue;
            }
            efectivas.push(t);
        }
        if (efectivas.length > 0) {
            const rows: { tablename: string }[] = await prisma.$queryRaw`
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename = ANY(${efectivas})
            `;
            const existentes = new Set(rows.map((r) => r.tablename));
            const faltantes = efectivas.filter((t) => !existentes.has(t));
            if (faltantes.length > 0) {
                throw new Error(`Tabla no encontrada en pg_tables: ${faltantes.join(", ")}`);
            }
            await truncateAtomic(efectivas);
        }
    }
    // tablas === [] → salta el TRUNCATE, cae directo a los seeds.
    await otorgarTodosLosPermisos();
    // Algunos tests dan por sentado que ciertos catálogos estáticos existen
    // (ej. plataforma "whatsapp" en asignador.test.ts). Se aseguran aquí para
    // que la suite sea autocontenida aunque la BD de test no haya corrido seed.
    await asegurarPlataformas();
}
