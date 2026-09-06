interface TimelineSectionProps {
    timeline: Array<Record<string, unknown>>;
}

export function TimelineSection({ timeline }: TimelineSectionProps) {
    return (
        <section className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-body">Timeline de cambios de producción</h2>
            <p className="text-sm text-muted">Solo lectura. Registro de cambios en parámetros de configuración.</p>
            {timeline.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Sin cambios registrados.</p>
            ) : (
                <div className="mt-4 space-y-3 max-h-96 overflow-auto">
                    {timeline.map((log: Record<string, unknown>) => (
                        <div key={String(log.id)} className="rounded-lg border border-tinta/10 p-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-body">{String(log.accion)}</span>
                                <span className="text-xs text-muted">{new Date(String(log.creadoEn)).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</span>
                            </div>
                            <p className="text-xs text-muted">
                                {((log.usuario as Record<string, string>)?.email) || "sistema"} · {String(log.tipoRecurso)}
                            </p>
                            {Boolean(log.valorAnterior) && Boolean(log.valorNuevo) && (
                                <div className="mt-2 grid gap-1 text-xs">
                                    <p className="text-body">- {String(log.valorAnterior).slice(0, 200)}</p>
                                    <p className="text-body">+ {String(log.valorNuevo).slice(0, 200)}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
