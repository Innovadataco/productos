"use client";

/**
 * SPEC-350 (A-69 · C3 · T033/T034) — el caso vivo del colegio, estilo
 * expediente del padre (orden expresa de Jelkin · D6): mapa con la historia,
 * capa 1 de cifras EN VIVO y análisis IA (capa 2) con la economía completa
 * de SPEC-341/347/348. Voz USTED formal — el colegio no tutea.
 *
 * Consumidor único de GET/POST /api/colegio/casos/[id]/analisis. La ruta
 * devuelve TODO (hechos + caso + análisis) en una llamada; el polling de
 * 15 s corre solo mientras el estado sea GENERANDO.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { ExpedienteGenerando } from "@/components/modules/padre/ExpedienteGenerando";

const MapaUbicaciones = dynamic(
    () => import("@/components/modules/MapaUbicaciones").then((m) => m.MapaUbicaciones),
    { ssr: false }
);

interface HechoCasoDto {
    fecha: string;
    ciudad: string | null;
    pais: string | null;
    plataforma: string | null;
    categoria: string | null;
    lat: number | null;
    lng: number | null;
}

interface GuiaResumen {
    id: string;
    tituloEmocional: string;
    pasos: unknown;
}

interface VigenteDto {
    versionSecuencial: number;
    texto: string;
    corteN: number;
    categoriaDominante: string | null;
    generadoEn: string;
    guiaAccion: GuiaResumen | null;
}

interface EvaluacionCasoDto {
    vigente: VigenteDto | null;
    hashActual: string;
    coincide: boolean;
    hechosNuevosDesde: number;
    estado: "PUBLICADO" | "GENERANDO" | "FALLIDO" | "SIN_ANALISIS";
    cola: { posicion: number; estimadoSeg: number } | null;
    colaLlena: boolean;
    cooldown: { puedeActualizar: boolean; faltanSeg: number };
    agotadoPorFallos: boolean;
    ultimoMotivoFallo: string | null;
    caso: { id: string; colegioId: string; estado: string; tipoSujeto: string; curso: string | null };
    hechos: HechoCasoDto[];
}

const POLL_INTERVAL_MS = 15_000;

const fmtFecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

const FRANJA_LABEL: Record<string, string> = {
    "0-6": "madrugada (12 a.m.–6 a.m.)",
    "6-12": "mañana (6 a.m.–12 p.m.)",
    "12-18": "tarde (12 p.m.–6 p.m.)",
    "18-24": "noche (6 p.m.–12 a.m.)",
};

function horaBogota(iso: string): number {
    return Number.parseInt(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso)),
        10
    ) % 24;
}

function franjaDe(iso: string): string {
    const h = horaBogota(iso);
    if (h < 6) return "0-6";
    if (h < 12) return "6-12";
    if (h < 18) return "12-18";
    return "18-24";
}

function dominante(pares: Map<string, number>): string | null {
    let mejor: string | null = null;
    let max = 0;
    for (const [k, v] of pares) {
        if (v > max) { mejor = k; max = v; }
    }
    return mejor;
}

function pasosDeGuia(pasos: unknown): Array<{ orden: number; titulo: string; descripcion: string }> {
    if (!Array.isArray(pasos)) return [];
    return pasos.filter((p): p is { orden: number; titulo: string; descripcion: string } =>
        typeof p === "object" && p !== null && "titulo" in p && "descripcion" in p
    );
}

export function CasoVivoColegio({ casoId }: { casoId: string }) {
    const [data, setData] = useState<EvaluacionCasoDto | null>(null);
    const [error, setError] = useState("");
    const [actualizando, setActualizando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/colegio/casos/${casoId}/analisis`, { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar el análisis del caso.");
            setData((await res.json()) as EvaluacionCasoDto);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos cargar el análisis del caso.");
        }
    }, [casoId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    useEffect(() => {
        if (data?.estado === "GENERANDO") {
            timerRef.current = setInterval(() => void cargar(), POLL_INTERVAL_MS);
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            };
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return undefined;
    }, [data?.estado, cargar]);

    const actualizar = useCallback(async () => {
        setActualizando(true);
        setMensaje("");
        try {
            const res = await fetch(`/api/colegio/casos/${casoId}/analisis`, { method: "POST", credentials: "include" });
            if (!res.ok) throw new Error("No pudimos actualizar el análisis.");
            const body = await res.json();
            if (body.encolado) {
                setMensaje("Estamos generando un análisis nuevo.");
            } else if (body.motivo === "cooldown") {
                const min = Math.ceil((body.faltanSeg ?? 0) / 60);
                setMensaje(`Podrá actualizar en ${min} ${min === 1 ? "minuto" : "minutos"}.`);
            } else if (body.motivo === "ya_al_dia") {
                setMensaje("El análisis ya está al día — nada nuevo que interpretar.");
            } else if (body.motivo === "cola_llena") {
                setMensaje("La cola está llena — vuelva a intentar en unos minutos.");
            } else if (body.motivo === "sin_hechos") {
                setMensaje("Este caso aún no tiene eventos analizables.");
            }
            await cargar();
        } catch (err) {
            setMensaje(err instanceof Error ? err.message : "No pudimos actualizar.");
        } finally {
            setActualizando(false);
        }
    }, [casoId, cargar]);

    if (error) {
        return (
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">{error}</p>
            </section>
        );
    }
    if (!data) {
        return (
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">Cargando el caso…</p>
            </section>
        );
    }

    const { hechos, vigente, estado, cola, hechosNuevosDesde, coincide, cooldown, colaLlena, agotadoPorFallos } = data;
    const generando = estado === "GENERANDO";
    const casoCerrado = data.caso.estado === "cerrado";
    const puedeActualizar = cooldown.puedeActualizar && !generando && !actualizando && !casoCerrado;
    const guiaPasos = vigente?.guiaAccion ? pasosDeGuia(vigente.guiaAccion.pasos) : [];

    // ── Capa 1 · cifras EN VIVO (cálculo puro sobre los hechos) ─────────────
    const porCiudad = new Map<string, number>();
    const porFranja = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    for (const h of hechos) {
        if (h.ciudad) porCiudad.set(h.ciudad, (porCiudad.get(h.ciudad) ?? 0) + 1);
        porFranja.set(franjaDe(h.fecha), (porFranja.get(franjaDe(h.fecha)) ?? 0) + 1);
        if (h.categoria) porCategoria.set(h.categoria, (porCategoria.get(h.categoria) ?? 0) + 1);
    }
    const franjaDominante = dominante(porFranja);
    const masReciente = hechos.length > 0 ? hechos[hechos.length - 1] : null;

    // ── Puntos del mapa ─────────────────────────────────────────────────────
    const puntosAgg = new Map<string, { lat: number; lng: number; label: string; total: number }>();
    for (const h of hechos) {
        if (h.lat === null || h.lng === null) continue;
        const clave = `${h.lat},${h.lng}`;
        const previo = puntosAgg.get(clave);
        if (previo) previo.total += 1;
        else puntosAgg.set(clave, { lat: h.lat, lng: h.lng, label: h.ciudad ?? "Sin ciudad", total: 1 });
    }
    const puntos = [...puntosAgg.values()];
    const sinUbicacion = hechos.filter((h) => h.lat === null).length;

    return (
        <div className="space-y-4">
            {/* ── El mapa con la historia (D6: mismo componente del padre) ── */}
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <h2 className="font-medium text-body">Dónde está ocurriendo</h2>
                <div className="mt-3 h-64 overflow-hidden rounded-xl">
                    <MapaUbicaciones puntos={puntos} sinUbicacion={sinUbicacion} />
                </div>
            </section>

            {/* ── Capa 1 · cifras en vivo ── */}
            {hechos.length > 0 ? (
                <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                    <div className="flex items-baseline justify-between">
                        <h2 className="font-medium text-body">Lo que muestra este caso</h2>
                        <span className="text-xs uppercase tracking-wide text-pino">En vivo</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                        <li>
                            {hechos.length} {hechos.length === 1 ? "reporte" : "reportes"} sobre esta cuenta
                            {masReciente ? ` — el más reciente: ${fmtFecha.format(new Date(masReciente.fecha))}` : ""}
                        </li>
                        {porCiudad.size > 0 && (
                            <li>
                                Ciudades: {[...porCiudad.entries()].map(([c, n]) => `${c} ${n}`).join(" · ")}
                            </li>
                        )}
                        {franjaDominante && (
                            <li>Los hechos se concentran en la {FRANJA_LABEL[franjaDominante] ?? franjaDominante}</li>
                        )}
                        {porCategoria.size > 0 && (
                            <li>
                                Clasificaciones: {[...porCategoria.entries()].map(([c, n]) => `${c} (${n})`).join(" · ")}
                            </li>
                        )}
                    </ul>
                </section>
            ) : (
                <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                    <p className="text-sm text-muted">Este caso aún no tiene eventos analizables.</p>
                </section>
            )}

            {/* ── Capa 2 · Análisis detallado (IA) ── */}
            <section
                className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40"
                aria-label="Análisis detallado del caso"
            >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-medium text-body">Análisis detallado</h2>
                    <span className="text-xs uppercase tracking-wide text-muted" title="Análisis generado con asistencia de IA">
                        análisis asistido
                    </span>
                </div>

                {colaLlena && (
                    <p className="mt-2 text-xs text-madera">La cola está llena — vuelva a intentar en unos minutos.</p>
                )}

                {agotadoPorFallos && !generando && (
                    <div className="mt-3 rounded-2xl border border-madera/30 bg-madera/10 p-4 text-sm text-body">
                        <p className="font-medium">No pudimos generar el análisis todavía.</p>
                        <p className="mt-1 text-muted">
                            Estamos revisándolo por dentro. Puede volver en un rato y pedirlo con &ldquo;Actualizar análisis&rdquo;.
                        </p>
                    </div>
                )}

                {generando && cola && (
                    <div className="mt-3">
                        <ExpedienteGenerando
                            trabajosEnFila={cola.posicion}
                            estimadoSeg={cola.estimadoSeg}
                            hechosNuevosDesde={hechosNuevosDesde}
                        />
                    </div>
                )}

                {vigente ? (
                    <div className="mt-3">
                        <p className="text-xs text-muted">
                            Análisis al corte del {fmtFecha.format(new Date(vigente.generadoEn))} · incluye {vigente.corteN}{" "}
                            {vigente.corteN === 1 ? "hecho" : "hechos"}
                            {!coincide && hechosNuevosDesde > 0 && (
                                <>
                                    {" · "}
                                    <strong>
                                        Hay {hechosNuevosDesde} {hechosNuevosDesde === 1 ? "hecho nuevo" : "hechos nuevos"} desde este análisis
                                    </strong>
                                </>
                            )}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-body">{vigente.texto}</p>

                        {vigente.guiaAccion && guiaPasos.length > 0 && (
                            <div className="mt-4 rounded-xl bg-papel/80 p-3 dark:bg-tinta/60">
                                <p className="font-medium text-body">{vigente.guiaAccion.tituloEmocional}</p>
                                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-body">
                                    {guiaPasos.map((p) => (
                                        <li key={p.orden}>
                                            <strong>{p.titulo}.</strong> <span className="text-muted">{p.descripcion}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                ) : (
                    !generando && !agotadoPorFallos && (
                        <p className="mt-3 text-sm text-muted">
                            Pida el análisis detallado para la lectura completa de este patrón.
                        </p>
                    )
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={actualizar} disabled={!puedeActualizar}>
                        {actualizando ? "Actualizando…" : "Actualizar análisis"}
                    </Button>
                    {casoCerrado && (
                        <span className="text-xs text-muted">El caso está cerrado — el análisis queda para consulta.</span>
                    )}
                    {!cooldown.puedeActualizar && !generando && cooldown.faltanSeg > 0 && (
                        <span className="text-xs text-muted">
                            Podrá actualizar en {Math.max(1, Math.ceil(cooldown.faltanSeg / 60))}{" "}
                            {Math.ceil(cooldown.faltanSeg / 60) === 1 ? "minuto" : "minutos"}.
                        </span>
                    )}
                    {mensaje && <span className="text-xs text-muted">{mensaje}</span>}
                </div>
            </section>
        </div>
    );
}
