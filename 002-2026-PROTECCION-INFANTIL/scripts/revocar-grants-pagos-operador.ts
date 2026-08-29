/**
 * SPEC-263 (002-PI-164) — revoca el grant pagos_admin del rol OPERADOR en
 * bases de datos existentes.
 * SPEC-266 (002-PI-169) — revoca bandeja_reportes y denuncia_formal del rol
 * COMITE_VALIDACION (I-128: grants indebidos).
 *
 * Contexto: seed-modulos-grants.ts es aditivo y NUNCA revoca (CANDADO §5.5).
 * Las BD vivas conservan grants activos aunque el seed los haya eliminado.
 * Este script los desactiva de forma idempotente y NO destructiva:
 *   - NO borra filas de PermisoModulo (quedan revocadas, restaurables por ADMIN).
 *   - NO borra módulos del catálogo.
 *   - Solo toca los roles y módulos explicitados abajo.
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

// SPEC-266 (002-PI-169): bandeja_reportes y denuncia_formal eran indebidos para COMITE (I-128).
const ROL_COMITE = "COMITE_VALIDACION";
const MODULOS_INDEBIDOS_COMITE = ["bandeja_reportes", "denuncia_formal"] as const;

export async function revocarGrantsComiteIndebidos(client: PrismaClient = prisma): Promise<ResultadoRevocacion> {
    const modulos = await client.moduloPermisible.findMany({
        where: { clave: { in: [...MODULOS_INDEBIDOS_COMITE] } },
        select: { id: true, clave: true },
    });
    if (modulos.length !== MODULOS_INDEBIDOS_COMITE.length) {
        const halladas = modulos.map((m) => m.clave).join(", ") || "(ninguna)";
        throw new Error(
            `[RevocacionComiteIndebidos] Catálogo incompleto: se esperaba ${MODULOS_INDEBIDOS_COMITE.join(", ")} y existe ${halladas}. ` +
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
    // --- OPERADOR: pagos_admin ---
    const idsOperador = (
        await prisma.moduloPermisible.findMany({
            where: { clave: { in: [...MODULOS_MUERTOS] } },
            select: { id: true },
        })
    ).map((m) => m.id);

    const antesOperador = await prisma.permisoModulo.findMany({
        where: { rol: ROL },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionPagosOperador] Antes: ${antesOperador.length} grants del OPERADOR ` +
        `(${antesOperador.filter((p) => p.activo).map((p) => p.modulo.clave).join(", ") || "ninguno activo"})`
    );

    const resOperador = await revocarGrantsPagosOperador();
    console.log(
        `[RevocacionPagosOperador] Revocación: completada — ${resOperador.revocados} grants desactivados ` +
        `(${MODULOS_MUERTOS.join(", ")}), ${resOperador.yaInactivos} ya estaban inactivos`
    );

    const despuesOperador = await prisma.permisoModulo.findMany({
        where: { rol: ROL, activo: true, moduloId: { notIn: idsOperador } },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionPagosOperador] Después: grants activos del OPERADOR = ${despuesOperador.map((p) => p.modulo.clave).join(", ") || "(ninguno)"}`
    );

    // --- COMITE_VALIDACION: bandeja_reportes, denuncia_formal ---
    const idsComite = (
        await prisma.moduloPermisible.findMany({
            where: { clave: { in: [...MODULOS_INDEBIDOS_COMITE] } },
            select: { id: true },
        })
    ).map((m) => m.id);

    const antesComite = await prisma.permisoModulo.findMany({
        where: { rol: ROL_COMITE },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionComiteIndebidos] Antes: ${antesComite.length} grants del COMITE_VALIDACION ` +
        `(${antesComite.filter((p) => p.activo).map((p) => p.modulo.clave).join(", ") || "ninguno activo"})`
    );

    const resComite = await revocarGrantsComiteIndebidos();
    console.log(
        `[RevocacionComiteIndebidos] Revocación: completada — ${resComite.revocados} grants desactivados ` +
        `(${MODULOS_INDEBIDOS_COMITE.join(", ")}), ${resComite.yaInactivos} ya estaban inactivos`
    );

    const despuesComite = await prisma.permisoModulo.findMany({
        where: { rol: ROL_COMITE, activo: true, moduloId: { notIn: idsComite } },
        include: { modulo: { select: { clave: true } } },
    });
    console.log(
        `[RevocacionComiteIndebidos] Después: grants activos del COMITE_VALIDACION = ${despuesComite.map((p) => p.modulo.clave).join(", ") || "(ninguno)"}`
    );
}

if (process.argv[1]?.endsWith("revocar-grants-pagos-operador.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[Revocacion] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
