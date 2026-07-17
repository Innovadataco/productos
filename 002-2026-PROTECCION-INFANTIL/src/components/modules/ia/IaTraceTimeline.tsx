"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/modules/BarChart";
import type { SandboxTrace } from "@/lib/ai/sandbox";

interface IaTraceTimelineProps {
    trace: SandboxTrace;
}

function Stage({
    title,
    latency,
    children,
}: {
    title: string;
    latency?: number;
    children: React.ReactNode;
}) {
    return (
        <div className="relative pl-6">
            <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100 dark:bg-cyan-400 dark:ring-sky-900" />
            <div className="absolute left-[4px] top-6 h-[calc(100%-16px)] w-0.5 bg-slate-200 dark:bg-slate-700" />
            <GlassCard className="mb-4 p-4">
                <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-body">{title}</h4>
                    {latency !== undefined && <span className="text-xs text-muted">{latency} ms</span>}
                </div>
                <div className="space-y-2 text-sm text-body">{children}</div>
            </GlassCard>
        </div>
    );
}

function truncate(items: string[], max = 5) {
    if (items.length === 0) return "—";
    const shown = items.slice(0, max);
    const suffix = items.length > max ? ` +${items.length - max}` : "";
    return shown.join(", ") + suffix;
}

export function IaTraceTimeline({ trace }: IaTraceTimelineProps) {
    const { etapas, decision, parametrosEfectivos } = trace;
    const rag = etapas.rag;
    const votos = etapas.votacion;
    const pii = etapas.pii;
    const guardas = etapas.guardas;

    const voteChartData = votos.distribucion.map((d) => ({
        label: d.categoria,
        value: d.count,
    }));

    return (
        <div className="space-y-1">
            <Stage title="Embedding" latency={etapas.embedding.latenciaMs}>
                <p>
                    Modelo: <span className="font-medium">{etapas.embedding.modelo}</span>
                </p>
                <p className="text-xs text-muted">Vector semántico para RAG y clasificación.</p>
            </Stage>

            <Stage title="RAG" latency={rag.latenciaMs}>
                <p>
                    top-k: <span className="font-medium">{rag.topK}</span> · ejemplos recuperados:{" "}
                    <span className="font-medium">{rag.ejemplos.length}</span>
                </p>
                <p className="text-xs text-muted">
                    {rag.ejemplos.length > 0
                        ? `Distancia media: ${(
                              rag.ejemplos.reduce((acc, e) => acc + (1 - (e.similitud || 0)), 0) /
                              Math.max(rag.ejemplos.length, 1)
                          ).toFixed(3)}`
                        : "Sin ejemplos similares en el dataset."}
                </p>
            </Stage>

            <Stage title="Votación" latency={votos.latenciaMs}>
                <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                        <p>
                            Categoría: <Badge variant="info">{votos.categoria}</Badge>
                        </p>
                        <p>Confianza: {(votos.confianza * 100).toFixed(0)}%</p>
                        <p>Votos: {parametrosEfectivos.nVotos}</p>
                    </div>
                    <BarChart ariaLabel="Distribución de votos" data={voteChartData} />
                </div>
            </Stage>

            <Stage title="PII" latency={pii.latenciaMs}>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={pii.contienePii ? "warning" : "success"}>
                        {pii.contienePii ? "PII detectado" : "Sin PII"}
                    </Badge>
                    {pii.contienePii && (
                        <span className="text-xs text-muted">{truncate(pii.piiDetectada)}</span>
                    )}
                </div>
            </Stage>

            {etapas.anonimizacion && (
                <Stage title="Anonimización" latency={etapas.anonimizacion.latenciaMs}>
                    <p className="text-xs text-muted">Texto anonimizado:</p>
                    <p className="max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs text-body dark:bg-slate-900">
                        {etapas.anonimizacion.textoAnonimizado}
                    </p>
                </Stage>
            )}

            <Stage title="Guardas" latency={guardas.latenciaMs}>
                <div className="flex flex-wrap gap-2">
                    {guardas.doxing.esDoxing && <Badge variant="danger">DOXING</Badge>}
                    {guardas.keywords.tieneMatch && <Badge variant="danger">Keywords críticas</Badge>}
                    {guardas.prioridadAlta && <Badge variant="warning">Prioridad alta</Badge>}
                    {guardas.rafaga.esRafaga && <Badge variant="danger">Ráfaga</Badge>}
                    {!guardas.doxing.esDoxing && !guardas.keywords.tieneMatch && !guardas.rafaga.esRafaga && (
                        <Badge variant="success">Ninguna guarda activa</Badge>
                    )}
                </div>
                {guardas.keywordsDetectadas.length > 0 && (
                    <p className="text-xs text-muted">Señales: {truncate(guardas.keywordsDetectadas)}</p>
                )}
                {guardas.estadoForzado && (
                    <p className="text-xs text-warning">Estado forzado por guarda: {guardas.estadoForzado}</p>
                )}
            </Stage>

            <Stage title="Decisión final" latency={trace.latenciaTotalMs}>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={decision.estado === "CLASIFICADO" ? "success" : "warning"}>
                        {decision.estado}
                    </Badge>
                    <Badge variant="info">{decision.categoria}</Badge>
                    <span className="text-sm text-muted">{(decision.confianza * 100).toFixed(0)}% confianza</span>
                </div>
                <p className="text-sm text-muted">{decision.explicacion}</p>
            </Stage>
        </div>
    );
}
