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
 * Estado del hijo en el gráfico. Se DERIVA de dos señales (Diseño SPEC-660 · I-396):
 * `tieneReportes` (#573, Datos) + `motorVivo` (LatidoMotor de SPEC-670, #572).
 *  - `en-pausa` (inactivo, gris) · `sin-cuentas` (activo sin cuentas activas → hueco
 *    de cobertura, CIELO; independiente del motor: sin cuentas no hay nada que cruzar).
 *  - `atencion` (ámbar): reporte visible en una cuenta del hijo. **Se conserva AUNQUE
 *    el motor esté caído** — un `tieneReportes:true` es hecho verificado.
 *  - `tranquilo` (verde) SOLO con motor VIVO · `en-revision` (NEUTRO, nunca rojo) con
 *    motor CAÍDO. La ASIMETRÍA es el punto: el motor caído vuelve no-confiable la
 *    AUSENCIA de reportes (`false` = «no hay» o «no clasificó aún»), no la PRESENCIA.
 *    Por eso solo el verde degrada a neutro. **Nunca falsa calma, nunca falsa alarma.**
 * Extender = sumar a la unión + su entrada en `COLOR`/`SUBTITULO` (TS obliga exhaustividad).
 */
export type EstadoHijoGrafico = "tranquilo" | "sin-cuentas" | "en-pausa" | "atencion" | "en-revision";

export interface HijoGrafico {
    id: string;
    nombre: string;
    activo: boolean;
    /** ≥1 identificador activo (de `listarHijos`). false → hueco de cobertura. */
    tieneCuentasActivas: boolean;
    /** #573: un reporte VISIBLE tocó una cuenta activa del hijo (booleano, no conteo). */
    tieneReportes: boolean;
}

/**
 * Deriva el estado del nodo a partir de las DOS señales. Núcleo testeable: aquí vive
 * la asimetría «el ámbar se conserva, solo el verde degrada» (I-396, defensa en forma).
 */
export function derivarEstadoHijo(h: Omit<HijoGrafico, "id" | "nombre">, motorVivo: boolean): EstadoHijoGrafico {
    if (!h.activo) return "en-pausa";
    if (!h.tieneCuentasActivas) return "sin-cuentas";
    if (h.tieneReportes) return "atencion"; // hecho verificado: ámbar aunque el motor esté caído
    return motorVivo ? "tranquilo" : "en-revision"; // la ausencia no es confiable sin motor
}

/** Posiciones fijas de los familiares sobre el arco (mockup vigente). Hasta 4. */
const PUNTOS_CIRCULO = [
    { x: 95, y: 60 },
    { x: 150, y: 51 },
    { x: 210, y: 51 },
    { x: 265, y: 60 },
] as const;

const COLOR: Record<EstadoHijoGrafico, { trazo: string; relleno: string; tinta: string }> = {
    tranquilo: { trazo: "rgb(var(--pino-rgb))", relleno: "rgb(var(--pino-rgb) / 0.1)", tinta: "rgb(var(--pino-rgb))" },
    // Hueco de cobertura: CIELO (por-hacer), nunca ámbar. Dash = «sin cuentas».
    "sin-cuentas": { trazo: "rgb(var(--cielo-rgb))", relleno: "rgb(var(--cielo-rgb) / 0.08)", tinta: "rgb(var(--cielo-700-rgb))" },
    "en-pausa": { trazo: "rgb(var(--tinta-subtle-rgb))", relleno: "rgb(var(--tinta-rgb) / 0.04)", tinta: "rgb(var(--tinta-subtle-rgb))" },
    // Reporte visible: ÁMBAR (nunca rojo — el peso lo carga el copy, SPEC-362).
    atencion: { trazo: "rgb(var(--ambar-rgb))", relleno: "rgb(var(--ambar-rgb) / 0.14)", tinta: "rgb(var(--ambar-ink-rgb))" },
    // Motor caído, sin reportes: NEUTRO «en revisión» (estado del sistema, no alarma). Nunca rojo, nunca verde.
    "en-revision": { trazo: "rgb(var(--tinta-subtle-rgb))", relleno: "rgb(var(--tinta-rgb) / 0.05)", tinta: "rgb(var(--tinta-muted-rgb))" },
} as const;

const SUBTITULO: Record<EstadoHijoGrafico, string> = {
    tranquilo: "tranquilo",
    "sin-cuentas": "sin cuentas",
    "en-pausa": "en pausa",
    atencion: "necesita atención",
    "en-revision": "en revisión",
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

export function GraficoProteccion({
    hijos,
    motorVivo,
    circuloPersonas,
}: {
    hijos: HijoGrafico[];
    /** LatidoMotor (SPEC-670, #572): si el motor no confirma, el verde degrada a neutro. */
    motorVivo: boolean;
    circuloPersonas: number;
}) {
    const xs = posicionesHijos(hijos.length);
    const puntos = PUNTOS_CIRCULO.slice(0, Math.max(0, Math.min(circuloPersonas, PUNTOS_CIRCULO.length)));
    const estados = hijos.map((h) => derivarEstadoHijo(h, motorVivo));
    const descripcion =
        hijos.length === 0
            ? "Todavía no registraste a ningún menor"
            : hijos.map((h, i) => `${h.nombre} ${SUBTITULO[estados[i]!]}`).join("; ");

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

            {/* Círculo de familiares: capa exterior TENUE, apagada, quieta. */}
            {puntos.map((p, i) => (
                <circle key={`fam-${i}`} cx={p.x} cy={p.y} r="5" fill="rgb(var(--tinta-subtle-rgb) / 0.5)" />
            ))}

            {/* Hijos: nodos grandes, color por estado derivado. Nunca rojo. */}
            {hijos.map((h, i) => {
                const x = xs[i]!;
                const estado = estados[i]!;
                const c = COLOR[estado];
                return (
                    <g key={h.id}>
                        {estado === "atencion" && (
                            // Anillo exterior ámbar: el hijo domina. Nunca rojo.
                            <circle cx={x} cy={104} r="33" fill="none" stroke="rgb(var(--ambar-rgb))" strokeWidth="2" opacity="0.4" />
                        )}
                        <circle
                            cx={x}
                            cy={104}
                            r="27"
                            fill={c.relleno}
                            stroke={c.trazo}
                            strokeWidth="2.4"
                            strokeDasharray={estado === "sin-cuentas" ? "4 4" : undefined}
                        />
                        <text x={x} y={109} textAnchor="middle" fontSize="15" fontWeight="700" fill={c.tinta}>
                            {iniciales(h.nombre)}
                        </text>
                        <text x={x} y={152} textAnchor="middle" fontSize="12" fontWeight="600" fill="rgb(var(--tinta-rgb))">
                            {h.nombre.trim().split(/\s+/)[0]}
                        </text>
                        <text x={x} y={166} textAnchor="middle" fontSize="9.5" fill={c.tinta}>
                            {SUBTITULO[estado]}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
