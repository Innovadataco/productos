/**
 * SPEC-285 (002-PI-185) — revoca los grants de 3 módulos muertos del catálogo
 * (ia_eval, apelaciones, padre) en bases de datos existentes.
 *
 * Contexto: seed-modulos-grants.ts es aditivo y NUNCA revoca (CANDADO §5.5).
 * Las BD vivas conservan filas activas de PermisoModulo aunque el catálogo TS
 * ya no incluya el módulo:
 *   - ia_eval    → retirado del catálogo por SPEC-068 fase 2 (retiro Experimentos).
 *   - apelaciones → retirado por SPEC-109 (eliminación del módulo de apelación).
 *   - padre      → retirado por SPEC-285 (este SPEC, ver spec.md).
 *
 * Comportamiento (idempotente, NO destructivo):
 *   - Desactiva PermisoModulo.activo=false para las 3 claves, para TODOS los roles.
 *   - NO borra filas de PermisoModulo (quedan revocadas, restaurables por ADMIN).
 *   - NO borra filas de ModuloPermisible (candado del INSTRUCTIVO §Alcance 2).
 *   - Si el catálogo prod no tiene alguna clave (BD limpia), el script simplemente
 *     no encuentra el módulo — no falla.
 *
 * AuditLog: LOGS_MANTENIMIENTO_PURGA + metadatos.tipo="revocacion_modulos_muertos".
 *
 * Uso (cargar el DATABASE_URL del entorno correspondiente):
 *   node --env-file=.env --import tsx scripts/revocar-grants-modulos-muertos.ts
 *
 * PRODUCCIÓN: NO lo corre ODIN. Lo ejecuta el responsable del despliegue.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const MODULOS_MUERTOS = ["ia_eval", "apelaciones", "padre"] as const;

export interface ResultadoRevocacionModulosMuertos {
    /** Grants que pasaron de activo=true a activo=false en esta corrida. */
    revocados: number;
    /** Grants sobre esos módulos que ya estaban inactivos. */
    yaInactivos: number;
    /** Claves de módulo halladas en el catálogo de la BD (subset de MODULOS_MUERTOS). */
    modulosHallados: string[];
}

export async function revocarGrantsModulosMuertos(
    client: PrismaClient = prisma,
): Promise<ResultadoRevocacionModulosMuertos> {
    const modulos = await client.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_MUERTOS] } },
        select: { id: true, clave: true },
    });
    const ids = modulos.map((m) => m.id);
    if (ids.length === 0) {
        return { revocados: 0, yaInactivos: 0, modulosHallados: [] };
    }

    const yaInactivos = await client.permisoModulo.count({
        where: { moduloId: { in: ids }, activo: false },
    });

    return client.$transaction(async (tx) => {
        const res = await tx.permisoModulo.updateMany({
            where: { moduloId: { in: ids }, activo: true },
            data: { activo: false },
        });
        await tx.auditLog.create({
            data: {
                accion: "LOGS_MANTENIMIENTO_PURGA",
                tipoRecurso: "PermisoModulo",
                ipAddress: "script",
                userAgent: "scripts/revocar-grants-modulos-muertos",
                metadatos: {
                    tipo: "revocacion_modulos_muertos",
                    modulos: modulos.map((m) => m.clave),
                    filasRevocadas: res.count,
                    yaInactivos,
                },
            },
        });
        return { revocados: res.count, yaInactivos, modulosHallados: modulos.map((m) => m.clave) };
    });
}

async function main(): Promise<void> {
    const antes = await prisma.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_MUERTOS] } },
        include: {
            _count: { select: { permisos: { where: { activo: true } } } },
        },
    });
    if (antes.length === 0) {
        console.log(
            "[RevocacionModulosMuertos] Ningún módulo muerto en el catálogo de esta BD " +
                `(esperados: ${MODULOS_MUERTOS.join(", ")}). Nada que revocar.`,
        );
        return;
    }
    console.log(
        `[RevocacionModulosMuertos] Antes: ${antes.length} módulos hallados — ` +
            antes.map((m) => `${m.clave}(${m._count.permisos} activos)`).join(", "),
    );

    const resultado = await revocarGrantsModulosMuertos();
    console.log(
        `[RevocacionModulosMuertos] Revocación: completada — ${resultado.revocados} grants desactivados ` +
            `(${resultado.modulosHallados.join(", ")}), ${resultado.yaInactivos} ya estaban inactivos`,
    );

    const despues = await prisma.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_MUERTOS] } },
        include: {
            _count: { select: { permisos: { where: { activo: true } } } },
        },
    });
    console.log(
        "[RevocacionModulosMuertos] Después: " +
            despues.map((m) => `${m.clave}(${m._count.permisos} activos)`).join(", "),
    );
}

if (process.argv[1]?.endsWith("revocar-grants-modulos-muertos.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[RevocacionModulosMuertos] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
