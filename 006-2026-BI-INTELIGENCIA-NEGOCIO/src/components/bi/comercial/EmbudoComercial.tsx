import type { ComercialData } from "@/lib/bi/comercial";
import { fmtMiles } from "../pulso/formatos";

/**
 * Embudo comercial (Lote A): de colegio registrado en PI a cliente que paga
 * (y lleva más de 30 días). Barras horizontales del sistema; el fill semántico
 * marca el paso más estrecho (pagantes) en rubí para que se lea de una: ahí se
 * pierde la conversión. Cifras del ResultSet (candado 10); si PI aún no tiene
 * colegios, se dice tal cual (candado 9).
 */
export default function EmbudoComercial({ data }: { data: ComercialData }) {
    const pasos = [
        { etiqueta: "Colegios registrados", total: data.embudo.registrados },
        { etiqueta: "Onboarding completado", total: data.embudo.onboardingCompletado },
        { etiqueta: "Freemium / pilotos", total: data.embudo.freemium },
        { etiqueta: "Suscripciones pagantes", total: data.embudo.pagantes, cuello: true },
        { etiqueta: "Clientes +30 días", total: data.embudo.renovaron },
    ];
    const todoEnCero = pasos.every((p) => p.total === 0);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "420ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Embudo comercial</h3>
            <div className="mb-4 text-[13px] text-muted">
                De colegio registrado a cliente que paga — el paso en rubí es donde se pierde la conversión
            </div>
            {todoEnCero ? (
                <p className="py-8 text-center text-[13.5px] text-muted">
                    Aún no hay colegios ni suscripciones replicados — el embudo se dibuja cuando PI registra
                    titulares.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {pasos.map((p, i) => {
                        const max = Math.max(...pasos.map((x) => x.total), 1);
                        return (
                            <div
                                key={p.etiqueta}
                                className="grid grid-cols-[minmax(0,170px)_1fr_60px] items-center gap-2.5 text-[13px]"
                                title={`${p.etiqueta}: ${fmtMiles(p.total)}`}
                            >
                                <span className={`truncate ${p.cuello ? "font-semibold text-estado-rubi" : ""}`}>
                                    {p.etiqueta}
                                </span>
                                <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                    <div
                                        className="barra-crece-x h-full rounded-md"
                                        style={
                                            {
                                                width: `${(p.total / max) * 100}%`,
                                                background: p.cuello
                                                    ? "rgb(var(--rubi-rgb))"
                                                    : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                                "--anim-retardo": `${i * 60}ms`,
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                                <span className="cifra text-right font-semibold">{fmtMiles(p.total)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
