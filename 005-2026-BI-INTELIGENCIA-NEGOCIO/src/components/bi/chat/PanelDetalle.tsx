import type { RespuestaMotor } from "@/lib/bi/tipos";

export function PanelDetalle({ respuesta }: { respuesta: RespuestaMotor }) {
    return (
        <details className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700" data-testid="panel-detalle">
            <summary className="cursor-pointer font-medium">Detalle técnico</summary>
            <div className="mt-2 space-y-2">
                {respuesta.sqlGenerado && (
                    <div>
                        <div className="font-semibold text-slate-800">SQL</div>
                        <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-emerald-200">{respuesta.sqlGenerado}</pre>
                    </div>
                )}
                {respuesta.votosJurado && respuesta.votosJurado.length > 0 && (
                    <div>
                        <div className="font-semibold text-slate-800">Jurado</div>
                        <ul className="list-disc pl-4">
                            {respuesta.votosJurado.map((v, i) => (
                                <li key={i}>
                                    <strong>{v.modelo}</strong>
                                    {v.error ? ` · error: ${v.error}` : ""}
                                    {v.latenciaMs ? ` · ${v.latenciaMs} ms` : ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div>
                    <span className="font-semibold text-slate-800">Latencia total:</span> {respuesta.latenciaMs} ms
                </div>
                <div>
                    <span className="font-semibold text-slate-800">llamadasLlm:</span> {respuesta.llamadasLlm}
                </div>
                {respuesta.consultaLogId && (
                    <div>
                        <span className="font-semibold text-slate-800">consultaLogId:</span>{" "}
                        <code>{respuesta.consultaLogId}</code>
                    </div>
                )}
                <div>
                    <span className="font-semibold text-slate-800">cacheHit:</span> {String(respuesta.cacheHit)}
                </div>
            </div>
        </details>
    );
}
