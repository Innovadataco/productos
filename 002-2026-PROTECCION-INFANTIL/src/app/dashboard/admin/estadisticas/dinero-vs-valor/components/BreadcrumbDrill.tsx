"use client";

/**
 * SPEC-222 (002-PI-123, US-3, FR-006): breadcrumb del drill-down
 * País → Ciudad → Colegio. Cada nivel anterior es clicable y conserva los
 * filtros globales (los cambios van al querystring vía el orquestador).
 */
export function BreadcrumbDrill({
    niveles,
    onNavegar,
}: {
    niveles: { nivel: "pais" | "ciudad" | "colegio"; id: string; etiqueta: string }[];
    onNavegar: (accion: "todos" | "pais" | "ciudad") => void;
}) {
    return (
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Nivel de drill-down">
            <button
                type="button"
                onClick={() => onNavegar("todos")}
                className={`font-medium ${niveles.length === 0 ? "text-body" : "text-cielo underline hover:text-primary-700"}`}
            >
                Todos
            </button>
            {niveles.map((nivel, i) => {
                const esUltimo = i === niveles.length - 1;
                return (
                    <span key={`${nivel.nivel}-${nivel.id}`} className="flex items-center gap-1">
                        <span className="text-muted">→</span>
                        {esUltimo ? (
                            <span className="font-medium text-body">{nivel.etiqueta}</span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onNavegar(nivel.nivel === "pais" ? "pais" : "ciudad")}
                                className="font-medium text-cielo underline hover:text-primary-700"
                            >
                                {nivel.etiqueta}
                            </button>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
