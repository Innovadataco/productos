import { prisma } from "./prisma";
import { CATALOGO_MODULOS } from "./permisos-catalogo";
import { syncModulosYGrants } from "../../prisma/seed-modulos-grants";
import { RolUsuario } from "@prisma/client";

/**
 * SPEC-443 (I-309): tras el reset, el arnés siembra EXACTAMENTE el mismo mapa de
 * permisos que producción — la fuente única `syncModulosYGrants` de
 * `prisma/seed-modulos-grants.ts` (NO una copia: el mismo módulo importado, para que
 * no puedan separarse). Antes encendía 43 módulos × 8 roles («otorgar TODOS»), lo que
 * hacía pasar en verde tests de acceso que en prod daban 403 (I-278) y candados de
 * bloqueo que nunca morían. Un escenario que necesite un módulo que su rol NO tiene
 * en prod lo concede explícitamente en el propio test; prohibido volver a encender todo.
 */
export async function sembrarPermisosDeProduccion(): Promise<void> {
    await syncModulosYGrants(prisma);
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
 * En los tres casos, ejecuta `sembrarPermisosDeProduccion()` + `asegurarPlataformas()`
 * al final para mantener el mismo contrato de estado inicial.
 */
/**
 * SPEC-352 (hotfix 01-09-2026): guard duro del reset. `resetDatabase` TRUNCA
 * la base que apunte DATABASE_URL, sea cual sea — y el 01-09-2026 la BD dev
 * compartida de la Mac amaneció ARRASADA dos veces (0 colegios, 0 parámetros;
 * huella de plataformas del propio reset) por una suite de integración corrida
 * con el env equivocado. Regla: solo se trunca una base cuyo NOMBRE contenga
 * "test". Cualquier otra cosa es un error de configuración y se aborta EN VOZ
 * ALTA antes de tocar una sola fila.
 *
 * Exportada pura para poder testearla sin base de datos.
 */
export function validarBdDeTest(databaseUrl: string | undefined): void {
    const url = databaseUrl ?? "";
    const nombreBd = url.split("/").pop()?.split("?")[0] ?? "";
    if (!nombreBd.includes("test")) {
        throw new Error(
            `[resetDatabase] BLOQUEADO: DATABASE_URL apunta a "${nombreBd || "(vacía)"}", que no parece una base de test. ` +
                "Este guard existe porque la BD dev compartida fue arrasada por un reset mal dirigido (01-09-2026). " +
                "Corre los tests con .env.test o corrige DATABASE_URL.",
        );
    }
}

export async function resetDatabase(tablas?: string[]): Promise<void> {
    // SPEC-352: primero el guard — nunca truncar una base que no sea de test.
    validarBdDeTest(process.env.DATABASE_URL);
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
    await sembrarPermisosDeProduccion();
    // Algunos tests dan por sentado que ciertos catálogos estáticos existen
    // (ej. plataforma "whatsapp" en asignador.test.ts). Se aseguran aquí para
    // que la suite sea autocontenida aunque la BD de test no haya corrido seed.
    await asegurarPlataformas();
}
