import type { MotorData } from "@/lib/bi/salud-motor";

/** Etiquetas legibles para las señales de HealthProbe de PI. */
const ETIQUETAS_SENAL: Record<string, string> = {
    app: "App PI",
    worker: "Worker de reportes",
    bd: "Base de datos de PI",
    ollama_ping: "Ollama (ping)",
    ollama_smoke: "Ollama (smoke)",
    tailscale: "Tailscale · Mac",
};

/**
 * Semáforo de servicios (Lote C): una tarjeta por señal de HealthProbe con su
 * último resultado — verde si ok, rubí latiendo si falló, y cuántos minutos
 * hace de la lectura. Cuando PI aún no publica probes, se dice el vacío tal
 * cual (candado 9) — la salud real la escribe el monitor de PI en esta tabla.
 */
export default function ServiciosSalud({ senales }: { senales: MotorData["infraPorSenal"] }) {
    return (
        <div className="mb-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {senales.length === 0 ? (
                <div className="glass anim-entrada p-5" style={{ "--anim-retardo": "80ms" } as React.CSSProperties}>
                    <div className="flex items-center gap-2">
                        <span className="punto punto-warn anim-pulso" />
                        <span className="text-[13.5px] font-semibold">Sin señales de salud replicadas</span>
                    </div>
                    <p className="mt-2 text-[12.5px] text-muted">
                        HealthProbe aún no trae lecturas de PI — el semáforo aparece en cuanto el monitor de PI
                        registre la primera sonda.
                    </p>
                </div>
            ) : (
                senales.map((s, i) => (
                    <div
                        key={s.senal}
                        className="glass anim-entrada px-5 py-4"
                        style={{ "--anim-retardo": `${80 + i * 50}ms` } as React.CSSProperties}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className={`punto ${s.ok ? "punto-ok" : "punto-bad anim-pulso"}`} style={{ width: 12, height: 12 }} />
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
                                {s.ok ? "Operativo" : "Caído"}
                            </span>
                        </div>
                        <div className="mt-2 text-[14px] font-semibold">{ETIQUETAS_SENAL[s.senal] ?? s.senal}</div>
                        <div className="cifra mt-1 text-[12px] text-muted">
                            {s.latenciaMs > 0 ? `${Math.round(s.latenciaMs)} ms · ` : ""}
                            hace {s.haceMin < 1 ? "menos de 1 min" : `${s.haceMin} min`}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
