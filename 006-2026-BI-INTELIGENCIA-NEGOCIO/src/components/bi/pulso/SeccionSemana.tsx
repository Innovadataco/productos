import type { PulsoData } from "@/lib/bi/pulso";
import CifraAnimada from "./CifraAnimada";

/* ─── Semántica del delta semanal (criterio documentado, jamás un veredicto) ─
   · Reportes y alertas nuevas (métricas de "carga"): SUBIR es warn — más
     reportes NO es "mejor" (es más carga operativa / alerta temprana);
     BAJAR se muestra NEUTRO: menos reportes puede ser subregistro, no se
     aplaude como logro.
   · Clasificación media ("rapidez"): BAJAR es la mejora (pino) — menos horas
     de espera; SUBIR es warn (más lenta).
   · Sin base (previo NULL, o previo 0 con actual > 0) → "sin comparación":
     jamás un % inventado (candado 9).
   · El % se deriva en UI de DOS cifras del contrato (actual y previa, ambas
     del ResultSet): es forma de presentación, no una métrica nueva
     (candado 10). */
type TipoMetrica = "carga" | "rapidez";
type TonoDelta = "pino" | "ambar" | "neutro";

const CLASE_TONO: Record<TonoDelta, string> = {
    pino: "text-estado-pino",
    ambar: "text-estado-ambar",
    neutro: "text-subtle",
};

interface DeltaSemanal {
    texto: string;
    tono: TonoDelta;
}

/**
 * Delta % semana actual vs. anterior con flecha y tono según la semántica de
 * la métrica (ver criterio arriba). previo NULL/0 no da base honesta de %.
 */
function deltaSemanal(
    actual: number,
    previo: number | null,
    tipo: TipoMetrica,
): DeltaSemanal {
    if (previo === null) return { texto: "sin comparación", tono: "neutro" };
    if (previo === 0) {
        if (actual === 0) return { texto: "igual que la semana anterior", tono: "neutro" };
        // De 0 a N>0 no existe % honesto; en métricas de carga el alza importa.
        return {
            texto: "sin comparación (0 la semana anterior)",
            tono: tipo === "carga" ? "ambar" : "neutro",
        };
    }
    const pct = Math.round(((actual - previo) / previo) * 100);
    if (pct === 0) return { texto: "igual que la semana anterior", tono: "neutro" };
    const base = `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs. la semana anterior`;
    if (tipo === "carga") {
        // Subir reportes/alertas = atención (NO mejora); bajar = neutro.
        return pct > 0
            ? { texto: `${base} · más carga`, tono: "ambar" }
            : { texto: base, tono: "neutro" };
    }
    // Rapidez: bajar la media de horas es la mejora.
    return pct < 0
        ? { texto: `${base} · más rápida`, tono: "pino" }
        : { texto: `${base} · más lenta`, tono: "ambar" };
}

/** Minicard de la comparativa: cifra de ESTA semana (count-up) + delta vs. la anterior. */
function MiniSemana({
    etiqueta,
    valor,
    previo,
    tipo,
    decimales = 0,
    unidad,
}: {
    etiqueta: string;
    /** Cifra de los últimos 7 días · NULL → "—" y "sin datos" (candado 9). */
    valor: number | null;
    /** Cifra de los 7 días anteriores · NULL → "sin comparación". */
    previo: number | null;
    tipo: TipoMetrica;
    decimales?: number;
    unidad?: string;
}) {
    const delta: DeltaSemanal =
        valor === null
            ? { texto: "sin datos", tono: "neutro" }
            : deltaSemanal(valor, previo, tipo);
    return (
        <div className="rounded-xl border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--tinta-rgb)/0.03)] p-4">
            <div className="microetiqueta">{etiqueta}</div>
            <div className="cifra mt-1.5 text-[30px] font-bold leading-[1.1] tracking-tight">
                {valor === null ? (
                    "—"
                ) : (
                    <>
                        <CifraAnimada valor={valor} decimales={decimales} />
                        {unidad && (
                            <span className="ml-1 text-[15px] font-normal text-muted">{unidad}</span>
                        )}
                    </>
                )}
            </div>
            <div className={`mt-1 text-[12px] font-semibold ${CLASE_TONO[delta.tono]}`}>
                {delta.texto}
            </div>
        </div>
    );
}

/**
 * Sección "Semana contra semana" del Pulso siguiente nivel: tres minicards
 * (reportes, alertas nuevas, clasificación media) con la cifra de los
 * últimos 7 días y el delta % contra los 7 anteriores. Toda cifra sale de
 * PulsoData.semana; la sección solo presenta (candados 9 y 10).
 */
export default function SeccionSemana({
    semana,
    retardo = 0,
}: {
    semana: PulsoData["semana"];
    retardo?: number;
}) {
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Semana contra semana</h3>
            <div className="mb-4 text-[13px] text-muted">
                Últimos 7 días contra los 7 anteriores · subir reportes o alertas es
                atención, no mejora
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <MiniSemana
                    etiqueta="Reportes · 7 d"
                    valor={semana.reportes7d}
                    previo={semana.reportes7dPrevios}
                    tipo="carga"
                />
                <MiniSemana
                    etiqueta="Alertas nuevas · 7 d"
                    valor={semana.alertasNuevas7d}
                    previo={semana.alertasNuevas7dPrevias}
                    tipo="carga"
                />
                <MiniSemana
                    etiqueta="Clasificación media · 7 d"
                    valor={semana.clasificacionMediaHoras7d}
                    previo={semana.clasificacionMediaHorasPrevias}
                    tipo="rapidez"
                    decimales={1}
                    unidad="h"
                />
            </div>
        </div>
    );
}
