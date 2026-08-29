"use client";

import { useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Acento } from "./util";
import type { CuponRecompensaDTO } from "@/lib/pagos/entregar-cupones-recompensa.service";

const ZONA_BOGOTA = "America/Bogota";

interface MisCuponesCardProps {
    cupones: CuponRecompensaDTO[];
    acento: Acento;
}

function estadoCupon(cupon: CuponRecompensaDTO): { label: string; clases: string } {
    const ahora = toZonedTime(new Date(), ZONA_BOGOTA);
    if (cupon.usos > 0) {
        return { label: "Usado", clases: "bg-tinta/10 text-muted" };
    }
    if (cupon.vigenciaFin < ahora) {
        return { label: "Vencido", clases: "bg-rubi/10 text-rubi" };
    }
    return { label: "Vigente", clases: "bg-pino/10 text-pino" };
}

function formatoFecha(fecha: Date): string {
    return fecha.toLocaleDateString("es-CO", { timeZone: ZONA_BOGOTA });
}

/**
 * SPEC-246 (002-PI-149): tarjeta con los cupones de recompensa del padre.
 * Muestra código, % descuento, vigencia Bogotá, estado y botón copiar.
 */
export function MisCuponesCard({ cupones, acento }: MisCuponesCardProps) {
    const [copiado, setCopiado] = useState<string | null>(null);

    async function copiar(codigo: string) {
        try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(codigo);
            setTimeout(() => setCopiado(null), 1500);
        } catch {
            setCopiado(null);
        }
    }

    if (cupones.length === 0) {
        return null;
    }

    return (
        <GlassCard data-testid="mis-cupones" className="p-6">
            <h2 className="text-lg font-bold text-body">Mis cupones de recompensa</h2>
            <p className="mt-1 text-sm text-muted">
                Comparte estos códigos. Cada uno aplica un descuento en la primera compra de quien lo use.
            </p>

            <ul className="mt-4 space-y-3">
                {cupones.map((cupon) => {
                    const estado = estadoCupon(cupon);
                    return (
                        <li
                            key={cupon.id}
                            className="flex flex-col gap-2 rounded-xl border border-tinta/10 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-tinta/20"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-base font-semibold tracking-wide text-body">
                                        {cupon.nombre}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clases}`}>
                                        {estado.label}
                                    </span>
                                </div>
                                <p className="text-sm text-muted">
                                    {cupon.valor}% de descuento · vigente hasta {formatoFecha(cupon.vigenciaFin)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => copiar(cupon.nombre)}
                                disabled={cupon.usos > 0 || cupon.vigenciaFin < toZonedTime(new Date(), ZONA_BOGOTA)}
                                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${acento.boton}`}
                            >
                                {copiado === cupon.nombre ? "Copiado" : "Copiar"}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </GlassCard>
    );
}
