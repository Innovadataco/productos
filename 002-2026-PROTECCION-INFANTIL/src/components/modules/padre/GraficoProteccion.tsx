/**
 * SPEC-660 · Gráfico de «A quién protejo» (Proceso 2 · Estado A · en calma).
 *
 * Compone TRES poblaciones que NO se funden (invariante estructural, más fuerte
 * que una regla — FORMA-SPEC660-CIRCULO-EN-EL-GRAFICO-PESO-Y-CONTEO):
 *   1. HIJOS = el sujeto. Nodos grandes (r=27), color por ESTADO.
 *   2. CÍRCULO = a quién vigila el padre. Puntos chicos (r=5), apagados, sobre
 *      el ARCO protector reusado (no un anillo nuevo). En calma, todos quietos.
 *   3. REPORTANTES = NUNCA se dibujan. El gráfico muestra ESTADO, no cuenta de
 *      reportantes ⇒ no existe superficie donde un número (verificados+anónimos)
 *      pueda aparecer. PROHIBIDO un contador sobre un nodo o el arco; el conteo
 *      vive SOLO en el detalle (ola-2). Si nace la tentación de un badge numérico
 *      acá, es la señal de que se salió del diseño.
 *
 * PESO: un familiar NUNCA iguala a un hijo (tamaño ni saturación). Colores por
 * token del sistema de diseño (piso `tokens:check`), NUNCA rojo. El hueco de
 * cobertura (hijo activo sin cuentas) es CIELO, no ámbar: es un por-hacer, no una
 * alarma (un color = un significado). Ámbar queda reservado al reporte (ola-2).
 *
 * Es presentacional: recibe los hijos con su estado YA derivado y el conteo del
 * círculo. La derivación (de `listarHijos`) y el cableado viven en la pantalla.
 */

/**
 * Estado del hijo en el gráfico. La derivación vive en la PANTALLA (Fase B), no
 * acá: este componente solo pinta el estado que recibe. Extender = sumar un valor
 * a la unión + su entrada en `COLOR` y `SUBTITULO` (TS obliga la exhaustividad,
 * no es una reescritura). Estados PENDIENTES, preparados para entrar sin re-escribir:
 *  - `atencion` (ámbar): un reporte visible tocó una cuenta del hijo. Dato: #573
 *    `tieneReportes: boolean` (booleano, no conteo — Diseño prohibió números sobre
 *    nodos). Es OLA-2, en espera del cableado.
 *  - `degradado`/`sin-confirmar`: I-396 — con el motor caído, `tieneReportes` de un
 *    hijo REPORTADO devuelve `false`, y pintar «tranquilo» sería calma sobre un niño
 *    recién reportado (tercera superficie del mismo defecto). Si Diseño decide que el
 *    gráfico consuma el helper de liveness (SPEC-670) y tenga su propio estado
 *    degradado, entra por acá. **Por eso `tranquilo` es PROVISIONAL: no cerrar su copy
 *    como «no pasó nada» hasta que Diseño conteste.**
 */
export type EstadoHijoGrafico = "tranquilo" | "sin-cuentas" | "en-pausa";

export interface HijoGrafico {
    id: string;
    nombre: string;
    estado: EstadoHijoGrafico;
}

/** Posiciones fijas de los familiares sobre el arco (mockup vigente). Hasta 4. */
const PUNTOS_CIRCULO = [
    { x: 95, y: 60 },
    { x: 150, y: 51 },
    { x: 210, y: 51 },
    { x: 265, y: 60 },
] as const;

const COLOR = {
    tranquilo: { trazo: "rgb(var(--pino-rgb))", relleno: "rgb(var(--pino-rgb) / 0.1)", tinta: "rgb(var(--pino-rgb))" },
    // Hueco de cobertura: CIELO (por-hacer), nunca ámbar. Dash = «sin cuentas».
    "sin-cuentas": { trazo: "rgb(var(--cielo-rgb))", relleno: "rgb(var(--cielo-rgb) / 0.08)", tinta: "rgb(var(--cielo-700-rgb))" },
    "en-pausa": { trazo: "rgb(var(--tinta-subtle-rgb))", relleno: "rgb(var(--tinta-rgb) / 0.04)", tinta: "rgb(var(--tinta-subtle-rgb))" },
} as const;

const SUBTITULO: Record<EstadoHijoGrafico, string> = {
    tranquilo: "tranquilo",
    "sin-cuentas": "sin cuentas",
    "en-pausa": "en pausa",
};

/** X de cada hijo, centrados en 180 y espaciados sin pisarse (r=27). */
function posicionesHijos(n: number): number[] {
    if (n <= 0) return [];
    const paso = Math.min(80, Math.floor(300 / n));
    const inicio = 180 - (paso * (n - 1)) / 2;
    return Array.from({ length: n }, (_, i) => Math.round(inicio + paso * i));
}

function iniciales(nombre: string): string {
    return (nombre.trim()[0] ?? "·").toUpperCase();
}

export function GraficoProteccion({ hijos, circuloPersonas }: { hijos: HijoGrafico[]; circuloPersonas: number }) {
    const xs = posicionesHijos(hijos.length);
    const puntos = PUNTOS_CIRCULO.slice(0, Math.max(0, Math.min(circuloPersonas, PUNTOS_CIRCULO.length)));
    const descripcion =
        hijos.length === 0
            ? "Todavía no registraste a ningún menor"
            : hijos.map((h) => `${h.nombre} ${SUBTITULO[h.estado]}`).join("; ");

    return (
        <svg viewBox="0 0 360 176" role="img" aria-label={descripcion} className="mx-auto block h-auto w-full">
            {/* Arco protector (reusado): el arco es el círculo, los puntos la gente. */}
            <path
                d="M30 120 C 60 46, 300 46, 330 120"
                fill="none"
                stroke="rgb(var(--pino-rgb) / 0.28)"
                strokeWidth="2.5"
                strokeLinecap="round"
            />

            {/* Círculo de familiares: capa exterior TENUE, apagada, quieta en calma. */}
            {puntos.map((p, i) => (
                <circle key={`fam-${i}`} cx={p.x} cy={p.y} r="5" fill="rgb(var(--tinta-subtle-rgb) / 0.5)" />
            ))}

            {/* Hijos: nodos grandes, color por estado. Nunca rojo; sin-cuentas = cielo. */}
            {hijos.map((h, i) => {
                const x = xs[i]!;
                const c = COLOR[h.estado];
                const esHueco = h.estado === "sin-cuentas";
                return (
                    <g key={h.id}>
                        <circle
                            cx={x}
                            cy={104}
                            r="27"
                            fill={c.relleno}
                            stroke={c.trazo}
                            strokeWidth="2.4"
                            strokeDasharray={esHueco ? "4 4" : undefined}
                        />
                        <text x={x} y={109} textAnchor="middle" fontSize="15" fontWeight="700" fill={c.tinta}>
                            {iniciales(h.nombre)}
                        </text>
                        <text x={x} y={152} textAnchor="middle" fontSize="12" fontWeight="600" fill="rgb(var(--tinta-rgb))">
                            {h.nombre.trim().split(/\s+/)[0]}
                        </text>
                        <text x={x} y={166} textAnchor="middle" fontSize="9.5" fill={c.tinta}>
                            {SUBTITULO[h.estado]}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
