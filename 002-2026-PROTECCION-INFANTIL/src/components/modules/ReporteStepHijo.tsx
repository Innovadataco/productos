"use client";

/**
 * SPEC-591 (decisión CEO 06-09) — paso inicial del wizard en modo autenticado:
 * «¿A quién va dirigido?». El padre con sesión SOLO puede reportar situaciones
 * de sus hijos — elegir la ficha «A quién protego» es obligatorio para avanzar.
 * La lista llega ya filtrada a ACTIVOS desde GET /api/padre/hijos.
 *
 * SPEC-604 (modelo EXPEDIENTE · cimientos): la ficha muestra la edad registrada
 * (se deriva del año de nacimiento; el paso 2 ya no la pide) y se agrega la
 * opción «Nuevo hijo (solo nombre)» — sin salir del wizard, el padre crea la
 * ficha con solo el nombre y el reporte nace atado a ella (mockup aprobado:
 * «¿Para quién reportas?» + «+ Nuevo hijo (solo nombre)»).
 */
export interface HijoParaElegir {
    id: string;
    nombre: string;
    apellidos: string;
    estado: string;
    /** SPEC-604: la edad se deriva del año; null = «sin edad». */
    anioNacimiento: number | null;
}

function edadDe(anioNacimiento: number | null): string {
    if (!anioNacimiento) return "sin edad";
    const edad = new Date().getFullYear() - anioNacimiento;
    return edad >= 0 && edad <= 120 ? `${edad} años` : "sin edad";
}

export function ReporteStepHijo({
    hijos,
    cargando,
    seleccionado,
    onChange,
    modoNuevo,
    nuevoNombre,
    onElegirNuevo,
    onNuevoNombre,
}: {
    hijos: HijoParaElegir[];
    cargando: boolean;
    seleccionado: string;
    onChange: (hijoId: string) => void;
    /** SPEC-604: true cuando el padre va a crear la ficha inline (solo nombre). */
    modoNuevo: boolean;
    nuevoNombre: string;
    onElegirNuevo: () => void;
    onNuevoNombre: (nombre: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-tinta">¿Para quién reportas?</h2>
                <p className="mt-1 text-sm text-muted">
                    El reporte nace atado a un menor, para alimentar su expediente y el círculo.
                </p>
            </div>

            {cargando ? (
                <p className="rounded-xl border border-tinta/10 bg-papel/60 p-4 text-sm text-muted">
                    Cargando tus fichas…
                </p>
            ) : (
                <>
                    {hijos.length > 0 && (
                        <ul className="space-y-2" role="listbox" aria-label="Elige a quién va dirigido">
                            {hijos.map((h) => {
                                const activo = !modoNuevo && seleccionado === h.id;
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
                                                {`${h.nombre} ${h.apellidos}`.trim()}
                                            </span>
                                            <span className="ml-2 text-sm text-muted">· {edadDe(h.anioNacimiento)}</span>
                                            {activo && <span className="ml-2 text-xs font-medium text-estado-cielo">Seleccionado</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {modoNuevo ? (
                        <div className="rounded-xl border border-cielo bg-cielo/10 p-4">
                            <label htmlFor="nuevo-hijo-nombre" className="block text-sm font-medium text-body">
                                Nombre del menor
                            </label>
                            <input
                                id="nuevo-hijo-nombre"
                                type="text"
                                value={nuevoNombre}
                                onChange={(e) => onNuevoNombre(e.target.value)}
                                placeholder="Solo el nombre — completas su ficha después"
                                maxLength={120}
                                className="mt-2 w-full rounded-xl px-4 py-3 text-sm text-body placeholder-subtle outline-none transition glass-input ring-accent-input"
                            />
                            <p className="mt-2 text-xs text-subtle">
                                Se crea su ficha en «A quién protego» con solo el nombre y el reporte queda atado a ella.
                            </p>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onElegirNuevo}
                            className="w-full rounded-xl border border-dashed border-tinta/20 bg-papel/40 p-4 text-left text-sm font-medium text-body transition hover:border-tinta/40"
                        >
                            + Nuevo hijo (solo nombre)
                        </button>
                    )}

                    <p className="text-xs text-subtle">
                        La edad registrada en la ficha se ajusta automáticamente al reporte.
                    </p>
                </>
            )}
        </div>
    );
}
