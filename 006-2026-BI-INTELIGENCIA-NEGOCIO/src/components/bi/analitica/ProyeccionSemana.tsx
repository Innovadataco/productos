"use client";

import { useRef, useState } from "react";
import type { AnaliticaData } from "@/lib/bi/analitica";
import { fmtMiles } from "@/components/bi/pulso/formatos";

/* Geometría fija del SVG (viewBox 560×220, como el mockup v4): el histórico
   ocupa x 48→392 y el futuro 448→504; la banda de rango se abre desde el
   último punto real hasta el min/max proyectado de la próxima semana. */
const X0 = 48;
const X1 = 392;
const X_FIN = 504;
const Y_BASE = 190;
const Y_TOPE = 30;

/** Ventanas de tendencia que ofrece el filtro (chips). Default: 8. */
const OPCIONES_SEMANAS = [4, 8, 12] as const;
type SemanasFiltro = (typeof OPCIONES_SEMANAS)[number];

/**
 * Payload REAL de GET /api/bi/analitica/proyeccion?semanas=4|8|12 (T1).
 * La UI mapea 1:1, sin inventar campos: si la API no expone algo, aquí
 * tampoco existe.
 */
interface ProyeccionApi {
    min: number | null;
    max: number | null;
    tendenciaSemanas: { semana: string; total: number }[];
    hayBase: boolean;
}

type Fase = "listo" | "cargando" | "error";

/** Tres puntos latiendo: "consultando" sin spinner (reduced-motion los deja quietos). */
export function PuntosCarga({ texto }: { texto: string }) {
    return (
        <span className="inline-flex items-center gap-2 text-[12px] text-muted" role="status">
            {texto}
            <span className="carga-puntos" aria-hidden="true">
                <span />
                <span />
                <span />
            </span>
        </span>
    );
}

/**
 * Proyección de la próxima semana (mockup v4, sección 2) con FILTRO DE
 * TIEMPO (mejora aprobada por el dueño): chips 4/8/12 semanas; al cambiar se
 * pide /api/bi/analitica/proyeccion y la línea+banda+punteado se redibujan
 * (el key por ventana remonta el SVG y `trazo-animado` se re-dispara; la
 * regla global de prefers-reduced-motion lo muestra ya final).
 *
 * El primer render usa la proyección del SSR (8 semanas, la del contrato
 * AnaliticaData) — sin fetch inicial. Predictiva honesta: se comunica un
 * RANGO ("min–max reportes · rango, no promesa"), jamás una cifra puntual.
 * Candado 9: sin base se anuncia "sin proyección aún"; si la API falla se
 * dice y se conserva la última lectura (jamás un gráfico mudo). Candado 10:
 * los totales y el rango son los del contrato; aquí solo se posicionan.
 */
export default function ProyeccionSemana({
    proyeccion,
}: {
    proyeccion: AnaliticaData["proyeccion"];
}) {
    const [semanas, setSemanas] = useState<SemanasFiltro>(8);
    const [datos, setDatos] = useState<ProyeccionApi>(() => ({
        min: proyeccion.semanaProximaMin,
        max: proyeccion.semanaProximaMax,
        tendenciaSemanas: proyeccion.tendenciaSemanas,
        hayBase: proyeccion.hayBase,
    }));
    const [fase, setFase] = useState<Fase>("listo");
    // Guarda de carrera: solo el último pedido puede escribir el estado.
    const pedidoRef = useRef(0);

    async function elegir(n: SemanasFiltro) {
        if (n === semanas) return;
        setSemanas(n);
        setFase("cargando");
        const pedido = ++pedidoRef.current;
        try {
            const res = await fetch(`/api/bi/analitica/proyeccion?semanas=${n}`, {
                cache: "no-store",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as ProyeccionApi;
            if (pedido !== pedidoRef.current) return;
            setDatos({
                min: json.min ?? null,
                max: json.max ?? null,
                tendenciaSemanas: Array.isArray(json.tendenciaSemanas)
                    ? json.tendenciaSemanas
                    : [],
                hayBase: json.hayBase === true,
            });
            setFase("listo");
        } catch {
            if (pedido !== pedidoRef.current) return;
            setFase("error");
        }
    }

    const { min, max, tendenciaSemanas, hayBase } = datos;
    const hayGrafico =
        hayBase && tendenciaSemanas.length >= 2 && min !== null && max !== null;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "120ms" } as React.CSSProperties}
        >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[17px] font-semibold">Proyección de la próxima semana</h3>
                <div
                    className="flex gap-1.5"
                    role="group"
                    aria-label="Ventana de semanas de la tendencia"
                >
                    {OPCIONES_SEMANAS.map((op) => (
                        <button
                            key={op}
                            type="button"
                            aria-pressed={semanas === op}
                            onClick={() => elegir(op)}
                            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                                semanas === op
                                    ? "border-[rgb(var(--pino-rgb)/0.6)] bg-[rgb(var(--pino-rgb)/0.12)] font-semibold text-body"
                                    : "border-[rgb(var(--tinta-rgb)/0.14)] text-muted hover:border-[rgb(var(--tinta-rgb)/0.3)]"
                            }`}
                        >
                            {op} semanas
                        </button>
                    ))}
                </div>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Tendencia de las últimas {tendenciaSemanas.length} semanas + rango de confianza
                — la línea punteada es futuro
            </div>
            {fase === "cargando" && <PuntosCarga texto="Actualizando proyección" />}
            {fase === "error" && (
                <p className="aviso-honesto mb-3">
                    No se pudo actualizar la proyección — se conserva la última lectura
                    disponible.
                </p>
            )}
            {!hayGrafico ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Sin proyección aún: la réplica todavía no tiene suficientes semanas para
                    proyectar con honestidad.
                </p>
            ) : (
                <div
                    aria-busy={fase === "cargando"}
                    className={fase === "cargando" ? "opacity-50" : undefined}
                >
                    {/* key por ventana: remonta el SVG y re-dispara el trazo */}
                    <ProyeccionSvg
                        key={semanas}
                        tendencia={tendenciaSemanas}
                        min={min}
                        max={max}
                    />
                </div>
            )}
            {hayGrafico && (
                <div className="mt-3 text-[12px] text-muted">
                    Si sigue el ritmo:{" "}
                    <b className="cifra text-body">
                        {fmtMiles(min)}–{fmtMiles(max)} reportes
                    </b>{" "}
                    la próxima semana (rango, no promesa).
                </div>
            )}
        </div>
    );
}

function ProyeccionSvg({
    tendencia,
    min,
    max,
}: {
    tendencia: ProyeccionApi["tendenciaSemanas"];
    min: number;
    max: number;
}) {
    const maxV = Math.max(...tendencia.map((s) => s.total), max, 1);
    const y = (v: number) => Y_BASE - (v / maxV) * (Y_BASE - Y_TOPE);
    const n = tendencia.length;
    const x = (i: number) => X0 + ((X1 - X0) * i) / (n - 1);

    const puntos = tendencia.map((s, i) => `${x(i).toFixed(1)},${y(s.total).toFixed(1)}`).join(" ");
    const ultimo = { x: X1, y: y(tendencia[n - 1].total) };
    // La línea punteada cae en el centro visual de la banda (solo posición; no es una cifra impresa).
    const yFuturo = y((min + max) / 2);
    const banda = `M ${ultimo.x} ${ultimo.y.toFixed(1)} L ${X_FIN} ${y(max).toFixed(1)} L ${X_FIN} ${y(min).toFixed(1)} Z`;

    return (
        <svg width="100%" height="220" viewBox="0 0 560 220" preserveAspectRatio="none" role="img"
            aria-label={`Tendencia semanal de reportes y proyección de la próxima semana entre ${min} y ${max}`}>
            <defs>
                <linearGradient id="grad-linea-proy" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(var(--cielo-rgb))" />
                    <stop offset="100%" stopColor="rgb(var(--pino-rgb))" />
                </linearGradient>
            </defs>
            {/* banda de rango del futuro */}
            <path d={banda} fill="rgb(var(--cielo-rgb) / 0.15)" />
            {/* histórico: trazo que se dibuja (prefers-reduced-motion lo muestra ya final) */}
            <polyline
                points={puntos}
                fill="none"
                stroke="url(#grad-linea-proy)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="800"
                className="trazo-animado"
                style={{ "--dash-inicial": 800, "--dash-final": 0 } as React.CSSProperties}
            />
            {/* proyección punteada */}
            <polyline
                points={`${ultimo.x},${ultimo.y.toFixed(1)} ${X_FIN},${yFuturo.toFixed(1)}`}
                fill="none"
                stroke="rgb(var(--cielo-rgb))"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
            />
            <circle cx={X_FIN} cy={yFuturo} r="5" fill="rgb(var(--cielo-rgb))" className="anim-pulso" />
            <text x={X_FIN} y="210" textAnchor="middle" fontSize="10.5" fill="rgb(var(--tinta-subtle-rgb))">
                próxima semana
            </text>
        </svg>
    );
}
