/**
 * SPEC-171 (Pilar B) — Semáforo de una señal de infraestructura.
 * Tarjeta de solo lectura: punto de color (verde/rojo/amarillo/no-aplica),
 * hint en criollo y fecha del último chequeo del vigilante.
 */

export type EstadoSemaforo = "verde" | "rojo" | "amarillo" | "no-aplica";

export type SemaforoCardProps = {
    nombre: string;
    estado: EstadoSemaforo;
    ultimoProbeEn: string | null;
    hint: string;
};

/** Configuración de las 6 señales del tablero (clave del endpoint + rótulos criollo). */
export const SENALES_OPERACION: { clave: string; nombre: string; hint: string }[] = [
    { clave: "app", nombre: "Aplicación", hint: "La aplicación responde" },
    { clave: "worker", nombre: "Procesador de reportes", hint: "El procesador de reportes tiene señal de vida" },
    { clave: "bd", nombre: "Base de datos", hint: "La base de datos contesta" },
    { clave: "ollama_ping", nombre: "Cerebro IA", hint: "El cerebro IA atiende" },
    { clave: "ollama_smoke", nombre: "Clasificación real del cerebro", hint: "El cerebro IA completó una clasificación mínima real" },
    { clave: "tailscale", nombre: "Túnel Tailscale", hint: "El túnel entre el servidor y el cerebro está vivo" },
];

export function nombreSenal(clave: string): string {
    return SENALES_OPERACION.find((s) => s.clave === clave)?.nombre ?? clave;
}

const ESTADO_CONFIG: Record<EstadoSemaforo, { label: string; punto: string; texto: string }> = {
    verde: {
        label: "Operativo",
        punto: "bg-emerald-500",
        texto: "text-emerald-700 dark:text-emerald-300",
    },
    rojo: {
        label: "Con problema",
        punto: "bg-red-500",
        texto: "text-red-700 dark:text-red-300",
    },
    amarillo: {
        label: "Con demora",
        punto: "bg-amber-400",
        texto: "text-amber-700 dark:text-amber-300",
    },
    "no-aplica": {
        label: "No aplica",
        punto: "bg-slate-300 dark:bg-slate-600",
        texto: "text-subtle",
    },
};

export function formatoUltimoProbe(ultimoProbeEn: string | null): string {
    if (!ultimoProbeEn) return "Sin chequeos aún";
    const fecha = new Date(ultimoProbeEn);
    if (Number.isNaN(fecha.getTime())) return "Sin chequeos aún";
    return `Último chequeo: ${fecha.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" })}`;
}

export function SemaforoCard({ nombre, estado, ultimoProbeEn, hint }: SemaforoCardProps) {
    const config = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG["no-aplica"];
    return (
        <article
            className="glass rounded-2xl p-5 transition hover:shadow-md motion-reduce:transition-none"
            aria-label={`Señal ${nombre}: ${config.label}`}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-body">{nombre}</p>
                <span className={`h-3 w-3 shrink-0 rounded-full ${config.punto}`} aria-hidden="true" />
            </div>
            <p className={`mt-2 text-lg font-bold ${config.texto}`}>{config.label}</p>
            <p className="mt-1 text-xs text-muted">{hint}</p>
            <p className="mt-3 text-xs text-subtle">{formatoUltimoProbe(ultimoProbeEn)}</p>
        </article>
    );
}
