import type { GeoData } from "@/lib/bi/geo";
import BarrasVerticales from "./BarrasVerticales";

/* Nombres cortos de mes para el eje; el índice 0 es enero. */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** "2026-08" → "ago"; si el formato no es YYYY-MM se muestra lo que venga. */
function etiquetaMes(mes: string): string {
    const iso = /^\d{4}-(\d{2})$/.exec(mes);
    if (!iso) return mes;
    const indice = Number(iso[1]) - 1;
    return MESES[indice] ?? mes;
}

/** "2026-08" → "ago 2026" (tooltip). */
function tituloMes(mes: string): string {
    const iso = /^(\d{4})-(\d{2})$/.exec(mes);
    if (!iso) return mes;
    const indice = Number(iso[2]) - 1;
    const nombre = MESES[indice];
    return nombre ? `${nombre} ${iso[1]}` : mes;
}

/**
 * Estacionalidad semanal (mockup v3 pantalla 3): la capa de datos trae los
 * 7 días L..D siempre, con 0 real en los días sin reportes. Vacío total →
 * nota honesta en vez de un eje plano disfrazado (candado 9).
 */
export function BarrasEstacionalidad({
    estacionalidadDow,
    retardo = 260,
}: {
    estacionalidadDow: GeoData["estacionalidadDow"];
    retardo?: number;
}) {
    const total = estacionalidadDow.reduce((acc, d) => acc + d.total, 0);
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Estacionalidad semanal</h3>
            <div className="mb-4 text-[13px] text-muted">¿Qué días se reporta más?</div>
            {estacionalidadDow.length === 0 || total === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún no hay reportes para medir el ritmo semanal.
                </p>
            ) : (
                <BarrasVerticales
                    puntos={estacionalidadDow.map((d) => ({ etiqueta: d.dia, total: d.total }))}
                    retardoBase={retardo}
                />
            )}
        </div>
    );
}

/**
 * Reportes por mes (mockup v3 pantalla 3): cronología de los últimos 12
 * meses móviles, con huecos rellenados a 0 EN SQL — un mes en 0 es un hecho,
 * se dibuja en 0. Vacío total → nota honesta.
 */
export function BarrasPorMes({
    porMes,
    retardo = 320,
}: {
    porMes: GeoData["porMes"];
    retardo?: number;
}) {
    const total = porMes.reduce((acc, m) => acc + m.total, 0);
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Reportes por mes</h3>
            <div className="mb-4 text-[13px] text-muted">
                {porMes.length > 0
                    ? `${porMes.length} ${porMes.length === 1 ? "mes" : "meses"} de operación`
                    : "Cronología mensual"}
            </div>
            {porMes.length === 0 || total === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún no hay reportes para armar la cronología.
                </p>
            ) : (
                <BarrasVerticales
                    puntos={porMes.map((m) => ({
                        etiqueta: etiquetaMes(m.mes),
                        titulo: tituloMes(m.mes),
                        total: m.total,
                    }))}
                    retardoBase={retardo}
                />
            )}
        </div>
    );
}
