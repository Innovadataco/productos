"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { PatronesColegioDto } from "@/lib/colegio/patrones";

interface SeccionPatronesProps {
    patrones: PatronesColegioDto;
}

function ListaDesglose({ titulo, items, suprimidos }: { titulo: string; items: { clave: string; conteo: number }[]; suprimidos: boolean }) {
    return (
        <div>
            <h3 className="mb-2 text-sm font-semibold text-subtle">{titulo}</h3>
            {items.length === 0 ? (
                <p className="text-sm text-muted">Sin datos suficientes para desglosar.</p>
            ) : (
                <ul className="space-y-1">
                    {items.map((item) => (
                        <li key={item.clave} className="flex items-center justify-between text-sm">
                            <span className="text-body">{item.clave}</span>
                            <span className="cifra font-semibold text-body">{item.conteo}</span>
                        </li>
                    ))}
                </ul>
            )}
            {suprimidos && (
                <p className="mt-2 text-xs text-muted">Algunas categorías con pocos casos no se muestran para proteger la identidad.</p>
            )}
        </div>
    );
}

export function SeccionPatrones({ patrones }: SeccionPatronesProps) {
    const { total, porGrado, gradosSuprimidos, porConducta, conductasSuprimidas, porPlataforma, plataformasSuprimidas, tendencia } = patrones;

    return (
        <GlassCard>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Patrones institucionales</h2>
                    <p className="text-sm text-muted">Agregado del trimestre {patrones.periodo} · k-anonimato k={patrones.k}</p>
                </div>
                <div className="text-right">
                    <p className="cifra text-3xl font-bold text-body">{total}</p>
                    <p className="text-xs text-muted">reportes en el periodo</p>
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
                <ListaDesglose titulo="Por grado" items={porGrado} suprimidos={gradosSuprimidos} />
                <ListaDesglose titulo="Por conducta" items={porConducta} suprimidos={conductasSuprimidas} />
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-subtle">Por plataforma</h3>
                    {porPlataforma.length === 0 ? (
                        <p className="text-sm text-muted">Sin datos suficientes para desglosar.</p>
                    ) : (
                        <ul className="space-y-1">
                            {porPlataforma.map((item) => (
                                <li key={item.plataforma} className="flex items-center justify-between text-sm">
                                    <span className="text-body">{item.plataforma}</span>
                                    <span className="cifra font-semibold text-body">{item.conteo}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {plataformasSuprimidas && (
                        <p className="mt-2 text-xs text-muted">Algunas plataformas con pocos casos no se muestran.</p>
                    )}
                </div>
            </div>

            <p className="mt-4 text-sm text-muted">
                Trimestre anterior ({tendencia.periodoAnterior}):{" "}
                <span className="cifra font-semibold text-body">{tendencia.totalAnterior}</span> — variación{" "}
                <span className={`font-semibold ${tendencia.variacion > 0 ? "text-estado-rubi" : "text-body"}`}>
                    {tendencia.variacion > 0 ? "+" : ""}
                    {tendencia.variacion}
                </span>
            </p>
        </GlassCard>
    );
}
