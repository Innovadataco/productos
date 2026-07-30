/**
 * 002-PI-048 — Sync ADITIVO e IDEMPOTENTE del catálogo de módulos y grants por rol
 * a una BD existente. Reusa la fuente única del seed (`prisma/seed-modulos-grants.ts`):
 * crea módulos y grants faltantes; NUNCA revoca, NUNCA borra, NO toca al admin
 * (no usa SEED_ADMIN_PASSWORD ni crea usuarios).
 *
 * Uso local:   node --env-file=.env --import tsx scripts/sync-modulos-grants.ts
 * Uso en prod: docker compose --env-file .env.production -f docker-compose.prod.yml \
 *                exec -T app node --import tsx scripts/sync-modulos-grants.ts
 * (cableado en deploy-prod.sh tras `prisma migrate deploy`).
 */
import { prisma } from "../src/lib/prisma";
import { syncModulosYGrants } from "../prisma/seed-modulos-grants";

async function main() {
    const resultado = await syncModulosYGrants(prisma);
    console.log(
        `[SyncModulos] Catálogo: ${resultado.modulosCatalogo} módulos verificados ` +
        `(${resultado.modulosCreados} nuevos) — grants creados: ${resultado.permisosCreados}`
    );

    // Verificación del caso que originó este sync: ADMIN debe tener el módulo "padres"
    // (SPEC-117) para que "Padres" aparezca en el menú del panel.
    const padres = await prisma.moduloPermisible.findUnique({ where: { clave: "padres" } });
    if (!padres) {
        console.error("[SyncModulos] Verificación ADMIN→padres: el módulo 'padres' NO existe en el catálogo");
        process.exitCode = 1;
        return;
    }
    const grant = await prisma.permisoModulo.findUnique({
        where: { rol_moduloId: { rol: "ADMIN", moduloId: padres.id } },
    });
    console.log(
        `[SyncModulos] Verificación ADMIN→padres: ${grant?.activo ? "OK (grant activo)" : "FALTA EL GRANT"}`
    );
    if (!grant?.activo) process.exitCode = 1;
}

main()
    .catch((err: unknown) => {
        console.error("[SyncModulos] Error:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
