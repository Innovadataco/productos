"use client";

/**
 * SPEC-730 · «Mis citas» del padre en la MISMA rejilla visual del profesional
 * (SPEC-714), no en una lista de tarjetas (radicado SPEC-730 · Jelkin probando).
 * El padre ve SOLO sus citas y entra a cada una en su detalle existente
 * (`/dashboard/padre/citas/[id]`, donde ya viven el estado y el contacto —H-2—; y,
 * cuando existan, la dirección presencial (SPEC-708) y el enlace de la reunión —que
 * es POR CITA y lo pone el operador, no un campo del perfil): la rejilla es el índice,
 * no reconstruye el panel.
 *
 * El padre no publica ni edita franjas: solo lectura + entrada. Voz «tú». El estado
 * de una cita es PROCESO, nunca criticidad: cielo/ámbar/pino/tinta, CERO rubí (D-120).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EstadoSolicitudCita } from "@prisma/client";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import { badgeDeCitaEfectivo } from "@/lib/padre/citas-listado";
import { estadoEfectivoDeCita } from "@/lib/profesional/cita/estado-efectivo";
import { estiloBloque, fmt, posicionBogota } from "@/components/modules/calendario/fechas";
import { RejillaCalendario, type BloquePosicionado } from "@/components/modules/calendario/Rejilla";
import { NavCalendario } from "@/components/modules/calendario/NavCalendario";
import { useCalendarioNav } from "@/components/modules/calendario/useCalendarioNav";
import { diaBogota } from "@/lib/fechas/formato-bogota";

interface BloqueCita extends BloquePosicionado {
    cita: CitaParaPadreDto;
}

// El estado de la cita es PROCESO (mismos colores que el badge del listado):
// cielo=confirmada, ámbar=esperando, pino=realizada, tinta=final neutro. NUNCA rubí.
function claseBloque(estado: EstadoSolicitudCita, pasada: boolean): string {
    // SPEC-749 FR-2: CONFIRMADA con la hora ya pasada NO va en cielo (cita viva) → neutro tinta.
    if (pasada) return "border-tinta/20 bg-tinta/5 text-muted";
    switch (estado) {
        case "CONFIRMADA":
            return "border-cielo/55 bg-cielo/15 text-cielo-700";
        case "SIN_CONFIRMAR":
        case "PAGADA_PENDIENTE":
            return "border-estado-ambar/50 bg-estado-ambar/15 text-estado-ambar";
        case "CUMPLIDA":
            return "border-pino/50 bg-pino/15 text-estado-pino";
        default:
            return "border-tinta/20 bg-tinta/5 text-muted";
    }
}

// SPEC-730 (Diseño · FORMA-SPEC730-MIS-CITAS-BLOQUE-ESTADO): señal de estado NO-color
// (WCAG 1.4.1 · daltonismo). Cada estado tiene una FORMA propia; con el ícono, recortar
// la etiqueta de texto deja de perder información.
function iconoEstado(estado: EstadoSolicitudCita, pasada: boolean): string {
    // SPEC-749 FR-2: CONFIRMADA pasada NO es «✓ Confirmada» viva ni «✓✓ Realizada» → «–» neutro.
    if (pasada) return "–";
    switch (estado) {
        case "CONFIRMADA":
            return "✓";
        case "SIN_CONFIRMAR":
        case "PAGADA_PENDIENTE":
            return "◷";
        case "CUMPLIDA":
            return "✓✓";
        default:
            return "–";
    }
}

export function RejillaMisCitas({ citas }: { citas: CitaParaPadreDto[] }) {
    const hoy = diaBogota();
    // SPEC-749 FR-2: `now` inyectado (reloj del cliente, tick 60 s) para que una cita
    // cruce a «Ya pasó» en vivo. Fuera del render (regla de pureza de React).
    const [ahoraMs, setAhoraMs] = useState<number>(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setAhoraMs(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);

    const bloquesPorDia = useMemo(() => {
        const m = new Map<string, BloqueCita[]>();
        for (const c of citas) {
            const ini = posicionBogota(c.franja.inicio);
            const fin = posicionBogota(c.franja.fin);
            const arr = m.get(ini.fecha) ?? [];
            arr.push({ id: c.id, minInicio: ini.minutos, minFin: fin.minutos, cita: c });
            m.set(ini.fecha, arr);
        }
        return m;
    }, [citas]);

    const nav = useCalendarioNav(hoy);

    if (citas.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <h2 className="text-lg font-semibold text-body">Todavía no tienes citas.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                    Cuando pidas una cita con un psicólogo, aparecerá aquí para que la sigas.
                </p>
                <Link
                    href="/dashboard/padre/profesionales"
                    className="mt-5 inline-flex h-11 items-center rounded-xl bg-cielo px-5 font-semibold text-acento-ink transition hover:brightness-110"
                >
                    Encontrar psicólogo
                </Link>
            </div>
        );
    }

    return (
        <div>
            <NavCalendario
                rango={nav.rango}
                vista={nav.vista}
                onVista={nav.setVista}
                onAnterior={nav.irAnterior}
                onSiguiente={nav.irSiguiente}
                onHoy={nav.irHoy}
            />
            <RejillaCalendario
                diasVisibles={nav.diasVisibles}
                hoy={hoy}
                anchoDia={nav.anchoDia}
                bloquesPorDia={bloquesPorDia}
                onDiaHeaderClick={(d) => { nav.setVista("dia"); nav.setAncla(d); }}
                renderBloque={(b) => {
                    const { top, height } = estiloBloque(b.minInicio, b.minFin);
                    // SPEC-749 FR-2: la lista deriva la verdad temporal igual que el detalle
                    // (resumen y detalle no se contradicen). `now` = reloj de render.
                    const pasada =
                        b.cita.estado === "CONFIRMADA" &&
                        estadoEfectivoDeCita("CONFIRMADA", b.cita.franja.inicio, b.cita.franja.fin, ahoraMs) === "PASADA";
                    const badge = badgeDeCitaEfectivo(b.cita.estado, b.cita.franja.inicio, b.cita.franja.fin, ahoraMs);
                    return (
                        <Link
                            key={b.id}
                            href={`/dashboard/padre/citas/${b.cita.id}`}
                            aria-label={`${b.cita.profesional.nombreVisible} · ${badge.label} · ${fmt(b.minInicio)}`}
                            // SPEC-730 (Diseño): alto MÍNIMO 28px para que la línea 1 (ícono + nombre)
                            // no se recorte aunque la cita sea corta — legibilidad sobre pixel-perfect.
                            className={`absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-lg border px-1.5 py-0.5 text-[11px] transition hover:brightness-105 ${claseBloque(b.cita.estado, pasada)}`}
                            style={{ top, height, minHeight: 28 }}
                        >
                            {/* Línea 1 — nunca se recorta: ícono de estado (señal no-color) + nombre. */}
                            <div className="flex items-center gap-1 font-medium leading-tight">
                                <span aria-hidden="true" className="shrink-0 font-mono">{iconoEstado(b.cita.estado, pasada)}</span>
                                <span className="truncate">{b.cita.profesional.nombreVisible}</span>
                            </div>
                            {/* Línea 2 — puede recortarse: el estado ya lo dicen ícono + color + leyenda. */}
                            <div className="truncate text-[10px] leading-tight opacity-90">{fmt(b.minInicio)} · {badge.label}</div>
                        </Link>
                    );
                }}
            />
            {/* SPEC-730 (Diseño): leyenda ícono+color → estado, para decodificar el bloque sin tocar. */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                <span><span aria-hidden="true" className="font-mono text-cielo-700">✓</span> Confirmada</span>
                <span><span aria-hidden="true" className="font-mono text-estado-ambar">◷</span> Esperando confirmación</span>
                <span><span aria-hidden="true" className="font-mono text-estado-pino">✓✓</span> Realizada</span>
                <span><span aria-hidden="true" className="font-mono text-muted">–</span> Otro estado</span>
            </div>
        </div>
    );
}
