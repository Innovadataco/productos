"use client";

/**
 * SPEC-545 · Listado «Mis citas» del padre. Tres grupos —Próximas · Pasadas ·
 * Canceladas— con los estados de `EstadoSolicitudCita` mapeados (layout Diseño
 * 06-09). Voz «tú», cálida. El estado de una cita es PROCESO: color cielo/ámbar/
 * pino/tinta, CERO rubí. Enlaza a cada detalle en /dashboard/padre/citas/[id].
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import { grupoDeCita, badgeDeCita, type GrupoCita } from "@/lib/padre/citas-listado";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

const TABS: { clave: GrupoCita; label: string }[] = [
    { clave: "proximas", label: "Próximas" },
    { clave: "pasadas", label: "Pasadas" },
    { clave: "canceladas", label: "Canceladas" },
];

function fechaHora(iso: string): string {
    return formatoFechaHoraBogota(iso, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

function inicial(nombre: string): string {
    return (nombre.trim()[0] ?? "?").toUpperCase();
}

function TarjetaCita({ cita, atenuada }: { cita: CitaParaPadreDto; atenuada: boolean }) {
    const badge = badgeDeCita(cita.estado);
    const esCancelada = grupoDeCita(cita.estado, new Date(cita.franja.inicio) > new Date()) === "canceladas";
    return (
        <article className={`rounded-2xl border border-tinta/10 p-4 ${atenuada ? "bg-papel opacity-90" : "bg-white dark:bg-tinta/20"}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cielo/15 text-sm font-bold text-cielo">
                        {inicial(cita.profesional.nombreVisible)}
                    </span>
                    <div className="min-w-0">
                        <div className="truncate font-semibold text-body">{cita.profesional.nombreVisible}</div>
                        {cita.profesional.tituloProfesional && (
                            <div className="truncate text-sm text-muted">{cita.profesional.tituloProfesional}</div>
                        )}
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.clases}`}>{badge.label}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-body">{fechaHora(cita.franja.inicio)}</span>
                <span className="inline-flex items-center gap-1 text-muted">
                    {cita.franja.modalidad === "VIRTUAL" ? "🖥️ Virtual" : "📍 Presencial"}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {esCancelada && (
                    <Link
                        href="/dashboard/padre/profesionales"
                        className="inline-flex h-9 items-center rounded-xl bg-pino px-3 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                        Pedir otra cita
                    </Link>
                )}
                <Link
                    href={`/dashboard/padre/citas/${cita.id}`}
                    className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-cielo transition hover:bg-cielo/10"
                >
                    Ver detalle
                </Link>
            </div>
        </article>
    );
}

export function MisCitasList({ citas }: { citas: CitaParaPadreDto[] }) {
    const [tab, setTab] = useState<GrupoCita>("proximas");

    const grupos = useMemo(() => {
        const g: Record<GrupoCita, CitaParaPadreDto[]> = { proximas: [], pasadas: [], canceladas: [] };
        const ahora = new Date();
        for (const c of citas) g[grupoDeCita(c.estado, new Date(c.franja.inicio) > ahora)].push(c);
        // Próximas: la más cercana primero. Pasadas/Canceladas: lo más reciente arriba.
        g.proximas.sort((a, b) => +new Date(a.franja.inicio) - +new Date(b.franja.inicio));
        g.pasadas.sort((a, b) => +new Date(b.franja.inicio) - +new Date(a.franja.inicio));
        g.canceladas.sort((a, b) => +new Date(b.franja.inicio) - +new Date(a.franja.inicio));
        return g;
    }, [citas]);

    if (citas.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <h2 className="text-lg font-semibold text-body">Todavía no tienes citas.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                    Cuando pidas una cita con un psicólogo, aparecerá aquí para que la sigas.
                </p>
                <Link
                    href="/dashboard/padre/profesionales"
                    className="mt-5 inline-flex h-11 items-center rounded-xl bg-pino px-5 font-semibold text-white transition hover:brightness-110"
                >
                    Encontrar psicólogo
                </Link>
            </div>
        );
    }

    const lista = grupos[tab];
    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.clave}
                        type="button"
                        onClick={() => setTab(t.clave)}
                        className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition ${
                            tab === t.clave ? "bg-cielo/15 text-cielo" : "text-muted hover:bg-tinta/5 hover:text-body"
                        }`}
                    >
                        {t.label} {grupos[t.clave].length > 0 ? `· ${grupos[t.clave].length}` : ""}
                    </button>
                ))}
            </div>

            {lista.length === 0 ? (
                <p className="rounded-2xl border border-tinta/10 p-6 text-center text-sm text-muted">
                    {tab === "proximas" ? "No tienes citas próximas." : tab === "pasadas" ? "Aún no tienes citas pasadas." : "No tienes citas canceladas."}
                </p>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {lista.map((c) => (
                        <TarjetaCita key={c.id} cita={c} atenuada={tab !== "proximas"} />
                    ))}
                </div>
            )}
        </div>
    );
}
