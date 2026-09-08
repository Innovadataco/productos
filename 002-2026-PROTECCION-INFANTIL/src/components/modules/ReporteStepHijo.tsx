"use client";

/**
 * SPEC-591 (decisión CEO 06-09) — paso inicial del wizard en modo autenticado:
 * «¿A quién va dirigido?». El padre con sesión SOLO puede reportar situaciones
 * de sus hijos — elegir la ficha «A quién protego» es obligatorio para avanzar.
 * La lista llega ya filtrada a ACTIVOS desde GET /api/padre/hijos.
 */
export interface HijoParaElegir {
    id: string;
    nombre: string;
    apellidos: string;
    estado: string;
}

export function ReporteStepHijo({
    hijos,
    cargando,
    seleccionado,
    onChange,
}: {
    hijos: HijoParaElegir[];
    cargando: boolean;
    seleccionado: string;
    onChange: (hijoId: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-tinta">¿A quién va dirigido?</h2>
                <p className="mt-1 text-sm text-muted">
                    Elige la ficha de la persona que quieres proteger con este reporte.
                </p>
            </div>

            {cargando ? (
                <p className="rounded-xl border border-tinta/10 bg-papel/60 p-4 text-sm text-muted">
                    Cargando tus fichas…
                </p>
            ) : hijos.length === 0 ? (
                <div className="rounded-xl border border-ambar/30 bg-ambar/10 p-4 text-sm text-tinta">
                    <p>No tienes fichas activas en «A quién protego».</p>
                    <p className="mt-2">
                        <a href="/dashboard/padre/hijos" className="font-medium text-accent underline-offset-2 hover:underline">
                            Registra a quién quieres proteger
                        </a>{" "}
                        y vuelve a reportar. Si prefieres no dar tus datos, cierra sesión y reporta de forma anónima.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2" role="listbox" aria-label="Elige a quién va dirigido">
                    {hijos.map((h) => {
                        const activo = seleccionado === h.id;
                        return (
                            <li key={h.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={activo}
                                    onClick={() => onChange(h.id)}
                                    className={`w-full rounded-xl border p-4 text-left transition ${
                                        activo
                                            ? "border-cielo bg-cielo/10"
                                            : "border-tinta/10 bg-papel/60 hover:border-tinta/30"
                                    }`}
                                >
                                    <span className="font-medium text-body">
                                        {h.nombre} {h.apellidos}
                                    </span>
                                    {activo && <span className="ml-2 text-xs font-medium text-estado-cielo">Seleccionado</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
