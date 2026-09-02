import type { AnaliticaData } from "@/lib/bi/analitica";
import { fmtMiles } from "@/components/bi/pulso/formatos";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-03" → "mar"; cualquier otro formato se respeta tal cual (solo presentación). */
function etiquetaMes(mes: string): string {
    const iso = /^\d{4}-(\d{2})/.exec(mes);
    if (iso) {
        const idx = Number(iso[1]) - 1;
        if (idx >= 0 && idx < 12) return MESES_CORTOS[idx];
    }
    return mes.slice(0, 3).toLowerCase();
}

/**
 * Cronología del año con fenómenos (mockup v4, sección 6): 12 barras
 * mensuales (mismo patrón de `barra-crece` del Pulso) y un marcador rubí
 * latiendo sobre cada mes donde el detector disparó (`conFenomeno` del
 * contrato — aquí no se deduce nada, candado 10). Vacío → nota honesta
 * (candado 9), nunca un eje de ceros.
 */
export default function CronologiaAnual({
    cronologia,
}: {
    cronologia: AnaliticaData["cronologia"];
}) {
    const max = Math.max(...cronologia.map((m) => m.total), 1);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "580ms" } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[17px] font-semibold">Cronología del año con fenómenos</h3>
            <div className="mb-4 text-[13px] text-muted">
                {cronologia.length} meses — cada punto rubí es un mes donde el detector disparó
            </div>
            {cronologia.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay histórico mensual en la réplica para trazar la cronología.
                </p>
            ) : (
                <div className="flex h-[170px] items-end gap-1.5 pt-2.5">
                    {cronologia.map((m, i) => (
                        <div
                            key={`${m.mes}-${i}`}
                            className="relative flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                            title={`${fmtMiles(m.total)} ${m.total === 1 ? "reporte" : "reportes"} · ${m.mes}${m.conFenomeno ? " · mes con fenómeno detectado" : ""}`}
                        >
                            {m.conFenomeno && (
                                <span
                                    className="anim-pulso absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[rgb(var(--rubi-rgb))] shadow-[0_0_10px_rgb(var(--rubi-rgb)/0.8)]"
                                    aria-label="Mes con fenómeno detectado"
                                />
                            )}
                            <span className="cifra text-[11px] font-semibold">{fmtMiles(m.total)}</span>
                            <div
                                className="barra-crece min-h-[3px] w-full max-w-[34px] rounded-b-sm rounded-t-md"
                                style={
                                    {
                                        height: `${(m.total / max) * 100}%`,
                                        backgroundImage:
                                            "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                        "--anim-retardo": `${i * 50}ms`,
                                    } as React.CSSProperties
                                }
                            />
                            <span className="text-[10px] text-subtle">{etiquetaMes(m.mes)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
