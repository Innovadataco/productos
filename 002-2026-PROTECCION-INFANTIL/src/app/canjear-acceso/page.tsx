"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCategoria } from "@/lib/labels";

/** Un evento del expediente tal como llega en el JSON de /api/reportes/acceso/ver. */
interface EventoLeido {
    eventoId: string;
    fecha: string;
    texto: string;
    /** true = «Anotado por la familia» (sin reporte, sin chip de análisis, D-130). */
    esManual: boolean;
    /** Categoría del análisis; solo en eventos de origen reporte (D-130). */
    categoria: string | null;
}

interface CasoAbierto {
    eventos: EventoLeido[];
    gravedad: string;
    expiraEn: string;
}

/**
 * SPEC-610 (I-372 · D-123/D-129/D-130) · «Abrir un caso con un pase».
 *
 * El profesional (o el mismo padre) digita EL PASE de 8 caracteres que le pasó el
 * padre o la madre. Al abrirlo se lee el EXPEDIENTE COMPLETO durante 15 minutos:
 * TODOS sus eventos, en orden. D-129: acá se dice «el pase», nunca «código» (la
 * «llave» de 6 dígitos es del lado del padre y no se entrega). D-130: los eventos
 * anotados por la familia se marcan como tales y NO llevan chip de análisis; los de
 * origen reporte muestran «Clasificado por el análisis».
 */
export default function CanjearAccesoPage() {
    const [pase, setPase] = useState("");
    const [caso, setCaso] = useState<CasoAbierto | null>(null);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    async function abrirCaso() {
        setCargando(true);
        setError("");
        try {
            // El canje abre la sesión de 15 min; la lectura trae el expediente entero.
            const resCanje = await fetch("/api/reportes/acceso/canjar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ codigo: pase.trim() }),
            });
            const canje = await resCanje.json();
            if (!resCanje.ok) throw new Error(canje?.error?.message ?? "No pudimos abrir el caso con ese pase.");

            const resVer = await fetch(`/api/reportes/acceso/ver?token=${encodeURIComponent(canje.tokenSesion)}`, {
                credentials: "include",
            });
            const data = await resVer.json();
            if (!resVer.ok) throw new Error(data?.error?.message ?? "No pudimos leer el caso.");
            setCaso(data as CasoAbierto);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setCargando(false);
        }
    }

    return (
        <main className="mx-auto max-w-2xl px-4 py-12">
            <h1 className="text-2xl font-bold text-body">Abrir un caso con un pase</h1>
            <p className="mt-2 text-sm text-muted">
                Pídale el pase al padre o a la madre. Son 8 caracteres. Al abrirlo podrá leer el caso completo durante
                15 minutos.
            </p>

            {caso ? (
                <div className="mt-6 space-y-4">
                    <p className="text-xs text-muted">
                        El caso queda abierto hasta las{" "}
                        {new Date(caso.expiraEn).toLocaleTimeString("es-CO", {
                            timeZone: "America/Bogota",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                        .
                    </p>

                    {caso.eventos.length === 0 ? (
                        <GlassCard className="p-6">
                            <p className="text-sm text-muted">Este caso todavía no tiene anotaciones.</p>
                        </GlassCard>
                    ) : (
                        <ol className="space-y-4">
                            {caso.eventos.map((evento) => (
                                <li key={evento.eventoId}>
                                    <GlassCard className="p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs text-subtle">
                                                {new Date(evento.fecha).toLocaleDateString("es-CO", {
                                                    timeZone: "America/Bogota",
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                })}
                                            </p>
                                            {evento.esManual ? (
                                                // D-130: lo anotó la familia. Sin chip de análisis.
                                                <span className="text-xs text-muted">Anotado por la familia</span>
                                            ) : (
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs text-muted">Clasificado por el análisis</span>
                                                    {evento.categoria ? (
                                                        <span className="rounded-full bg-cielo/10 px-2 py-0.5 text-xs font-medium text-estado-cielo">
                                                            {formatCategoria(evento.categoria)}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-3 whitespace-pre-line text-sm text-body">{evento.texto}</p>
                                    </GlassCard>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            ) : (
                <form
                    className="mt-6 space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void abrirCaso();
                    }}
                >
                    <label className="block text-sm text-muted" htmlFor="pase">
                        El pase
                    </label>
                    <input
                        id="pase"
                        value={pase}
                        onChange={(e) => setPase(e.target.value)}
                        className="w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 uppercase tracking-widest text-body"
                        placeholder="ABCD2345"
                        autoComplete="off"
                        maxLength={12}
                    />
                    {error && <p className="text-xs text-estado-rubi">{error}</p>}
                    <Button type="submit" disabled={cargando || pase.trim().length < 4}>
                        {cargando ? "Abriendo el caso..." : "Abrir el caso"}
                    </Button>
                </form>
            )}
        </main>
    );
}
