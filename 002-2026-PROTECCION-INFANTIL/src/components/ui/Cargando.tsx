/**
 * SPEC-124 (R7) — Indicador de carga compartido (el mueble de más ALCANCE: 110 pantallas).
 * SPEC-457-family / SPEC-461 · Sistema de Diseño (catálogo §6): «Cargando = skeleton
 * que preserva el layout, NUNCA spinner infinito». Un cargando que no termina es
 * peor que un error honesto — por eso el placeholder es un skeleton que PULSA
 * (no gira): comunica «esto es contenido que está llegando», no «esto gira sin fin».
 *
 * Color por token (`tinta` velada), sin escala cruda. Conducta intacta: se monta
 * mientras carga y el llamador lo desmonta al resolver.
 *
 * - centrada (por defecto): barras skeleton apiladas, para estados de pantalla/sección.
 * - inline: una barra corta en línea con el texto, para tablas y paneles.
 */

type CargandoProps = {
    texto?: string;
    inline?: boolean;
    /** "sm": barra fina (tablas); "md": skeleton de pantalla. */
    tamano?: "sm" | "md";
    className?: string;
};

/** Barra skeleton: pulsa (no gira), color por token. */
const BARRA = "animate-pulse rounded bg-tinta/10";

export function Cargando({ texto = "Cargando...", inline = false, tamano = "md", className = "" }: CargandoProps) {
    if (inline) {
        const barra = tamano === "sm" ? `h-4 w-16 ${BARRA}` : `h-5 w-20 ${BARRA}`;
        return (
            <span
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-2 text-sm text-muted ${className}`.trim()}
            >
                <span className={barra} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    // Skeleton que preserva el layout: tres barras de ancho decreciente. En "sm"
    // una sola barra (tablas/paneles compactos).
    return (
        <div role="status" aria-live="polite" className={`py-6 ${className}`.trim()}>
            <div className="mx-auto max-w-sm space-y-3" aria-hidden="true">
                <div className={`h-4 w-full ${BARRA}`} />
                {tamano === "md" && <div className={`h-4 w-5/6 ${BARRA}`} />}
                {tamano === "md" && <div className={`h-4 w-2/3 ${BARRA}`} />}
            </div>
            {texto && <p className="mt-3 text-center text-sm text-subtle">{texto}</p>}
        </div>
    );
}
