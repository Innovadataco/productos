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

export async function resetDatabase() {
    // El aislamiento real lo proporciona test-setup.ts con un mutex en BD;
    // este reset solo limpia y re-seedea de forma atómica con TRUNCATE CASCADE.
    const rows: { tablename: string }[] = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const tables = rows
        .map((r) => r.tablename)
        .filter((t) => !EXCLUDED_TABLES.has(t))
        .map((t) => `"${t}"`)
        .join(", ");
    if (tables) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`);
    }
    await otorgarTodosLosPermisos();
    // Algunos tests dan por sentado que ciertos catálogos estáticos existen
    // (ej. plataforma "whatsapp" en asignador.test.ts). Se aseguran aquí para
    // que la suite sea autocontenida aunque la BD de test no haya corrido seed.
    await asegurarPlataformas();
}
