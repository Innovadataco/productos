"use client";

/**
 * SPEC-605 (pantalla madre del EXPEDIENTE) — los cinco bloques del diseño
 * aprobado (`design/expediente-final-mockup.html` §2), en orden:
 *
 *  ① Cabecera: chip del menor (desde hijoId), EXP/id, identificador,
 *    plataforma, estado (En proceso/Procesado) + «Consultar estado» (refetch
 *    real contra GET /api/padre/expedientes/[id]/estado) y SEMÁFORO grande con
 *    explicación en lenguaje sencillo (presunción de inocencia: «reportes
 *    registrados», nunca veredictos).
 *  ② «¿Qué ha pasado con esta cuenta?» — línea de tiempo unificada: eventos
 *    propios marcados «tú» + los de OTRAS familias blindados (fecha · ciudad ·
 *    categoría · «una familia más») + nota de privacidad.
 *  ③ «Tu evidencia» — eventos propios con el texto tapado (TextoSensible, sin
 *    tocar: SPEC-606 le cambia el step-up).
 *  ④ «El análisis» — clasificación dominante, confianza, quién revisó,
 *    «También consideró», caja «¿Qué significa?» y TENDENCIA simple (7 días).
 *  ⑤ Acciones — «+ Agregar evento» (flujo existente), «Llevar a un
 *    profesional» (?expedienteId=, ya soportado) y canales oficiales.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fechaCorta, fechaHechoLegible } from "@/lib/format/fecha";
import { TextoSensible } from "./TextoSensible";
import { AgregarEvento } from "./AgregarEvento";
import { GenerarPase } from "./GenerarPase";
import { QuienHaLeido } from "./QuienHaLeido";
import type { EstadoExpediente, EstadoReporte } from "@prisma/client";

type Urgencia = "alta" | "media" | "baja" | "sin_clasificar";
type NivelItem = "alta" | "media" | "baja" | null;

export interface ExpedienteMadreDto {
    expediente: {
        id: string;
        codigo: string;
        identificador: string;
        plataforma: string;
        estado: EstadoExpediente;
        estadoLabel: string;
        fechaApertura: string;
        ultimoEventoEn: string | null;
    };
    hijo: { nombre: string; edad: number | null } | null;
    reportePrincipalId: string | null;
    estadoReportes: "EN_PROCESO" | "PROCESADO";
    procesando: number;
    semaforo: { nivel: Urgencia; titulo: string; explicacion: string };
    timeline: Array<{
        fecha: string;
        horaAproximada: boolean;
        esPropio: boolean;
        categoriaLabel: string | null;
        nivel: NivelItem;
        esPrimero: boolean;
        reporteId: string | null;
        estadoReporte: EstadoReporte | null;
        familias: number;
        ciudades: string[];
    }>;
    evidencia: Array<{
        reporteId: string;
        fecha: string;
        horaAproximada: boolean;
        categoriaLabel: string | null;
        nivel: NivelItem;
        estadoReporte: EstadoReporte;
    }>;
    analisis: {
        clasificacionDominante: string;
        confianza: number | null;
        revisadoPorPersona: boolean;
        tambienConsidero: string[];
        queSignifica: string | null;
    } | null;
    tendencia: { direccion: "subiendo" | "estable" | "bajando"; nuevosUltimos7: number; previos7: number; texto: string };
    ficha: {
        eventosTotales: number;
        tuyos: number;
        familiasQueReportan: number;
        estadoLabel: string;
        plataforma: string;
        menor: string | null;
        abierto: string;
    };
}

const SEMAFORO_CLASES: Record<Urgencia, { caja: string; bol: string; titulo: string }> = {
    alta: { caja: "border-rubi/45 bg-rubi/10", bol: "bg-rubi shadow-[0_0_12px_rgb(var(--rubi-rgb)/0.7)]", titulo: "text-rubi" },
    media: { caja: "border-ambar/45 bg-ambar/10", bol: "bg-ambar shadow-[0_0_12px_rgb(var(--ambar-rgb)/0.7)]", titulo: "text-ambar" },
    baja: { caja: "border-pino/45 bg-pino/10", bol: "bg-pino shadow-[0_0_12px_rgb(var(--pino-rgb)/0.7)]", titulo: "text-pino" },
    sin_clasificar: { caja: "border-tinta/20 bg-tinta/5 dark:border-papel/20", bol: "bg-tinta/40 dark:bg-papel/40", titulo: "text-body" },
};

const DOT_NIVEL: Record<Exclude<NivelItem, null>, string> = {
    alta: "bg-rubi",
    media: "bg-ambar",
    baja: "bg-pino",
};

const CHIP_NIVEL: Record<Exclude<NivelItem, null>, string> = {
    alta: "border-rubi/40 bg-rubi/10 text-rubi",
    media: "border-ambar/40 bg-ambar/10 text-ambar",
    baja: "border-pino/40 bg-pino/10 text-pino",
};

function iniciales(nombre: string): string {
    return nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
}

function ChipCategoria({ label, nivel }: { label: string; nivel: NivelItem }) {
    const clases = nivel ? CHIP_NIVEL[nivel] : "border-tinta/20 bg-tinta/5 text-muted dark:border-papel/20";
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${clases}`}>
            {label}
        </span>
    );
}

function notaEstadoPropio(estado: EstadoReporte | null): string | null {
    if (!estado) return null;
    if (estado === "PENDIENTE" || estado === "PROCESANDO") return "en proceso de clasificación";
    if (estado === "CLASIFICADO" || estado === "CORREGIDO") return null;
    return "en revisión";
}

export function ExpedienteMadreClient({ detalle }: { detalle: ExpedienteMadreDto }) {
    const router = useRouter();
    const { expediente, hijo, semaforo, timeline, evidencia, analisis, tendencia, ficha } = detalle;

    const [estadoUI, setEstadoUI] = useState({
        estadoReportes: detalle.estadoReportes,
        estadoLabel: expediente.estadoLabel,
        procesando: detalle.procesando,
    });
    const [consultando, setConsultando] = useState(false);
    const [errorConsulta, setErrorConsulta] = useState("");
    const [agregando, setAgregando] = useState(false);

    const consultarEstado = async () => {
        setConsultando(true);
        setErrorConsulta("");
        try {
            const res = await fetch(`/api/padre/expedientes/${expediente.id}/estado`, { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos consultar el estado. Intenta de nuevo.");
            const j = (await res.json()) as {
                estadoReportes: "EN_PROCESO" | "PROCESADO";
                estadoLabel: string;
                procesando: number;
            };
            setEstadoUI({ estadoReportes: j.estadoReportes, estadoLabel: j.estadoLabel, procesando: j.procesando });
            router.refresh();
        } catch (err) {
            setErrorConsulta(err instanceof Error ? err.message : "No pudimos consultar el estado.");
        } finally {
            setConsultando(false);
        }
    };

    const clasesSemaforo = SEMAFORO_CLASES[semaforo.nivel];
    const primerNombre = hijo?.nombre.split(" ")[0] ?? null;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <Link href="/dashboard/padre/expedientes" className="text-sm text-muted underline-offset-2 hover:text-body hover:underline">
                ← Mis expedientes
            </Link>

            {/* ① Cabecera */}
            <header className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {hijo && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-tinta/15 bg-tinta/5 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-body dark:border-papel/15 dark:bg-papel/10">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-pino to-cielo text-[9px] font-extrabold text-papel">
                                {iniciales(hijo.nombre)}
                            </span>
                            {primerNombre}
                            {hijo.edad !== null ? ` · ${hijo.edad} años` : ""}
                        </span>
                    )}
                    <span className="font-mono text-sm font-bold text-cielo">{expediente.codigo}</span>
                    <h1 className="text-base font-bold text-body">{expediente.identificador}</h1>
                    <span className="text-xs text-muted">
                        {expediente.plataforma} · abierto el {fechaCorta(expediente.fechaApertura)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${
                                estadoUI.estadoReportes === "EN_PROCESO"
                                    ? "border-ambar/40 bg-ambar/10 text-ambar"
                                    : "border-pino/40 bg-pino/10 text-pino"
                            }`}
                        >
                            <i className={`h-1.5 w-1.5 rounded-full ${estadoUI.estadoReportes === "EN_PROCESO" ? "bg-ambar" : "bg-pino"}`} aria-hidden="true" />
                            {estadoUI.estadoReportes === "EN_PROCESO" ? "En proceso" : "Procesado"}
                        </span>
                        <Button variant="secondary" onClick={consultarEstado} isLoading={consultando}>
                            Consultar estado
                        </Button>
                    </span>
                </div>
                <p className="text-xs text-muted">
                    {estadoUI.estadoLabel}
                    {estadoUI.procesando > 0
                        ? ` · ${estadoUI.procesando} ${estadoUI.procesando === 1 ? "evento tuyo sigue" : "eventos tuyos siguen"} en clasificación`
                        : ""}
                </p>
                {errorConsulta && <p className="text-sm text-ambar">{errorConsulta}</p>}

                {/* Semáforo grande */}
                <div className={`flex items-start gap-3 rounded-xl border p-4 ${clasesSemaforo.caja}`} role="status">
                    <span className={`mt-1 h-4 w-4 flex-none animate-pulseSlow rounded-full ${clasesSemaforo.bol}`} aria-hidden="true" />
                    <span>
                        <b className={`block text-sm tracking-wide ${clasesSemaforo.titulo}`}>{semaforo.titulo}</b>
                        <p className="mt-0.5 text-xs text-muted">{semaforo.explicacion}</p>
                    </span>
                </div>
            </header>

            {/* ② ¿Qué ha pasado con esta cuenta? */}
            <section aria-labelledby="bloque-timeline">
                <div className="mb-3 flex items-baseline gap-2">
                    <h2 id="bloque-timeline" className="text-sm font-bold text-body">¿Qué ha pasado con esta cuenta?</h2>
                    <span className="text-xs text-subtle">
                        línea de tiempo cronológica · {timeline.length} {timeline.length === 1 ? "evento" : "eventos"}
                    </span>
                </div>
                <ol className="flex flex-col">
                    {timeline.map((item, i) => (
                        <li key={`${item.reporteId ?? `ajeno-${item.fecha}`}-${i}`} className={`flex items-start gap-3 py-2 ${i > 0 ? "border-t border-dashed border-tinta/10 dark:border-papel/10" : ""}`}>
                            <span className="w-24 flex-none pt-0.5 font-mono text-[10px] text-subtle">{fechaHechoLegible(item.fecha, item.horaAproximada)}</span>
                            <span
                                className={`mt-1.5 h-2 w-2 flex-none rounded-full ${item.nivel ? DOT_NIVEL[item.nivel] : "bg-tinta/30 dark:bg-papel/30"}`}
                                aria-hidden="true"
                            />
                            <span className="flex-1 text-sm">
                                {item.esPropio ? (
                                    <>
                                        <span className="mr-1.5 inline-flex items-center rounded-full bg-pino px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-papel">
                                            tú
                                        </span>
                                        {item.categoriaLabel && <ChipCategoria label={item.categoriaLabel} nivel={item.nivel} />}
                                        <br />
                                        <small className="text-subtle">
                                            {item.esPrimero
                                                ? "Primer reporte de este expediente"
                                                : notaEstadoPropio(item.estadoReporte)
                                                    ? `Tu reporte · ${notaEstadoPropio(item.estadoReporte)}`
                                                    : "Tu reporte · el texto está en «Tu evidencia»"}
                                        </small>
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-1.5 inline-flex items-center rounded-full border border-tinta/15 bg-tinta/5 px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-muted dark:border-papel/15 dark:bg-papel/10">
                                            {item.familias === 1 ? "una familia más" : `${item.familias} familias más`}
                                        </span>
                                        {item.categoriaLabel && <ChipCategoria label={item.categoriaLabel} nivel={item.nivel} />}
                                        <br />
                                        <small className="text-subtle">
                                            {item.ciudades.length > 0
                                                ? `${item.ciudades.length === 1 ? item.ciudades[0] : `${item.ciudades.slice(0, -1).join(", ")} y ${item.ciudades[item.ciudades.length - 1]}`} · `
                                                : ""}
                                            {item.familias > 1 ? "contados como un solo evento agregado" : "el texto de otros reportes no se comparte"}
                                        </small>
                                    </>
                                )}
                            </span>
                        </li>
                    ))}
                </ol>
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-cielo/35 bg-cielo/10 p-3 text-xs text-body">
                    <LockIcon className="mt-0.5 h-4 w-4 flex-none text-cielo" />
                    <p>
                        <b className="text-cielo">Privacidad:</b> los eventos de otras familias se ven solo como
                        metadatos (fecha aproximada, ciudad, clasificación). Sus textos nunca se comparten; tú
                        decides si revelar los tuyos.
                    </p>
                </div>
            </section>

            {/* ③ Tu evidencia */}
            <section aria-labelledby="bloque-evidencia">
                <div className="mb-3 flex items-baseline gap-2">
                    <h2 id="bloque-evidencia" className="text-sm font-bold text-body">Tu evidencia</h2>
                    <span className="text-xs text-subtle">tus eventos, protegidos por defecto</span>
                </div>
                <div className="space-y-3">
                    {evidencia.map((ev) => (
                        <div key={ev.reporteId} className="rounded-xl border border-tinta/10 bg-tinta/5 p-3.5 dark:border-papel/10 dark:bg-papel/5">
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                                <span className="font-mono text-[10.5px] text-subtle">{fechaHechoLegible(ev.fecha, ev.horaAproximada)}</span>
                                {ev.categoriaLabel && <ChipCategoria label={ev.categoriaLabel} nivel={ev.nivel} />}
                                <span className="inline-flex items-center rounded-full bg-pino px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-papel">
                                    tú
                                </span>
                                {notaEstadoPropio(ev.estadoReporte) && (
                                    <span className="text-subtle">{notaEstadoPropio(ev.estadoReporte)}</span>
                                )}
                            </div>
                            <TextoSensible reporteId={ev.reporteId} />
                        </div>
                    ))}
                </div>
            </section>

            {/* ④ El análisis */}
            <section aria-labelledby="bloque-analisis">
                <div className="mb-3 flex items-baseline gap-2">
                    <h2 id="bloque-analisis" className="text-sm font-bold text-body">El análisis</h2>
                    <span className="text-xs text-subtle">qué concluyó la revisión</span>
                </div>
                <div className="rounded-xl border border-cielo/30 bg-cielo/10 p-4">
                    {analisis ? (
                        <>
                            <h3 className="text-sm font-bold text-cielo">
                                Clasificación dominante: {analisis.clasificacionDominante}
                            </h3>
                            <p className="mt-1 text-xs text-body">
                                {analisis.confianza !== null ? (
                                    <>
                                        Confianza de la clasificación: <b>{Math.round(analisis.confianza * 100)}%</b> ·{" "}
                                        {analisis.revisadoPorPersona
                                            ? "revisado por una persona."
                                            : "clasificación automática del motor local, sin salir del servidor."}
                                    </>
                                ) : (
                                    "La dominante sale de los reportes de la comunidad; tus eventos con esta conducta aún no tienen clasificación final."
                                )}
                            </p>
                            {analisis.tambienConsidero.length > 0 && (
                                <p className="mt-1 text-xs text-body">
                                    También consideró: {analisis.tambienConsidero.join(", ").toLowerCase()}.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-body">
                            Todavía no hay una clasificación final para esta cuenta. Cuando la revisión termine,
                            acá verás la clasificación dominante, su confianza y qué significa.
                        </p>
                    )}

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-tinta/10 bg-superficie-1 p-3 sm:grid-cols-3 dark:border-tinta/12">
                        <FichaItem label="Eventos totales" valor={`${ficha.eventosTotales} (tuyos: ${ficha.tuyos})`} />
                        <FichaItem
                            label="Familias que reportan"
                            valor={`${ficha.familiasQueReportan}`}
                        />
                        <FichaItem label="Estado" valor={ficha.estadoLabel} />
                        <FichaItem label="Plataforma" valor={ficha.plataforma} />
                        <FichaItem label="Menor vinculado" valor={ficha.menor ?? "Sin vincular"} />
                        <FichaItem label="Abierto" valor={fechaCorta(ficha.abierto)} />
                    </dl>

                    {analisis?.queSignifica && (
                        <div className="mt-3 rounded-lg border border-cielo/25 bg-superficie-1 p-3 text-xs text-body">
                            <b className="text-cielo">¿Qué significa?</b> {analisis.queSignifica}
                        </div>
                    )}

                    <div
                        className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                            tendencia.direccion === "subiendo"
                                ? "border-ambar/35 bg-ambar/10 text-body"
                                : tendencia.direccion === "bajando"
                                    ? "border-pino/35 bg-pino/10 text-body"
                                    : "border-tinta/15 bg-tinta/5 text-body dark:border-papel/15 dark:bg-papel/5"
                        }`}
                    >
                        <TendenciaIcon
                            className={`mt-0.5 h-3.5 w-3.5 flex-none ${
                                tendencia.direccion === "subiendo"
                                    ? "text-ambar"
                                    : tendencia.direccion === "bajando"
                                        ? "text-pino"
                                        : "text-muted"
                            }`}
                        />
                        <p>
                            <b
                                className={
                                    tendencia.direccion === "subiendo"
                                        ? "text-ambar"
                                        : tendencia.direccion === "bajando"
                                            ? "text-pino"
                                            : "text-body"
                                }
                            >
                                Tendencia: {tendencia.direccion}.
                            </b>{" "}
                            {tendencia.texto}
                        </p>
                    </div>
                </div>
            </section>

            {/* ⑤ Acciones */}
            <section aria-labelledby="bloque-acciones">
                <h2 id="bloque-acciones" className="mb-3 text-sm font-bold text-body">Qué puedes hacer</h2>
                <div className="flex flex-wrap gap-2.5">
                    {detalle.reportePrincipalId && expediente.estado !== "CERRADO" && (
                        <Button onClick={() => setAgregando((v) => !v)}>
                            {agregando ? "Cerrar el formulario" : "+ Agregar evento"}
                        </Button>
                    )}
                    <Link
                        href={`/dashboard/padre/profesionales?expedienteId=${encodeURIComponent(expediente.id)}`}
                        className="inline-flex h-9 items-center justify-center rounded-[10px] border border-tinta/25 px-4 text-sm font-semibold text-body transition hover:bg-tinta/5 dark:border-papel/25 dark:hover:bg-papel/10"
                    >
                        Llevar a un profesional
                    </Link>
                </div>
                {agregando && detalle.reportePrincipalId && (
                    <div className="mt-3">
                        <AgregarEvento
                            reporteId={detalle.reportePrincipalId}
                            identificador={expediente.identificador}
                            plataforma={expediente.plataforma}
                            onListo={() => {
                                setAgregando(false);
                                router.refresh();
                            }}
                            onCancelar={() => setAgregando(false)}
                        />
                    </div>
                )}
                <div className="mt-4 rounded-xl border border-cielo/30 bg-cielo/10 p-3.5 text-xs text-body">
                    <b className="text-cielo">Si un menor está en riesgo ahora:</b> Línea 141 del ICBF · CAI Virtual
                    de la Policía · Te Protejo. Este expediente es una señal comunitaria de prevención, no un canal
                    oficial de denuncia.
                </div>
            </section>

            {/* ⑥ El pase para tu psicólogo (SPEC-610 · I-372 · D-129): genera el pase que
                abre este expediente completo y muestra quién lo ha abierto. */}
            <section aria-labelledby="bloque-pase">
                <h2 id="bloque-pase" className="mb-3 text-sm font-bold text-body">El pase para tu psicólogo</h2>
                <GenerarPase expedienteId={expediente.id} />
                <div className="mt-4">
                    <QuienHaLeido expedienteId={expediente.id} />
                </div>
            </section>
        </div>
    );
}

function FichaItem({ label, valor }: { label: string; valor: string }) {
    return (
        <div className="text-[11px]">
            <dt className="text-[9px] font-bold uppercase tracking-wider text-subtle">{label}</dt>
            <dd className="text-body">{valor}</dd>
        </div>
    );
}

function LockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

function TendenciaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17 9 11l4 4 8-8" />
            <path d="M14 7h7v7" />
        </svg>
    );
}
