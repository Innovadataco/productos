/**
 * Backfill del catálogo de módulos y grants por rol — FUENTE ÚNICA DE VERDAD.
 * Usado por `prisma/seed.ts` y por `scripts/sync-modulos-grants.ts` (002-PI-048).
 * ADITIVO e idempotente: crea módulos y grants faltantes, NUNCA revoca ni borra.
 */
import { PrismaClient, TipoParametro, CategoriaParametro } from "@prisma/client";
import { CATALOGO_MODULOS } from "../src/lib/permisos-catalogo";

export interface ResultadoSyncModulos {
    modulosCatalogo: number;
    modulosCreados: number;
    permisosCreados: number;
}

export async function syncModulosYGrants(prisma: PrismaClient): Promise<ResultadoSyncModulos> {
    // ── Permisos de módulos por rol (spec 019) ─────────────────────────────
    const modulosSeed = CATALOGO_MODULOS;
    let modulosCreados = 0;

    const moduloIds = new Map<string, string>();
    for (const m of modulosSeed.filter((x) => !x.padre)) {
        const existente = await prisma.moduloPermisible.findUnique({ where: { clave: m.clave }, select: { id: true } });
        if (!existente) modulosCreados++;
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden },
        });
        moduloIds.set(m.clave, row.id);
    }
    for (const m of modulosSeed.filter((x) => x.padre)) {
        const padreId = moduloIds.get(m.padre!);
        if (!padreId) throw new Error(`Padre no encontrado para ${m.clave}`);
        const existente = await prisma.moduloPermisible.findUnique({ where: { clave: m.clave }, select: { id: true } });
        if (!existente) modulosCreados++;
        const row = await prisma.moduloPermisible.upsert({
            where: { clave: m.clave },
            update: { nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
            create: { clave: m.clave, nombre: m.nombre, categoria: m.categoria, esCritico: m.esCritico ?? false, orden: m.orden, padreId },
        });
        moduloIds.set(m.clave, row.id);
    }

    // Backfill: reproduce el acceso implícito actual por rol (denegar por defecto al resto).
    const clavesPorRol: Record<string, string[]> = {
        ADMIN: modulosSeed.map((m) => m.clave),
        SCHOOL_ADMIN: ["colegios", "colegios_gestion", "colegios_auditoria", "colegios_comite", "colegios_comite_bandeja"],
        // SPEC-168 (Fase F): el Comité de Convivencia accede solo a su bandeja de casos.
        COMITE_CONVIVENCIA: ["colegios_comite_bandeja"],
        OPERADOR: ["bandeja_reportes"],
        // SPEC-128 (D-43): el comité solo recibe su bandeja. "comite" y "comite_auditoria"
        // mapean a rutas ADMIN_ONLY (proxy.ts) que la puerta le niega: el seed ya no dice
        // SÍ donde la puerta dice NO. Los módulos siguen en el catálogo (ADMIN los usa) y
        // las BD existentes se reconcilian con scripts/revocar-grants-comite-muertos.ts.
        // SPEC-140 (decisión ZEUS): denuncia_formal por defecto para ADMIN y
        // COMITE_VALIDACION; como es hijo de bandeja_reportes (jerarquía AND), el comité
        // también recibe el padre.
        COMITE_VALIDACION: ["comite_bandeja", "bandeja_reportes", "denuncia_formal"],
    };
    let permisosCreados = 0;
    for (const [rol, claves] of Object.entries(clavesPorRol)) {
        for (const clave of claves) {
            const moduloId = moduloIds.get(clave)!;
            const existente = await prisma.permisoModulo.findUnique({
                where: { rol_moduloId: { rol, moduloId } },
            });
            if (!existente) {
                await prisma.permisoModulo.create({
                    data: { rol, moduloId, activo: true },
                });
                permisosCreados++;
            }
        }
    }

    await prisma.parametroSistema.upsert({
        where: { clave: "seguridad.permisos_roles_protegidos" },
        update: {},
        create: {
            clave: "seguridad.permisos_roles_protegidos",
            valor: JSON.stringify(["ADMIN"]),
            tipo: TipoParametro.STRING_ARRAY,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Roles protegidos por el anti-lockout de permisos de módulos",
        },
    });

    return { modulosCatalogo: modulosSeed.length, modulosCreados, permisosCreados };
}
