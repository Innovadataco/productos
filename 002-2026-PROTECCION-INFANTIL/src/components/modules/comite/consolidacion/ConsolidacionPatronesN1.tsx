"use client";

// SPEC-237 (002-PI-mega-cola): patrones N1 detectados, verificables por el
// comité. La verificación es una ayuda visual local (checklist de lectura);
// la decisión formal se registra con Aprobar/Corregir/Devolver.
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { PatronDto } from "./tipos";

const SEVERIDAD_BADGE: Record<string, string> = {
    ALTA: "bg-rubi/10 text-rubi",
    MEDIA: "bg-ambar/10 text-ambar",
    BAJA: "bg-pino/10 text-pino",
};

export function ConsolidacionPatronesN1({ patrones }: { patrones: PatronDto[] }) {
    const [verificados, setVerificados] = useState<Set<string>>(new Set());

    const alternar = (id: string) => {
        setVerificados((prev) => {
            const siguiente = new Set(prev);
            if (siguiente.has(id)) {
                siguiente.delete(id);
            } else {
                siguiente.add(id);
            }
            return siguiente;
        });
    };

    return (
        <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">Patrones N1 detectados</h3>
            {patrones.length === 0 ? (
                <p className="text-sm text-muted">No se detectaron patrones en este expediente.</p>
            ) : (
                <ul className="space-y-3">
                    {patrones.map((p) => {
                        const verificado = verificados.has(p.id);
                        return (
                            <li key={p.id} className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={() => alternar(p.id)}
                                    aria-pressed={verificado}
                                    aria-label={verificado ? `Patrón ${p.tipo} verificado` : `Marcar patrón ${p.tipo} como verificado`}
                                    className="mt-0.5 text-pino"
                                >
                                    {verificado ? (
                                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                                    ) : (
                                        <Circle className="h-5 w-5 text-muted" aria-hidden />
                                    )}
                                </button>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-body">{p.tipo}</span>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERIDAD_BADGE[p.severidad] ?? "bg-tinta/10 text-muted"}`}
                                        >
                                            {p.severidad}
                                        </span>
                                        <span className="text-xs text-muted">
                                            Confianza {Math.round(p.nivelConfianza * 100)}%
                                        </span>
                                    </div>
                                    <p className="text-sm text-body">{p.descripcion}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
