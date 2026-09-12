import { relativoHumano } from "@/lib/colegio/fechas-humano";

/**
 * SPEC-660 · Línea de estado de «A quién protejo» (Estado A · sin reportes).
 *
 * Consume el CONTRATO fijado con Dev 2 (SPEC-663): `obtenerHomePadre` expone
 * `estadoClasificador: { motorVivo, ultimaVerificacionEn }`, alimentado por el
 * `leerLatidoMotor()` de SPEC-670. Dev 2 = dato + candado de dato; acá = render +
 * candado de render. Consumir ESTE nombre, no uno paralelo (Dev 2 lo fija con test
 * de contrato).
 *
 * I-396 (defensa en FORMA): con el motor caído la AUSENCIA de reportes no es
 * confiable, así que la calma NO se afirma. El dato llega HONESTO —
 * `ultimaVerificacionEn` es el último éxito real o null (Dev 2 NO lo recorta: el
 * rector sí muestra el reloj en degradado)—, así que **la decisión de NO mostrar
 * «Revisado hace {X}» en la cara del padre cuando está degradado es de ESTE render**,
 * aunque el dato traiga un valor. El candado vigila justo ese caso.
 *
 * I-397: la calma dice qué se vigila, NO promete el aviso («te avisamos» está
 * encadenado a la clasificación y con el motor caído no sale — no es garantía).
 * Nunca rojo: «en revisión» es un estado del sistema, no una alarma.
 */
export interface EstadoClasificador {
    motorVivo: boolean;
    /**
     * Último éxito real del clasificador, o null si nunca. Honesto (no recortado).
     * `Date` cuando llega server-side (LatidoMotor), `string` cuando pasó por JSON.
     */
    ultimaVerificacionEn: string | Date | null;
}

export function LineaEstadoProteccion({ estado }: { estado: EstadoClasificador }) {
    if (!estado.motorVivo) {
        // Degradado. NEUTRO, sin reloj — aunque `ultimaVerificacionEn` traiga valor.
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
