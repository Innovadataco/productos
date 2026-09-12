"use client";

/**
 * SPEC-605 · Lista «Mis expedientes» — una tarjeta por expediente ordenada por
 * URGENCIA (clasificación dominante: alta → media → baja → sin clasificar;
 * cerrados al final), con barra de urgencia (rubí/ámbar/menta/gris), chip del
 * menor, EXP/id, semáforo, «N eventos tuyos · M familias más reportaron»,
 * última actividad y las acciones [Abrir expediente] [+ Reportar evento].
 * Diseño aprobado: `design/expediente-final-mockup.html` §1.
 */
import Link from "next/link";
import { AutoSuggestExpediente } from "./AutoSuggestExpediente";
import { debeMostrarAutoSuggest, diasDesdeUltimaActividad } from "@/lib/padre/expediente-ui";
import { fechaCorta } from "@/lib/format/fecha";
import type { UrgenciaExpediente } from "@/lib/dal/services/expediente-detalle";
import type { EstadoExpediente } from "@prisma/client";

export interface ExpedienteListaItemSerializable {
    expedienteId: string;
    codigo: string;
    identificador: string;
    plataforma: string;
    estado: EstadoExpediente;
    estadoLabel: string;
    hijo: { nombre: string; edad: number | null } | null;
    urgencia: UrgenciaExpediente;
    clasificacionDominante: string | null;
    eventosTuyos: number;
    otrasFamilias: number;
    totalReportes: number;
    ultimaActividad: string;
    cerrado: boolean;
}

const BARRA_URGENCIA: Record<UrgenciaExpediente, string> = {
    alta: "bg-rubi shadow-[0_0_16px_1px_rgb(var(--rubi-rgb)/0.6)]",
    media: "bg-ambar shadow-[0_0_16px_1px_rgb(var(--ambar-rgb)/0.6)]",
    baja: "bg-pino shadow-[0_0_16px_1px_rgb(var(--pino-rgb)/0.5)]",
    sin_clasificar: "bg-tinta/30 dark:bg-papel/30",
};

const SEMAFORO_LISTA: Record<UrgenciaExpediente, { label: string; clases: string; dot: string }> = {
    alta: { label: "Alerta prioritaria", clases: "border-rubi/40 bg-rubi/10 text-rubi", dot: "bg-rubi" },
    media: { label: "Requiere atención", clases: "border-ambar/40 bg-ambar/10 text-ambar", dot: "bg-ambar" },
    baja: { label: "Sin novedades", clases: "border-pino/40 bg-pino/10 text-pino", dot: "bg-pino" },
    sin_clasificar: {
        label: "Sin clasificar",
        clases: "border-tinta/20 bg-tinta/5 text-muted dark:border-papel/20 dark:bg-papel/5",
        dot: "bg-tinta/40 dark:bg-papel/40",
    },
};

const CHIP_URGENCIA: Record<Exclude<UrgenciaExpediente, "sin_clasificar">, string> = {
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

function textoUltimaActividad(iso: string): string {
    const dias = diasDesdeUltimaActividad(iso);
    if (dias === 0) return `hoy, ${fechaCorta(iso)}`;
    if (dias === 1) return "ayer";
    return fechaCorta(iso);
}

export function ExpedientesListClient({ expedientes }: { expedientes: ExpedienteListaItemSerializable[] }) {
    const expedienteActivoParaSugerir = expedientes.find(
        (exp) => !exp.cerrado && exp.estado === "ACTIVO" && debeMostrarAutoSuggest(exp.ultimaActividad)
    );

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-serif text-2xl text-body">Mis expedientes</h1>
                    <p className="mt-1 text-sm text-muted">
                        Ordenados por urgencia · {expedientes.length} {expedientes.length === 1 ? "expediente" : "expedientes"}
                    </p>
                </div>
                <Link
                    href="/dashboard/padre/reportar"
                    className="inline-flex h-9 items-center justify-center rounded-[10px] bg-cielo px-4 text-sm font-bold text-acento-ink transition hover:brightness-110"
                >
                    + Reportar una situación
                </Link>
            </div>

            {expedienteActivoParaSugerir && (
                <AutoSuggestExpediente
                    expedienteId={expedienteActivoParaSugerir.expedienteId}
                    identificadorReportado={expedienteActivoParaSugerir.identificador}
                    ultimoEventoEn={new Date(expedienteActivoParaSugerir.ultimaActividad)}
                />
            )}

            {expedientes.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-muted">
                        Todavía no tienes expedientes. Cuando reportes una situación, su expediente se abre solo.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {expedientes.map((exp) => (
                        <TarjetaExpediente key={exp.expedienteId} exp={exp} />
                    ))}
                </div>
            )}

            <p className="mt-3 text-xs text-subtle">
                Reportar sobre una cuenta con expediente suma un evento al mismo expediente; sobre una cuenta nueva
                abre uno.
            </p>
        </div>
    );
}

function TarjetaExpediente({ exp }: { exp: ExpedienteListaItemSerializable }) {
    const semaforo = SEMAFORO_LISTA[exp.urgencia];
    const primerNombre = exp.hijo?.nombre.split(" ")[0] ?? null;

    return (
        <article className="glass relative overflow-hidden rounded-2xl p-4 pl-6">
            {/* Barra de urgencia */}
            <span
                className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl ${exp.cerrado ? "bg-tinta/30 dark:bg-papel/30" : BARRA_URGENCIA[exp.urgencia]}`}
                aria-hidden="true"
            />

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                {exp.hijo && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-tinta/15 bg-tinta/5 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-body dark:border-papel/15 dark:bg-papel/10">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-pino to-cielo text-[9px] font-extrabold text-papel">
                            {iniciales(exp.hijo.nombre)}
                        </span>
                        {primerNombre}
                    </span>
                )}
                <span className="font-mono text-[13px] font-bold text-cielo">{exp.codigo}</span>
                <b className="text-sm text-body">{exp.identificador}</b>
                <span className="text-xs text-muted">{exp.plataforma}</span>
                {exp.cerrado ? (
                    <span className="ml-auto inline-flex items-center rounded-full border border-tinta/15 bg-tinta/5 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-widest text-muted dark:border-papel/15 dark:bg-papel/10">
                        Cerrado
                    </span>
                ) : (
                    <span
                        className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-widest ${semaforo.clases}`}
                    >
                        <i className={`h-1.5 w-1.5 rounded-full ${semaforo.dot}`} aria-hidden="true" />
                        {semaforo.label}
                    </span>
                )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted">
                {exp.clasificacionDominante && (
                    <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
                            exp.urgencia === "sin_clasificar"
                                ? "border-tinta/20 bg-tinta/5 text-muted dark:border-papel/20"
                                : CHIP_URGENCIA[exp.urgencia]
                        }`}
                    >
                        {exp.clasificacionDominante}
                    </span>
                )}
                <span>
                    {exp.eventosTuyos} {exp.eventosTuyos === 1 ? "evento tuyo" : "eventos tuyos"} ·{" "}
                    {exp.otrasFamilias === 0
                        ? "sin reportes de otros"
                        : exp.otrasFamilias === 1
                            ? "1 familia más reportó"
                            : `${exp.otrasFamilias} familias más reportaron`}
                </span>
                <span>· última actividad {textoUltimaActividad(exp.ultimaActividad)}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <Link
                    href={`/dashboard/padre/expedientes/${exp.expedienteId}`}
                    className="inline-flex h-8 items-center justify-center rounded-[9px] bg-cielo px-3.5 text-xs font-bold text-acento-ink transition hover:brightness-110"
                >
                    Abrir expediente
                </Link>
                <Link
                    href="/dashboard/padre/reportar"
                    className="inline-flex h-8 items-center justify-center rounded-[9px] border border-tinta/25 px-3.5 text-xs font-semibold text-body transition hover:bg-tinta/5 dark:border-papel/25 dark:hover:bg-papel/10"
                >
                    + Reportar evento
                </Link>
            </div>
        </article>
    );
}
