/**
 * SPEC-124 (R7) — Indicador de carga compartido.
 * Unifica las ~25 copias del spinner "Cargando...":
 * - centrada (por defecto): spinner + texto, para estados de pantalla/sección.
 * - inline: spinner pequeño en línea con el texto, para tablas y paneles.
 */

type CargandoProps = {
    texto?: string;
    inline?: boolean;
    /** "sm": spinner h-5/h-6 border-2 (tablas); "md": h-8 border-4 (pantalla). */
    tamano?: "sm" | "md";
    className?: string;
};

export function Cargando({ texto = "Cargando...", inline = false, tamano = "md", className = "" }: CargandoProps) {
    if (inline) {
        const spinner =
            tamano === "sm"
                ? "h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent"
                : "h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent";
        return (
            <span
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-2 text-sm text-muted ${className}`.trim()}
            >
                <span className={spinner} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    const spinner =
        tamano === "sm"
            ? "mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent"
            : "mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent";
    return (
        <div role="status" aria-live="polite" className={`py-6 text-center ${className}`.trim()}>
            <div className={spinner} aria-hidden="true" />
            {texto && <p className="mt-3 text-sm text-subtle">{texto}</p>}
        </div>
    );
}
