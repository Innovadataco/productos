"use client";

/**
 * SPEC-340 (A-68 §4) — el expediente vivo: mapa con historia · línea de tiempo
 * · lectura · informes para siempre.
 *
 * «Que el padre VEA el modo de operar: de dónde le escriben al niño, si hay
 * coincidencia geográfica, cómo evolucionan las fechas.» Vivo e intuitivo —
 * ámbar único color de alerta, jamás rojo, y NADA se cierra nunca.
 *
 * La simulación (§4.1): los hechos aparecen ciudad por ciudad en orden
 * cronológico con la fecha visible, barra con pausa y arrastre; el mapa se
 * re-encuadra solo al entrar una ciudad fuera del encuadre (MapaUbicaciones
 * re-renderiza el encuadre con los puntos visibles). Con motion reducido, el
 * salto es directo, sin reloj.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { fechaHoraSinMinutos } from "@/lib/format/fecha";
import { TextoSensible } from "./TextoSensible";
import { AnalisisExpediente } from "./AnalisisExpediente";

const MapaUbicaciones = dynamic(
    () => import("@/components/modules/MapaUbicaciones").then((m) => m.MapaUbicaciones),
    { ssr: false }
);

export interface HechoVivoDto {
    reporteId: string | null;
    fecha: string;
    ciudad: string | null;
    pais: string | null;
    lat: number | null;
    lng: number | null;
    categoriaLabel: string | null;
    origen: "mio" | "otro_padre" | "anonimo";
}

export interface InformeDto {
    numeroSecuencial: number;
    generadoEn: string;
    codigoVerificacion: string;
}

interface Lectura {
    total: number;
    propios: number;
    ajenos: number;
    anonimos: number;
    franjas: { bloques: { inicio: string; fin: string; conteo: number }[]; dominante: { inicio: string; fin: string; conteo: number; total: number } | null };
    escalada: { primera: string; ultima: string } | null;
    aceleracion: { ultimos7: number; previos7: number } | null;
    alcance: { reporteros: number };
    perfil: { edadMin: number; edadMax: number } | null;
    ciudades: { lista: { ciudad: string; conteo: number }[]; masReciente: { ciudad: string | null; fecha: string } | null };
}

// I-261 · fecha del hecho SIN MINUTOS (regla dura de Jelkin: fingir el minuto
// exacto es peor que no darlo). Se centraliza en `fechaHoraSinMinutos` (SPEC-208 · A-70).
const fmtFecha = (iso: string) => fechaHoraSinMinutos(iso);

/** A-70 · G19: ritmo base de la reproducción; las velocidades lo dividen. */
const MS_POR_HECHO_BASE = 900;
const VELOCIDADES = [0.5, 1, 2, 4] as const;

const ORIGEN_LABEL: Record<HechoVivoDto["origen"], string> = {
    mio: "tuyo",
    otro_padre: "otro padre",
    anonimo: "anónimo",
};

export function ExpedienteVivo({
    expedienteId,
    identificador,
    hechos,
    informes,
}: {
    expedienteId: string;
    identificador: string;
    hechos: HechoVivoDto[];
    informes: InformeDto[];
}) {
    const [visibleHasta, setVisibleHasta] = useState(hechos.length); // todos al abrir
    const [reproduciendo, setReproduciendo] = useState(false);
    const [lectura, setLectura] = useState<Lectura | null>(null);
    // SPEC-340 §3.3-bis: minutos hasta re-tapar el texto revelado. Viene de la
    // ruta /lectura (parámetro `padre.texto.retapado_minutos`); 10 es el fallback.
    const [retapadoMinutos, setRetapadoMinutos] = useState(10);
    const relojRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // A-70 · G19: el padre elige qué tan rápido corre la historia. El valor es
    // el multiplicador; el intervalo real sale de dividir la base entre él.
    const [velocidad, setVelocidad] = useState(1);

    const propios = hechos.filter((h) => h.origen === "mio").length;
    const otros = hechos.filter((h) => h.origen === "otro_padre").length;
    const anonimos = hechos.filter((h) => h.origen === "anonimo").length;

    useEffect(() => {
        fetch(`/api/padre/expedientes/${expedienteId}/lectura`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!j) return;
                setLectura(j.lectura);
                if (typeof j.retapadoMinutos === "number") setRetapadoMinutos(j.retapadoMinutos);
            })
            .catch(() => null);
    }, [expedienteId]);

    useEffect(() => () => {
        if (relojRef.current) clearInterval(relojRef.current);
    }, []);

    const reproducir = () => {
        const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducido) {
            // Sin animación: salto directo al final (los hechos ya están).
            setVisibleHasta(hechos.length);
            return;
        }
        setVisibleHasta(0);
        setReproduciendo(true);
        relojRef.current = setInterval(() => {
            setVisibleHasta((v) => {
                if (v >= hechos.length) {
                    if (relojRef.current) clearInterval(relojRef.current);
                    setReproduciendo(false);
                    return v;
                }
                return v + 1;
            });
        }, MS_POR_HECHO_BASE / velocidad);
    };

    /**
     * A-70 · G19: cambiar la velocidad en marcha reinicia el intervalo — sin
     * esto el `setInterval` viejo sigue con el ritmo anterior hasta terminar.
     * No reinicia la historia: conserva el punto donde va.
     */
    const cambiarVelocidad = (nueva: number) => {
        setVelocidad(nueva);
        if (!reproduciendo) return;
        if (relojRef.current) clearInterval(relojRef.current);
        relojRef.current = setInterval(() => {
            setVisibleHasta((v) => {
                if (v >= hechos.length) {
                    if (relojRef.current) clearInterval(relojRef.current);
                    setReproduciendo(false);
                    return v;
                }
                return v + 1;
            });
        }, MS_POR_HECHO_BASE / nueva);
    };

    const pausar = () => {
        if (relojRef.current) clearInterval(relojRef.current);
        setReproduciendo(false);
    };

    const visibles = hechos.slice(0, visibleHasta);
    const puntos = useMemo(() => {
        const porCiudad = new Map<string, { lat: number; lng: number; total: number; ciudad: string }>();
        for (const h of visibles) {
            if (h.lat === null || h.lng === null || !h.ciudad) continue;
            const prev = porCiudad.get(h.ciudad);
            porCiudad.set(h.ciudad, { lat: h.lat, lng: h.lng, total: (prev?.total ?? 0) + 1, ciudad: h.ciudad });
        }
        return [...porCiudad.values()].map((p) => ({ label: p.ciudad, lat: p.lat, lng: p.lng, total: p.total }));
    }, [visibles]);

    const fechaActual = visibleHasta > 0 && visibleHasta <= hechos.length ? hechos[visibleHasta - 1].fecha : null;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="font-serif text-2xl text-body">Tu expediente · {identificador}</h1>
                <p className="mt-1 text-sm text-muted">
                    {hechos.length} {hechos.length === 1 ? "hecho documentado" : "hechos documentados"} · {propios}{" "}
                    {propios === 1 ? "tuyo" : "tuyos"}
                    {otros > 0 ? ` · ${otros} de otro padre` : ""}
                    {anonimos > 0 ? ` · ${anonimos} ${anonimos === 1 ? "anónimo" : "anónimos"}` : ""} ·{" "}
                    <strong>siempre abierto</strong>
                </p>
            </header>

            {/* ── El mapa con la historia ── */}
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium text-body">Dónde está pasando</h2>
                    <div className="flex items-center gap-2">
                        {fechaActual && reproduciendo && (
                            <span className="text-xs text-muted" aria-live="polite">
                                {fmtFecha(fechaActual)}
                            </span>
                        )}
                        {/* A-70 · G19: el padre elige el ritmo. Cambiar la velocidad
                            mientras corre reinicia el reloj con el nuevo intervalo. */}
                        <label className="flex items-center gap-1 text-xs text-muted">
                            <span className="sr-only">Velocidad de reproducción</span>
                            <select
                                className="rounded-lg border border-tinta/15 bg-papel/80 px-2 py-1 text-xs text-body dark:border-papel/15 dark:bg-tinta/60"
                                value={velocidad}
                                onChange={(e) => cambiarVelocidad(Number(e.target.value))}
                                aria-label="Velocidad de reproducción"
                            >
                                {VELOCIDADES.map((v) => (
                                    <option key={v} value={v}>{v}×</option>
                                ))}
                            </select>
                        </label>
                        {reproduciendo ? (
                            <Button variant="ghost" onClick={pausar}>
                                Pausar
                            </Button>
                        ) : (
                            <Button variant="secondary" onClick={reproducir}>
                                Reproducir la historia
                            </Button>
                        )}
                    </div>
                </div>
                <div className="mt-3 h-64 overflow-hidden rounded-xl">
                    <MapaUbicaciones puntos={puntos} sinUbicacion={visibles.filter((h) => h.lat === null).length} />
                </div>
                {/* La barra: arrastrar recorre la historia. */}
                <input
                    type="range"
                    min={0}
                    max={hechos.length}
                    value={visibleHasta}
                    onChange={(e) => {
                        pausar();
                        setVisibleHasta(Number(e.target.value));
                    }}
                    className="mt-3 w-full accent-pino"
                    aria-label="Recorrer la historia"
                />
            </section>

            {/* ── SPEC-341 · Análisis detallado (capa 2, IA en fila) ── */}
            <AnalisisExpediente expedienteId={expedienteId} />

            {/* ── La lectura (capa 1: solo cifras) ── */}
            {lectura && lectura.total > 0 && (
                <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                    <h2 className="font-medium text-body">Lo que muestra tu expediente</h2>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                        {lectura.ciudades.lista.length > 0 && (
                            <li>
                                {lectura.ciudades.lista.map((c) => `${c.ciudad} ${c.conteo}`).join(" · ")}
                                {lectura.ciudades.masReciente?.ciudad
                                    ? ` — el más reciente: ${lectura.ciudades.masReciente.ciudad}, ${fmtFecha(lectura.ciudades.masReciente.fecha)}`
                                    : ""}
                            </li>
                        )}
                        {lectura.franjas.dominante && (
                            <li>
                                {lectura.franjas.dominante.conteo} de {lectura.franjas.dominante.total} entre las{" "}
                                {lectura.franjas.dominante.inicio} y las {lectura.franjas.dominante.fin}
                            </li>
                        )}
                        {lectura.escalada && (
                            <li>
                                Empezó como {lectura.escalada.primera.replace(/_/g, " ").toLowerCase()} y el último es de{" "}
                                {lectura.escalada.ultima.replace(/_/g, " ").toLowerCase()}
                            </li>
                        )}
                        {lectura.aceleracion && (
                            <li>
                                {lectura.aceleracion.ultimos7} hechos en los últimos 7 días (antes: {lectura.aceleracion.previos7})
                            </li>
                        )}
                        <li>
                            {lectura.alcance.reporteros}{" "}
                            {lectura.alcance.reporteros === 1 ? "persona ha reportado" : "personas distintas han reportado"}
                        </li>
                        {lectura.perfil && (
                            <li>
                                Edades reportadas: {lectura.perfil.edadMin}
                                {lectura.perfil.edadMax !== lectura.perfil.edadMin ? ` a ${lectura.perfil.edadMax}` : ""} años
                            </li>
                        )}
                    </ul>
                    <p className="mt-2 text-xs text-muted">
                        Estas cifras se calculan de tus datos en el momento — siempre están al día. Pide el análisis
                        detallado para la lectura completa de este patrón.
                    </p>
                </section>
            )}

            {/* ── La historia, en orden ── */}
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <h2 className="font-medium text-body">La historia, en orden</h2>
                <ol className="mt-3 space-y-4 border-l border-tinta/10 pl-4 dark:border-papel/10">
                    {hechos.map((h, i) => (
                        <li key={`${h.reporteId ?? "ajeno"}-${i}`}>
                            <p className="text-xs text-muted">
                                {fmtFecha(h.fecha)}
                                {h.ciudad ? ` · ${h.ciudad}` : ""} ·{" "}
                                <span className={h.origen === "mio" ? "text-pino" : ""}>{ORIGEN_LABEL[h.origen]}</span>
                                {h.categoriaLabel ? ` · ${h.categoriaLabel}` : ""}
                            </p>
                            {h.origen === "mio" && h.reporteId ? (
                                <div className="mt-1">
                                    <TextoSensible reporteId={h.reporteId} retapadoMinutos={retapadoMinutos} />
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-muted">
                                    {h.origen === "anonimo" ? "Alguien más lo reportó" : "Otro padre lo reportó"}
                                    {h.categoriaLabel ? ` · clasificación: ${h.categoriaLabel}` : ""}
                                </p>
                            )}
                        </li>
                    ))}
                </ol>
            </section>

            {/* ── Los informes, para siempre ── */}
            <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium text-body">Informes generados</h2>
                    <a href={`/api/padre/expedientes/${expedienteId}/pdf`}>
                        <Button>Generar informe (PDF)</Button>
                    </a>
                </div>
                {informes.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Aún no has generado ninguno.</p>
                ) : (
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                        {informes.map((inf) => (
                            <li key={inf.numeroSecuencial}>
                                Informe #{inf.numeroSecuencial} · generado el {fmtFecha(inf.generadoEn)} ·
                                código {inf.codigoVerificacion}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-2 text-xs text-muted">
                    Cada informe queda registrado para siempre y lleva un código de verificación: quien lo reciba
                    puede confirmar que es auténtico y no fue alterado.
                </p>
            </section>

            <p className="text-sm text-muted">
                Tu expediente nunca se cierra. Si pasa algo nuevo, agrega el evento desde Mis reportes y vuelve
                aquí a generar otro informe.
            </p>
        </div>
    );
}
