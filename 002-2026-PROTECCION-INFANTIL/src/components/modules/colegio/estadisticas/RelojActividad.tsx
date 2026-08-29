import type { CSSProperties } from "react";

/**
 * SPEC-158 (T005, US2, FR-004) — Reloj de actividad 24 h: EL gráfico clave del
 * tablero (§10 fila 6). SVG PROPIO (§4.4, nada de librería radial): 24 barras
 * radiales desde el centro, una por hora del día en hora de Colombia, cuya
 * longitud codifica los reportes distintos (métrica D2). La hora pico se marca
 * en cielo y el resto en tinta — la forma es el dato (§4.0.2). Las barras se
 * dibujan al entrar con la curva única (anim-dibujo); reduced-motion las deja
 * quietas y completas (el dashoffset base ya es el final). Resumen sr-only con
 * el rango pico; estado vacío honesto, nunca picos inventados.
 */

const SIZE = 280;
const CENTRO = SIZE / 2;
const RADIO_BASE = 58;
const LARGO_MAX = 56;
const RADIO_ETIQUETA = 128;
const HORAS_ETIQUETA = [0, 6, 12, 18];

/** Ventana circular de 6 horas con más reportes; null si no hay actividad. */
export function ventanaPico(horas: number[]): { inicio: number; fin: number } | null {
    const total = horas.reduce((suma, v) => suma + v, 0);
    if (total === 0) return null;
    let mejorInicio = 0;
    let mejorSuma = -1;
    for (let inicio = 0; inicio < 24; inicio += 1) {
        let suma = 0;
        for (let k = 0; k < 6; k += 1) suma += horas[(inicio + k) % 24] ?? 0;
        if (suma > mejorSuma) {
            mejorSuma = suma;
            mejorInicio = inicio;
        }
    }
    return { inicio: mejorInicio, fin: (mejorInicio + 5) % 24 };
}

function punto(hora: number, radio: number): { x: number; y: number } {
    // 0 h arriba, sentido horario (15° por hora).
    const angulo = ((hora * 15 - 90) * Math.PI) / 180;
    return { x: CENTRO + radio * Math.cos(angulo), y: CENTRO + radio * Math.sin(angulo) };
}

interface RelojActividadProps {
    /** Reportes distintos por hora (0-23), hora de Colombia. */
    horas: number[];
    className?: string;
}

export function RelojActividad({ horas, className = "" }: RelojActividadProps) {
    const total = horas.reduce((suma, v) => suma + v, 0);
    const maximo = Math.max(0, ...horas);
    const ventana = ventanaPico(horas);

    const resumen =
        ventana === null
            ? "Reloj de actividad de 24 horas: aún no hay actividad registrada."
            : `Reloj de actividad de 24 horas: ${total} ${total === 1 ? "reporte" : "reportes"} en total. ` +
              `La mayoría llega entre las ${ventana.inicio} h y las ${ventana.fin} h (hora de Colombia).`;

    return (
        <section aria-label="Reloj de actividad de 24 horas" className={`glass flex h-full flex-col rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}>
            <h2 className="titular-seccion text-body">¿A qué horas llegan los reportes?</h2>
            <p className="mt-1 text-sm text-muted">Reloj de 24 horas · hora de Colombia</p>

            <figure className="mt-4 flex flex-1 flex-col items-center justify-center gap-3" style={{ margin: 0 }}>
                <svg
                    width={SIZE}
                    height={SIZE}
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    role="img"
                    aria-label={resumen}
                    className="max-w-full"
                >
                    {/* Marco de las 24 h (referencia de escala, como el arco base del anillo). */}
                    <circle cx={CENTRO} cy={CENTRO} r={RADIO_BASE - 8} fill="none" strokeWidth={1} className="stroke-tinta opacity-10" />
                    {horas.map((valor, hora) => {
                        // Marca corta de cada hora; la barra de datos crece desde ella.
                        const largo = maximo > 0 ? (valor / maximo) * LARGO_MAX : 0;
                        const base = punto(hora, RADIO_BASE);
                        const puntaMarca = punto(hora, RADIO_BASE + 5);
                        const esPico = valor > 0 && valor === maximo;
                        return (
                            <g key={hora}>
                                <line
                                    x1={base.x}
                                    y1={base.y}
                                    x2={puntaMarca.x}
                                    y2={puntaMarca.y}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    className="stroke-tinta opacity-25"
                                />
                                {valor > 0 && (
                                    <line
                                        data-hora={hora}
                                        data-reportes={valor}
                                        x1={base.x}
                                        y1={base.y}
                                        x2={punto(hora, RADIO_BASE + 5 + largo).x}
                                        y2={punto(hora, RADIO_BASE + 5 + largo).y}
                                        strokeWidth={6}
                                        strokeLinecap="round"
                                        strokeDasharray={largo + 5}
                                        strokeDashoffset={0}
                                        className={`anim-dibujo ${esPico ? "stroke-cielo" : "stroke-tinta opacity-50"}`}
                                        style={{ "--dash-inicial": largo + 5, "--anim-retardo": `${hora * 25}ms` } as CSSProperties}
                                    />
                                )}
                            </g>
                        );
                    })}
                    {HORAS_ETIQUETA.map((hora) => {
                        const pos = punto(hora, RADIO_ETIQUETA);
                        return (
                            <text
                                key={hora}
                                x={pos.x}
                                y={pos.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={11}
                                className="cifra fill-tinta opacity-60"
                            >
                                {hora} h
                            </text>
                        );
                    })}
                </svg>
                {ventana === null ? (
                    <figcaption className="cuerpo max-w-sm text-center text-muted">
                        Aún no hay actividad suficiente para leer el reloj — cuando lleguen reportes, aquí verás a qué horas ocurren.
                    </figcaption>
                ) : (
                    <figcaption className="text-sm text-muted">
                        La mayoría llega entre las{" "}
                        <span className="cifra font-semibold text-body">
                            {ventana.inicio} h y las {ventana.fin} h
                        </span>
                        .
                    </figcaption>
                )}
            </figure>
        </section>
    );
}
