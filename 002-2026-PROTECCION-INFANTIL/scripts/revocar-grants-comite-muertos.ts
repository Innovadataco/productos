/**
 * SPEC-128 (D-43, Opción A aprobada por ZEUS) — revoca los grants muertos del comité
 * en bases de datos existentes.
 *
 * Contexto: el seed anterior concedía a COMITE_VALIDACION los módulos "comite" y
 * "comite_auditoria", cuyas rutas (/dashboard/admin/comite/gestion y .../auditoria) son
 * ADMIN_ONLY en proxy.ts — la puerta se las niega. El seed nuevo (D-43) ya no los siembra,
 * pero el backfill nunca revoca: las BD vivas conservan los grants. Este script los
 * desactiva (activo = false), de forma idempotente y NO destructiva:
 *   - NO borra filas de PermisoModulo (quedan revocadas, revocables por un ADMIN).
 *   - NO borra los módulos del catálogo (ADMIN los sigue usando).
 *   - NO toca ningún otro rol.
 *
 * Uso (por entorno, con el DATABASE_URL correspondiente cargado):
 *   node --env-file=.env --import tsx scripts/revocar-grants-comite-muertos.ts
 *
 * PRODUCCIÓN: NO lo corre ODIN. Lo ejecuta el responsable del despliegue siguiendo el
 * paso documentado en specs/128-reconciliacion-grants-comite/quickstart.md.
 */
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const ROL_COMITE = "COMITE_VALIDACION";
const MODULOS_MUERTOS = ["comite", "comite_auditoria"] as const;

export interface ResultadoRevocacion {
    /** Grants que pasaron de activo=true a activo=false en esta corrida. */
    revocados: number;
    /** Grants del comité sobre esos módulos que ya estaban inactivos. */
    yaInactivos: number;
}

export async function revocarGrantsComiteMuertos(client: PrismaClient = prisma): Promise<ResultadoRevocacion> {
    const modulos = await client.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_MUERTOS] } },
        select: { id: true, clave: true },
    });
    if (modulos.length !== MODULOS_MUERTOS.length) {
        const halladas = modulos.map((m) => m.clave).join(", ") || "(ninguna)";
        throw new Error(
            `[RevocacionComite] Catálogo incompleto: se esperaban ${MODULOS_MUERTOS.join(", ")} y existen ${halladas}. ` +
            "Corre el seed primero; el script no crea ni borra módulos."
        );
    }
    const ids = modulos.map((m) => m.id);

    const yaInactivos = await client.permisoModulo.count({
        where: { rol: ROL_COMITE, moduloId: { in: ids }, activo: false },
    });
    const resultado = await client.permisoModulo.updateMany({
        where: { rol: ROL_COMITE, moduloId: { in: ids }, activo: true },
        data: { activo: false },
    });
    return { revocados: resultado.count, yaInactivos };
}

async function main() {
    const ids = (
        await prisma.moduloPermisible.findMany({
            where: { clave: { in: [...MODULOS_MUERTOS] } },
            select: { id: true },
        })
    ).map((m) => m.id);

    const antes = await prisma.permisoModulo.findMany({
        where: { rol: ROL_COMITE },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionComite] Antes: ${antes.length} grants del comité ` +
        `(${antes.filter((p) => p.activo).map((p) => p.modulo.clave).join(", ") || "ninguno activo"})`
    );

    const resultado = await revocarGrantsComiteMuertos();
    console.log(
        `[RevocacionComite] Revocación: completada — ${resultado.revocados} grants desactivados ` +
        `(${MODULOS_MUERTOS.join(", ")}), ${resultado.yaInactivos} ya estaban inactivos`
    );

    const despues = await prisma.permisoModulo.findMany({
        where: { rol: ROL_COMITE, activo: true, moduloId: { notIn: ids } },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionComite] Después: grants activos del comité = ${despues.map((p) => p.modulo.clave).join(", ") || "(ninguno)"}`
    );
}

if (process.argv[1]?.endsWith("revocar-grants-comite-muertos.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[RevocacionComite] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
