/**
 * SPEC-287 (002-PI-187) · Ratchet 4 — `guardia-invariante`.
 *
 * Verifica que por cada `<rol>.destino` de `GUARDIAS_ACCESO.vigencia`, la misma
 * URL está en `<rol>.exentas`. También para `consentimiento` y
 * `cambiarPassword`. Sin este invariante, el guardián redirige a una ruta cuya
 * evaluación de vigencia dispara otra vez el mismo guardián → bucle infinito
 * (I-25/I-111/I-141).
 *
 * `guardias.ts` ya lanza al import si mal — este ratchet expone el error como
 * gate CI legible para el desarrollador, no como stack trace.
 *
 * Exit codes: 0 = verde, 1 = invariante rota, 2 = error de import.
 */

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("guardia-invariante.ts") || process.argv[1].endsWith("guardia-invariante.js"));

if (esEntry) {
    (async () => {
        try {
            // Import dinámico: el módulo tira al cargarse si la invariante está rota.
            const modulo = await import("../../src/lib/routing/guardias");
            const { GUARDIAS_ACCESO } = modulo;

            const fallos: string[] = [];

            if (!GUARDIAS_ACCESO.consentimiento.exentas.some((r: string) => r === GUARDIAS_ACCESO.consentimiento.destino)) {
                fallos.push(
                    `consentimiento.destino "${GUARDIAS_ACCESO.consentimiento.destino}" NO está en consentimiento.exentas`,
                );
            }
            if (!GUARDIAS_ACCESO.cambiarPassword.exentas.some((r: string) => r === GUARDIAS_ACCESO.cambiarPassword.destino)) {
                fallos.push(
                    `cambiarPassword.destino "${GUARDIAS_ACCESO.cambiarPassword.destino}" NO está en cambiarPassword.exentas`,
                );
            }
            for (const [rol, cfg] of Object.entries(GUARDIAS_ACCESO.vigencia)) {
                const c = cfg as { destino: string; exentas: readonly string[] };
                if (!c.exentas.some((r: string) => r === c.destino)) {
                    fallos.push(`vigencia.${rol}.destino "${c.destino}" NO está en vigencia.${rol}.exentas`);
                }
            }

            if (fallos.length > 0) {
                for (const f of fallos) console.error(`[LINT guardia-invariante] ${f}`);
                console.error(
                    `[LINT guardia-invariante] FALLO — ${fallos.length} invariantes rotas. ` +
                        "Sin destino ∈ exentas hay bucle infinito garantizado (I-25/I-111/I-141).",
                );
                process.exit(1);
            }
            const totalRoles = Object.keys(GUARDIAS_ACCESO.vigencia).length;
            console.log(`[LINT guardia-invariante] OK — ${totalRoles + 2} invariantes verificadas`);
        } catch (error) {
            console.error(`[LINT guardia-invariante] Error: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(2);
        }
    })();
}
