/**
 * SPEC-381 (I-274) — Revoca el grant de `comite_guias_accion` para el rol
 * ADMIN en bases de datos existentes. Idempotente y NO destructivo.
 *
 * Contexto: `seed-modulos-grants.ts` histórico daba TODOS los módulos al ADMIN
 * (`ADMIN: modulosSeed.map((m) => m.clave)`). El endpoint
 * `/api/admin/comite/guias-accion` exige `verifyAuth("COMITE_VALIDACION")` por
 * separación de poderes (quien modera no aprueba sus propias guías). Ese
 * descuadre pintaba la pestaña Guías para ADMIN y le respondía 403 al abrirla
 * ("Permisos insuficientes"). El seed ya no lo reconcede; este script apaga
 * el grant vivo en prod. Sigue el mismo patrón que
 * `revocar-grants-modulos-muertos.ts`.
 *
 * Uso (cargar el `DATABASE_URL` del entorno correspondiente):
 *   node --env-file=.env --import tsx scripts/revocar-grant-comite-guias-accion-admin.ts
 *
 * PRODUCCIÓN: lo ejecuta el responsable del despliegue.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const MODULO = "comite_guias_accion";
const ROL_A_REVOCAR = "ADMIN";

export interface ResultadoRevocacionGrant {
    /** true si el grant existía activo y se pasó a activo=false. */
    revocado: boolean;
    /** true si el grant ya estaba inactivo (no se toca). */
    yaInactivo: boolean;
    /** true si el catálogo no tiene la clave (BD sin ese módulo). */
    moduloAusente: boolean;
}

export async function revocarGrantComiteGuiasAdmin(
    client: PrismaClient = prisma,
): Promise<ResultadoRevocacionGrant> {
    const modulo = await client.moduloPermisible.findUnique({
        where: { clave: MODULO },
        select: { id: true },
    });
    if (!modulo) return { revocado: false, yaInactivo: false, moduloAusente: true };

    const grant = await client.permisoModulo.findUnique({
        where: { rol_moduloId: { rol: ROL_A_REVOCAR, moduloId: modulo.id } },
        select: { activo: true },
    });
    if (!grant) return { revocado: false, yaInactivo: false, moduloAusente: false };
    if (!grant.activo) return { revocado: false, yaInactivo: true, moduloAusente: false };

    return client.$transaction(async (tx) => {
        await tx.permisoModulo.update({
            where: { rol_moduloId: { rol: ROL_A_REVOCAR, moduloId: modulo.id } },
            data: { activo: false },
        });
        await tx.auditLog.create({
            data: {
                accion: "LOGS_MANTENIMIENTO_PURGA",
                tipoRecurso: "PermisoModulo",
                ipAddress: "script",
                userAgent: "scripts/revocar-grant-comite-guias-accion-admin",
                metadatos: {
                    tipo: "revocacion_grant_separacion_poderes",
                    modulo: MODULO,
                    rol: ROL_A_REVOCAR,
                    spec: "SPEC-381 · I-274",
                },
            },
        });
        return { revocado: true, yaInactivo: false, moduloAusente: false };
    });
}

async function main() {
    const resultado = await revocarGrantComiteGuiasAdmin();
    console.log(JSON.stringify(resultado, null, 2));
    await prisma.$disconnect();
    process.exitCode = 0;
}

// Ejecutar solo cuando se invoca como binario (no cuando se importa desde el test).
const invocadoDirecto =
    process.argv[1] && process.argv[1].endsWith("revocar-grant-comite-guias-accion-admin.ts");
if (invocadoDirecto) {
    main().catch((err) => {
        console.error(err);
        prisma.$disconnect().catch(() => undefined);
        process.exitCode = 1;
    });
}
