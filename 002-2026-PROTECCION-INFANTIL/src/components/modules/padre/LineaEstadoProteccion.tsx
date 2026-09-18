import { relativoHumano } from "@/lib/colegio/fechas-humano";

/**
 * SPEC-660 · Línea de estado de «A quién protejo».
 *
 * SPEC-716 (Parte A · I-427): la línea afirmaba SIEMPRE «Sin reportes» cuando el motor estaba vivo,
 * sin saber si había reportes — y el gráfico, encima, pintaba al hijo en ámbar. Dos verdades a 30
 * píxeles. Ahora recibe `cuentasConReporte` (el MISMO hecho que enciende el ámbar: `tieneReportes`
 * de `listarHijos`, no una constante ni un segundo criterio) y lo dice: con ≥1 cuenta reportada,
 * «{N} cuenta(s) necesita(n) tu atención», NUNCA «Sin reportes». Es la CUENTA la que necesita
 * atención, no el hijo (marco 13-09: no es una acusación contra la niña). Ámbar-ink, nunca rubí
 * (frontera D-120): es un estado operativo que pide una mirada, no una criticidad de un menor.
 *
 * I-396 (defensa en FORMA): con el motor caído la AUSENCIA de reportes no es confiable, así que la
 * calma NO se afirma (ni «Sin reportes» ni el reloj ni «las demás sin novedad»); la línea va a
 * «Estamos terminando de revisar». La decisión de NO mostrar «Revisado hace {X}» en degradado es de
 * ESTE render aunque el dato traiga valor. El candado vigila justo ese caso.
 */
export interface EstadoClasificador {
    motorVivo: boolean;
    /**
     * Último éxito real del clasificador, o null si nunca. Honesto (no recortado).
     * `Date` cuando llega server-side (LatidoMotor), `string` cuando pasó por JSON.
     */
    ultimaVerificacionEn: string | Date | null;
}

export function LineaEstadoProteccion({
    estado,
    cuentasConReporte,
}: {
    estado: EstadoClasificador;
    cuentasConReporte: number;
}) {
    if (!estado.motorVivo) {
        // Degradado. NEUTRO, sin reloj — aunque `ultimaVerificacionEn` traiga valor (I-396).
        return (
            <div className="flex items-center gap-2 rounded-xl bg-tinta/5 px-3 py-2 text-sm text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4l3 2" />
                </svg>
                <span>Estamos terminando de revisar.</span>
            </div>
        );
    }

    // SPEC-716 (Parte A): motor vivo + al menos una cuenta con reporte visible → LO DICE. Singular/
    // plural real («1 cuenta necesita» / «2 cuentas necesitan»); «las demás sin novedad» solo acá,
    // donde el conteo es confiable (con el motor vivo). Ámbar-ink, NUNCA rubí (D-120).
    if (cuentasConReporte >= 1) {
        const unaSola = cuentasConReporte === 1;
        return (
            <div className="flex items-center gap-2 rounded-xl bg-ambar/10 px-3 py-2 text-sm text-estado-ambar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                    <path d="M12 4l9 15.5H3z" />
                    <path d="M12 10v4M12 17v.1" />
                </svg>
                <span>
                    <b>{unaSola ? "1 cuenta necesita" : `${cuentasConReporte} cuentas necesitan`} tu atención.</b>{" "}
                    Las demás, sin novedad.
                </span>
            </div>
        );
    }

    // Sin reportes (motor vivo, 0 cuentas con reporte): calma + reloj honesto.
    return (
        <div className="flex items-center gap-2 rounded-xl bg-pino/10 px-3 py-2 text-sm text-estado-pino">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                <path d="M12 3l7 3v6c0 4.5-3 8.3-7 9.5C8 20.3 5 16.5 5 12V6z" />
                <path d="M9 12l2 2 4-4" />
            </svg>
            <span>
                <b>Sin reportes.</b> Vigilando las cuentas de tus hijos.
            </span>
            {estado.ultimaVerificacionEn && (
                <span className="ml-auto text-xs text-subtle">Revisado {relativoHumano(new Date(estado.ultimaVerificacionEn))}</span>
            )}
        </div>
    );
}
