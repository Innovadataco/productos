"use client";

/**
 * SPEC-965 (FORMA Órbita) — overview radial del colegio POR CAPAS.
 *
 * Capa 1: el colegio al centro, una órbita de cursos + el nodo comité. Color por estado (pino/ámbar,
 *   NUNCA rubí — PARÁ 1). Tamaño del nodo ∝ nº de estudiantes.
 * Capa 2 (al abrir un curso): el curso al centro y su órbita de ESTUDIANTES QUE MERECEN MIRADA + el
 *   profesor titular + un nodo «resto: N en calma». NUNCA dibuja todos los estudiantes. El rubí aparece
 *   SOLO en el nodo de un estudiante con alerta alta viva.
 *
 * Accesibilidad: la órbita (SVG) es decorativa (`aria-hidden`); el camino de teclado y lector de
 * pantalla es la LISTA equivalente, siempre visible, con el mismo contenido e interacción.
 * Voz: usted / impersonal (panel del colegio).
 */
import { useCallback, useState } from "react";
import type { OrbitaColegio, CursoOrbita, CursoOrbitaDetalle } from "@/lib/dal/repositories/colegio-resumen";

type ColorResumen = "pino" | "ambar";
type ColorNodo = ColorResumen | "rubi";

const FILL: Record<ColorNodo, string> = { pino: "fill-pino", ambar: "fill-ambar", rubi: "fill-rubi" };
const PUNTO: Record<ColorNodo, string> = { pino: "bg-pino", ambar: "bg-ambar", rubi: "bg-rubi" };

function palabraCurso(color: ColorResumen): string {
    return color === "ambar" ? "requiere mirada" : "en calma";
}
function palabraRiesgo(riesgo: "alta" | "sin_contacto"): string {
    return riesgo === "alta" ? "alerta alta" : "sin contacto";
}
function colorRiesgo(riesgo: "alta" | "sin_contacto"): ColorNodo {
    return riesgo === "alta" ? "rubi" : "ambar";
}
/** SPEC-968: «{N} reporte(s)» con el sustantivo y el singular/plural correctos (también en el aria-label). */
function reportesTexto(n: number): string {
    return `${n} ${n === 1 ? "reporte" : "reportes"}`;
}

const LIENZO = 360;
const CENTRO = LIENZO / 2;
const RADIO_ORBITA = 128;

/**
 * SPEC-971 · redondea una coordenada/medida CALCULADA a una resolución fija.
 *
 * El defecto (hallazgo de Calidad sobre d30b9735): Math.cos/sin/sqrt dan resultados que
 * difieren en el ÚLTIMO decimal entre el libm del servidor (Node) y el del navegador, así
 * que un mismo atributo del SVG se renderiza con dígitos distintos en SSR y en cliente →
 * warning de hidratación de React. Redondeando TODA coordenada calculada a 2 decimales,
 * servidor y cliente coinciden. Se aplica en el ÚNICO lugar donde nace cada número
 * (posicionEnOrbita y radioNodo); el resto de atributos del SVG son enteros constantes.
 */
const DECIMALES_SVG = 2;
function redondear(n: number): number {
    const factor = 10 ** DECIMALES_SVG;
    return Math.round(n * factor) / factor;
}

function posicionEnOrbita(indice: number, total: number): { x: number; y: number } {
    const angulo = -Math.PI / 2 + (2 * Math.PI * indice) / Math.max(1, total);
    return {
        x: redondear(CENTRO + RADIO_ORBITA * Math.cos(angulo)),
        y: redondear(CENTRO + RADIO_ORBITA * Math.sin(angulo)),
    };
}
/** Radio del nodo ∝ nº de estudiantes (acotado para que el overview no se sature). */
function radioNodo(estudiantes: number): number {
    return redondear(Math.max(12, Math.min(26, 12 + Math.sqrt(Math.max(0, estudiantes)) * 2.6)));
}

interface Props {
    colegioNombre: string;
    /** Estado del colegio ya resuelto en el servidor (ley del inicio): pino/ámbar, nunca rubí. */
    colorColegio: ColorResumen;
    orbita: OrbitaColegio;
}

export function OrbitaColegioMapa({ colegioNombre, colorColegio, orbita }: Props) {
    const [abierto, setAbierto] = useState<CursoOrbita | null>(null);
    const [detalle, setDetalle] = useState<CursoOrbitaDetalle | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abrirCurso = useCallback(async (curso: CursoOrbita) => {
        setAbierto(curso);
        setDetalle(null);
        setError(null);
        setCargando(true);
        try {
            const res = await fetch(`/api/colegio/orbita/${encodeURIComponent(curso.cursoId)}`, {
                headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error("No se pudo cargar el curso.");
            const json: { curso: CursoOrbitaDetalle } = await res.json();
            setDetalle(json.curso);
        } catch {
            setError("No se pudo cargar el curso. Intente de nuevo.");
        } finally {
            setCargando(false);
        }
    }, []);

    const volver = useCallback(() => {
        setAbierto(null);
        setDetalle(null);
        setError(null);
    }, []);

    return (
        <section className="mx-auto max-w-3xl px-4 py-6" aria-labelledby="orbita-titulo">
            <header className="mb-4">
                <h1 id="orbita-titulo" className="text-xl font-semibold text-pino-700">
                    Mapa de protección del colegio
                </h1>
                <p className="text-sm text-muted">
                    Una vista de conjunto por capas: los cursos primero; al abrir un curso, los estudiantes que
                    merecen mirada. No reemplaza las listas del panel.
                </p>
            </header>

            {abierto ? (
                <CapaCurso
                    cursoNombre={abierto.nombre}
                    detalle={detalle}
                    cargando={cargando}
                    error={error}
                    onVolver={volver}
                />
            ) : (
                <CapaColegio
                    colegioNombre={colegioNombre}
                    colorColegio={colorColegio}
                    orbita={orbita}
                    onAbrirCurso={abrirCurso}
                />
            )}
        </section>
    );
}

// ── Capa 1 ───────────────────────────────────────────────────────────────────
function CapaColegio({
    colegioNombre,
    colorColegio,
    orbita,
    onAbrirCurso,
}: {
    colegioNombre: string;
    colorColegio: ColorResumen;
    orbita: OrbitaColegio;
    onAbrirCurso: (c: CursoOrbita) => void;
}) {
    const { cursos, casosComite } = orbita;
    const colorComite: ColorResumen = casosComite.abiertos > 0 ? "ambar" : "pino";
    const totalNodos = cursos.length + 1; // cursos + comité

    return (
        <div>
            <svg viewBox={`0 0 ${LIENZO} ${LIENZO}`} className="mx-auto block w-full max-w-md" aria-hidden="true">
                {cursos.map((c, i) => {
                    const p = posicionEnOrbita(i, totalNodos);
                    return (
                        <g key={c.cursoId} className="cursor-pointer" onClick={() => onAbrirCurso(c)}>
                            <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} className="stroke-tinta/20" strokeWidth={1} />
                            <circle cx={p.x} cy={p.y} r={radioNodo(c.estudiantes)} className={FILL[c.color]} />
                        </g>
                    );
                })}
                {(() => {
                    const p = posicionEnOrbita(cursos.length, totalNodos);
                    return (
                        <g>
                            <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} className="stroke-tinta/20" strokeWidth={1} />
                            <circle cx={p.x} cy={p.y} r={14} className={FILL[colorComite]} />
                        </g>
                    );
                })()}
                <circle cx={CENTRO} cy={CENTRO} r={38} className={FILL[colorColegio]} />
            </svg>

            {/* Equivalente en lista (teclado / lector de pantalla) */}
            <h2 className="mt-4 mb-2 text-sm font-medium text-muted">
                {colegioNombre} — cursos ({cursos.length})
            </h2>
            <ul className="divide-y divide-tinta/10 rounded-lg border border-tinta/12">
                {cursos.map((c) => (
                    <li key={c.cursoId}>
                        <button
                            type="button"
                            onClick={() => onAbrirCurso(c)}
                            className="ring-accent flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-tinta/5"
                            aria-label={`Curso ${c.nombre}. ${reportesTexto(c.alertas30d)} en 30 días. ${palabraCurso(c.color)}. Abrir el curso.`}
                        >
                            <span className={`h-3 w-3 shrink-0 rounded-full ${PUNTO[c.color]}`} aria-hidden="true" />
                            <span className="flex-1 text-sm text-tinta">{c.nombre}</span>
                            <span className="text-xs text-subtle">
                                {reportesTexto(c.alertas30d)} · 30 días · {palabraCurso(c.color)}
                            </span>
                        </button>
                    </li>
                ))}
                <li className="flex items-center gap-3 px-3 py-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${PUNTO[colorComite]}`} aria-hidden="true" />
                    <span className="flex-1 text-sm text-tinta">Comité de convivencia</span>
                    <span className="text-xs text-subtle">
                        {casosComite.abiertos} {casosComite.abiertos === 1 ? "caso" : "casos"}
                    </span>
                </li>
            </ul>
        </div>
    );
}

// ── Capa 2 ───────────────────────────────────────────────────────────────────
function CapaCurso({
    cursoNombre,
    detalle,
    cargando,
    error,
    onVolver,
}: {
    cursoNombre: string;
    detalle: CursoOrbitaDetalle | null;
    cargando: boolean;
    error: string | null;
    onVolver: () => void;
}) {
    return (
        <div>
            <button
                type="button"
                onClick={onVolver}
                className="ring-accent mb-3 inline-flex items-center gap-1 text-sm text-pino-700 hover:underline"
            >
                ← Volver al colegio
            </button>

            {cargando && <p className="text-sm text-muted">Cargando el curso…</p>}
            {error && <p className="text-sm text-rubi">{error}</p>}

            {detalle && (
                <div>
                    <svg viewBox={`0 0 ${LIENZO} ${LIENZO}`} className="mx-auto block w-full max-w-md" aria-hidden="true">
                        {(() => {
                            const nodos = detalle.alumnosMirada.length + (detalle.titular ? 1 : 0) + 1; // + resto
                            let i = 0;
                            const piezas = [];
                            for (const a of detalle.alumnosMirada) {
                                const p = posicionEnOrbita(i, nodos);
                                piezas.push(
                                    <g key={a.estudianteId}>
                                        <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} className="stroke-tinta/20" strokeWidth={1} />
                                        <circle cx={p.x} cy={p.y} r={16} className={FILL[colorRiesgo(a.riesgo)]} />
                                    </g>
                                );
                                i += 1;
                            }
                            if (detalle.titular) {
                                const p = posicionEnOrbita(i, nodos);
                                piezas.push(
                                    <g key="titular">
                                        <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} className="stroke-tinta/20" strokeWidth={1} />
                                        {/* SPEC-968: titular = contorno neutro de CONTEXTO, no el pino-estado (no «sin novedad»). */}
                                        <circle cx={p.x} cy={p.y} r={14} className="fill-none stroke-tinta/50" strokeWidth={2} />
                                    </g>
                                );
                                i += 1;
                            }
                            const pr = posicionEnOrbita(i, nodos);
                            piezas.push(
                                <g key="resto">
                                    <line x1={CENTRO} y1={CENTRO} x2={pr.x} y2={pr.y} className="stroke-tinta/20" strokeWidth={1} />
                                    <circle cx={pr.x} cy={pr.y} r={12} className="fill-tinta/20" />
                                </g>
                            );
                            return piezas;
                        })()}
                        <circle cx={CENTRO} cy={CENTRO} r={36} className={FILL[detalle.curso.color]} />
                    </svg>

                    {/* Equivalente en lista (teclado / lector de pantalla) */}
                    <h2 className="mt-4 mb-2 text-sm font-medium text-muted">
                        {detalle.curso.nombre} — {reportesTexto(detalle.curso.alertas30d)} · 30 días
                    </h2>
                    <ul className="divide-y divide-tinta/10 rounded-lg border border-tinta/12">
                        {detalle.alumnosMirada.length === 0 && (
                            <li className="px-3 py-2 text-sm text-muted">Ningún estudiante requiere mirada en este curso.</li>
                        )}
                        {detalle.alumnosMirada.map((a) => (
                            <li key={a.estudianteId} className="flex items-center gap-3 px-3 py-2">
                                <span className={`h-3 w-3 shrink-0 rounded-full ${PUNTO[colorRiesgo(a.riesgo)]}`} aria-hidden="true" />
                                <span className="flex-1 text-sm text-tinta">{a.nombre}</span>
                                <span className="text-xs text-subtle">{palabraRiesgo(a.riesgo)}</span>
                            </li>
                        ))}
                        {detalle.titular && (
                            <li className="flex items-center gap-3 px-3 py-2">
                                {/* SPEC-968: contorno neutro de contexto (no bg-pino de estado). */}
                                <span className="h-3 w-3 shrink-0 rounded-full border border-tinta/50" aria-hidden="true" />
                                <span className="flex-1 text-sm text-tinta">Profesor titular: {detalle.titular.nombre}</span>
                            </li>
                        )}
                        <li className="flex items-center gap-3 px-3 py-2">
                            <span className="h-3 w-3 shrink-0 rounded-full bg-tinta/20" aria-hidden="true" />
                            <span className="flex-1 text-sm text-muted">
                                Resto: {detalle.restoEnCalma} {detalle.restoEnCalma === 1 ? "estudiante" : "estudiantes"} en calma
                            </span>
                        </li>
                    </ul>
                </div>
            )}
            {!cargando && !error && !detalle && <p className="sr-only">Curso {cursoNombre}</p>}
        </div>
    );
}
