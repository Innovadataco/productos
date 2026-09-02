import Link from "next/link";
import type { AnaliticaData } from "@/lib/bi/analitica";

type Fenomeno = AnaliticaData["fenomenos"][number];

const BORDE_SEV: Record<Fenomeno["sev"], string> = {
    alta: "border-l-[rgb(var(--rubi-rgb))]",
    media: "border-l-[rgb(var(--ambar-rgb))]",
    informativa: "border-l-[rgb(var(--cielo-rgb))]",
};

const COLOR_TAG_SEV: Record<Fenomeno["sev"], string> = {
    alta: "text-estado-rubi",
    media: "text-estado-ambar",
    informativa: "text-[rgb(var(--cielo-ink-rgb))]",
};

const ETIQUETA_TIPO: Record<Fenomeno["tipo"], string> = {
    plataforma: "⚡ Fenómeno · plataforma × tiempo",
    rafaga: "◆ Ráfaga · mismo origen",
    geo: "◆ Geografía fuera de rango",
};

/**
 * Botones decorativos del mockup v4: llevan a la pantalla donde se profundiza
 * cada fenómeno (geografía u operación); la acción real de vigilancia es
 * trabajo humano fuera de esta pantalla.
 */
function Acciones({ tipo }: { tipo: Fenomeno["tipo"] }) {
    const btn =
        "rounded-full border border-[rgb(var(--tinta-rgb)/0.14)] px-3.5 py-1.5 text-[12.5px] font-semibold transition-all hover:bg-[rgb(var(--tinta-rgb)/0.07)]";
    const btnPrimario =
        "rounded-full border border-transparent bg-[rgb(var(--pino-rgb))] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#060b0a] transition-all hover:brightness-110";

    if (tipo === "plataforma") {
        return (
            <div className="mt-3.5 flex gap-2">
                <Link href="/operacion" className={btnPrimario}>
                    Ver la serie →
                </Link>
                <Link href="/operacion" className={btn}>
                    Vigilar
                </Link>
            </div>
        );
    }
    if (tipo === "rafaga") {
        return (
            <div className="mt-3.5 flex gap-2">
                <Link href="/operacion" className={btn}>
                    Ver antifraude →
                </Link>
            </div>
        );
    }
    return (
        <div className="mt-3.5 flex gap-2">
            <Link href="/geografia" className={btn}>
                Ver en el mapa →
            </Link>
        </div>
    );
}

/**
 * Detector de fenómenos (mockup v4, sección 4 — el corazón proactivo): cruces
 * que rompen el patrón, con la EVIDENCIA siempre visible (candado 9: ningún
 * fenómeno se afirma sin mostrar de dónde sale). Borde izquierdo por severidad
 * (rubí/alta, ámbar/media, cielo/informativa) y brillo en la primera card, la
 * más reciente. Vacío → card honesta, nunca una sección muda.
 */
export default function DetectorFenomenos({
    fenomenos,
}: {
    fenomenos: AnaliticaData["fenomenos"];
}) {
    return (
        <>
            <div
                className="microetiqueta anim-entrada mb-3 flex items-center gap-2"
                style={{ "--anim-retardo": "240ms" } as React.CSSProperties}
            >
                <span className={`punto ${fenomenos.length > 0 ? "punto-bad anim-pulso" : "punto-ok"}`} />
                Detector de fenómenos · cruces que rompen el patrón
            </div>
            {fenomenos.length === 0 ? (
                <div
                    className="glass anim-entrada mb-6 border-l-4 border-l-[rgb(var(--pino-rgb))] p-6"
                    style={{ "--anim-retardo": "280ms" } as React.CSSProperties}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="punto punto-ok" />
                        <h4 className="text-[16.5px] font-semibold">
                            Sin fenómenos activos: la operación sigue su patrón
                        </h4>
                    </div>
                    <p className="mt-1.5 text-[13.5px] text-muted">
                        El detector cruzó plataformas, ráfagas y geografía sin encontrar desviaciones
                        significativas en la ventana reciente.
                    </p>
                </div>
            ) : (
                <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                    {fenomenos.map((f, i) => (
                        <div
                            key={`${f.tipo}-${f.titulo}-${i}`}
                            className={`glass anim-entrada border-l-4 p-6 ${BORDE_SEV[f.sev]} ${i === 0 ? "brillo-nuevo" : ""}`}
                            style={{ "--anim-retardo": `${280 + i * 60}ms` } as React.CSSProperties}
                        >
                            <span
                                className={`text-[11px] font-bold uppercase tracking-[0.12em] ${COLOR_TAG_SEV[f.sev]}`}
                            >
                                {ETIQUETA_TIPO[f.tipo]}
                            </span>
                            <h4 className="mb-1.5 mt-2 text-[16.5px] font-semibold leading-snug">{f.titulo}</h4>
                            <p className="text-[13.5px] leading-relaxed text-muted">{f.detalle}</p>
                            <p className="mt-2 text-[12px] text-subtle">
                                Evidencia: {f.evidencia}
                            </p>
                            <Acciones tipo={f.tipo} />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
