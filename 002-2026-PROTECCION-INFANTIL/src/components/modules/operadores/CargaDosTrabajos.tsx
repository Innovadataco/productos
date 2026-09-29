/**
 * SPEC-779 · La carga del operador — DOS trabajos, DOS topes (FORMA-SPEC779).
 *
 * El operador carga CASOS (reportes/comité) y atiende SESIONES (videollamadas de citas):
 * son dos capacidades INDEPENDIENTES con topes distintos. La pregunta del admin es «¿le
 * cabe MÁS de ESTE trabajo?» — y ninguna cifra sola la contesta. Por eso:
 *  - Cada carga va CONTRA SU PROPIO tope (`{n}/{tope}` + barra); el vacío de la barra es el margen.
 *  - NUNCA un total combinado ni una barra única (sumar un caso con una sesión no significa nada).
 *  - NUNCA un semáforo agregado «disponible/ocupado» (no existe una disponibilidad combinada
 *    que el sistema sepa; un verde prometería certeza que no hay).
 *  - Al tope → barra llena + ÁMBAR (D-120: carga operativa, CERO rubí); bajo el tope, cielo.
 *  - Sobre-tope → barra llena + ámbar con el NÚMERO REAL (no se recorta la verdad; quien evita
 *    crear de más es el candado del servidor, no el pintado).
 * Superficie interna (admin, usted).
 */

export interface CargaTrabajo {
    actual: number;
    tope: number;
}

function BarraCarga({ etiqueta, clave, actual, tope }: CargaTrabajo & { etiqueta: string; clave: "casos" | "sesiones" }) {
    const alTope = actual >= tope;
    const pct = tope > 0 ? Math.min(100, (actual / tope) * 100) : 100;
    return (
        <div data-carga={clave} data-al-tope={alTope}>
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted">{etiqueta}</span>
                <span className={`text-sm font-semibold ${alTope ? "text-estado-ambar" : "text-body"}`}>
                    {actual}/{tope}
                    {alTope && <span className="ml-1 text-xs font-normal">al tope</span>}
                </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-tinta/15 dark:bg-tinta/30">
                <div
                    data-fill={clave}
                    className={`h-full rounded-full ${alTope ? "bg-ambar" : "bg-cielo"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

/**
 * Las dos cargas, cada una contra su tope. `compacto` = variante de fila para la lista
 * (mismas reglas, menos aire). Sin total ni semáforo por construcción: son dos barras
 * independientes.
 */
export function CargaDosTrabajos({
    casos,
    sesiones,
    className = "",
}: {
    casos: CargaTrabajo;
    sesiones: CargaTrabajo;
    className?: string;
}) {
    return (
        <div data-carga-dos-trabajos className={`grid gap-3 sm:grid-cols-2 ${className}`}>
            <BarraCarga etiqueta="Casos" clave="casos" actual={casos.actual} tope={casos.tope} />
            <BarraCarga etiqueta="Sesiones" clave="sesiones" actual={sesiones.actual} tope={sesiones.tope} />
        </div>
    );
}
