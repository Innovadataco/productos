export const INTEGRATION_ACTIVA = process.env.INTEGRATION === "1";

export function omitirSiNoActiva(): boolean {
    if (!INTEGRATION_ACTIVA) {
        console.warn(
            "[SPEC-014] INTEGRATION!=1 · omitiendo suite integración BI (ver scripts/e2e/preparar-entorno-integracion.sh)",
        );
        return true;
    }
    return false;
}
