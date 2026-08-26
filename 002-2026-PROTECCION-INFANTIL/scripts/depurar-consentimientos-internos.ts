/**
 * SPEC-263 (002-PI-164) — audita registros de AuditConsentimiento firmados por
 * roles internos (OPERADOR, COMITE_VALIDACION, ADMIN, etc.) en lugar de por PARENT.
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

const ROLES_INTERNOS = ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA", "SCHOOL_ADMIN"] as const;
const applyMode = process.argv.includes("--apply");

interface ConteoPorRol {
    rol: string;
    firmas: number;
}

interface ResultadoDepuracion {
    dePadres: number;
    deRolesInternos: number;
    detallesPorRol: ConteoPorRol[];
    marcadasComoInvalidas: number;
}

async function depurarConsentimientosInternos(): Promise<ResultadoDepuracion> {
    const todas = await prisma.auditConsentimiento.findMany({
        include: {
            usuario: { select: { id: true, rol: true } },
        },
    });

    const dePadres = todas.filter((a) => a.usuario.rol === "PARENT").length;
    const deRolesInternos = todas.filter((a) => (ROLES_INTERNOS as readonly string[]).includes(a.usuario.rol)).length;

    const conteoMap = new Map<string, number>();
    for (const a of todas) {
        if ((ROLES_INTERNOS as readonly string[]).includes(a.usuario.rol)) {
            conteoMap.set(a.usuario.rol, (conteoMap.get(a.usuario.rol) ?? 0) + 1);
        }
    }
    const detallesPorRol: ConteoPorRol[] = Array.from(conteoMap.entries()).map(([rol, firmas]) => ({ rol, firmas }));

    // AuditConsentimiento no tiene campo de metadata mutable.
    // En --apply solo se reportan los conteos; documentar en cierre.md.
    return { dePadres, deRolesInternos, detallesPorRol, marcadasComoInvalidas: 0 };
}

async function main() {
    console.log(`[DepuracionConsentimientos] Modo: ${applyMode ? "--apply" : "--dry-run (default)"}`);
    const resultado = await depurarConsentimientosInternos();

    console.log(`[DepuracionConsentimientos] Total firmas de PARENT: ${resultado.dePadres}`);
    console.log(`[DepuracionConsentimientos] Total firmas de roles internos: ${resultado.deRolesInternos}`);
    if (resultado.detallesPorRol.length > 0) {
        console.log("[DepuracionConsentimientos] Detalle por rol:");
        for (const { rol, firmas } of resultado.detallesPorRol) {
            console.log(`  ${rol}: ${firmas} firma(s)`);
        }
    }
    if (resultado.deRolesInternos > 0) {
        console.log(
            "[DepuracionConsentimientos] NOTA: AuditConsentimiento no tiene campo de metadata mutable. " +
            "Documenta los conteos en cierre.md para evidencia legal."
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
