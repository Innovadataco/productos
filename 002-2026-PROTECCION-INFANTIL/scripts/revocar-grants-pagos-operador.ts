/**
 * SPEC-263 (002-PI-164) — revoca el grant pagos_admin del rol OPERADOR en
 * bases de datos existentes.
 *
 * Contexto: seed-modulos-grants.ts era aditivo y sembró pagos_admin para OPERADOR
 * (SPEC-212, D-43). El nuevo seed ya NO lo incluye, pero sync-modulos-grants.ts
 * NUNCA revoca: las BD vivas conservan el grant activo. Este script lo desactiva
 * de forma idempotente y NO destructiva:
 *   - NO borra filas de PermisoModulo (quedan revocadas, restaurables por ADMIN).
 *   - NO borra el módulo del catálogo (ADMIN lo sigue usando).
 *   - NO toca ningún otro rol.
 *
 * Uso (cargar el DATABASE_URL del entorno correspondiente):
 *   node --env-file=.env --import tsx scripts/revocar-grants-pagos-operador.ts
 *
 * PRODUCCIÓN: NO lo corre ODIN. Lo ejecuta el responsable del despliegue siguiendo
 * el paso documentado en specs/263-permisos-operador/quickstart.md.
 */
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const ROL = "OPERADOR";
const MODULOS_MUERTOS = ["pagos_admin"] as const;

export interface ResultadoRevocacion {
    /** Grants que pasaron de activo=true a activo=false en esta corrida. */
    revocados: number;
    /** Grants del rol sobre esos módulos que ya estaban inactivos. */
    yaInactivos: number;
}

export async function revocarGrantsPagosOperador(client: PrismaClient = prisma): Promise<ResultadoRevocacion> {
    const modulos = await client.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_MUERTOS] } },
        select: { id: true, clave: true },
    });
    if (modulos.length !== MODULOS_MUERTOS.length) {
        const halladas = modulos.map((m) => m.clave).join(", ") || "(ninguna)";
        throw new Error(
            `[RevocacionPagosOperador] Catálogo incompleto: se esperaba ${MODULOS_MUERTOS.join(", ")} y existe ${halladas}. ` +
            "Corre el seed primero; el script no crea ni borra módulos."
        );
    }
    const ids = modulos.map((m) => m.id);

    const yaInactivos = await client.permisoModulo.count({
        where: { rol: ROL, moduloId: { in: ids }, activo: false },
    });
    const resultado = await client.permisoModulo.updateMany({
        where: { rol: ROL, moduloId: { in: ids }, activo: true },
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
        where: { rol: ROL },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionPagosOperador] Antes: ${antes.length} grants del OPERADOR ` +
        `(${antes.filter((p) => p.activo).map((p) => p.modulo.clave).join(", ") || "ninguno activo"})`
    );

    const resultado = await revocarGrantsPagosOperador();
    console.log(
        `[RevocacionPagosOperador] Revocación: completada — ${resultado.revocados} grants desactivados ` +
        `(${MODULOS_MUERTOS.join(", ")}), ${resultado.yaInactivos} ya estaban inactivos`
    );

    const despues = await prisma.permisoModulo.findMany({
        where: { rol: ROL, activo: true, moduloId: { notIn: ids } },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionPagosOperador] Después: grants activos del OPERADOR = ${despues.map((p) => p.modulo.clave).join(", ") || "(ninguno)"}`
    );
}

if (process.argv[1]?.endsWith("revocar-grants-pagos-operador.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[RevocacionPagosOperador] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
