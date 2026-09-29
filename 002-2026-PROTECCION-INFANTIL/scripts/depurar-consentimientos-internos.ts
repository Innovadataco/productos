/**
 * SPEC-263 (002-PI-164) — audita registros de AuditConsentimiento firmados por
 * roles que NO son titulares del dato (empleados internos / prestador de
 * servicio) en lugar de por un titular (PARENT o SCHOOL_ADMIN).
 *
 * SPEC-748a: la clasificación DERIVA de la fuente única `esTitularDelDato`
 * (roles-titulares.ts) vía `scripts/lib/consentimiento-clasificacion.ts` — ya
 * NO una lista de roles a mano. La lista vieja driftó y reportaba 50 firmas
 * legítimas de colegios como «internas»; el detalle y las cifras de prod viven
 * en la cabecera del módulo de clasificación.
 *
 * El modelo AuditConsentimiento no tiene campo de metadata mutable, por lo que
 * en modo --apply el script SOLO reporta los conteos (no puede marcar filas).
 * Los conteos se deben documentar en cierre.md para el registro de evidencia.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/depurar-consentimientos-internos.ts
 *   node --env-file=.env --import tsx scripts/depurar-consentimientos-internos.ts --apply
 */
import { prisma } from "../src/lib/prisma";
import { clasificarFirmas, type ResultadoDepuracion } from "./lib/consentimiento-clasificacion";

const applyMode = process.argv.includes("--apply");

async function depurarConsentimientosInternos(): Promise<ResultadoDepuracion> {
    const todas = await prisma.auditConsentimiento.findMany({
        include: {
            usuario: { select: { id: true, rol: true } },
        },
    });
    return clasificarFirmas(todas);
}

async function main() {
    console.log(`[DepuracionConsentimientos] Modo: ${applyMode ? "--apply" : "--dry-run (default)"}`);
    const resultado = await depurarConsentimientosInternos();

    console.log(`[DepuracionConsentimientos] Total firmas de titulares del dato: ${resultado.deTitulares}`);
    console.log(
        `[DepuracionConsentimientos] Total firmas de roles internos (sospechosas): ${resultado.deRolesInternos}`,
    );
    if (resultado.detallesPorRol.length > 0) {
        console.log("[DepuracionConsentimientos] Detalle por rol interno:");
        for (const { rol, firmas } of resultado.detallesPorRol) {
            console.log(`  ${rol}: ${firmas} firma(s)`);
        }
    }
    if (resultado.deRolesInternos > 0) {
        console.log(
            "[DepuracionConsentimientos] NOTA: AuditConsentimiento no tiene campo de metadata mutable. " +
                "Documenta los conteos en cierre.md para evidencia legal.",
        );
    }
    console.log(JSON.stringify(resultado, null, 2));
}

main()
    .catch((err: unknown) => {
        console.error("[DepuracionConsentimientos] Error:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
