"use client";

/**
 * SPEC-730 · «Mis citas» del padre en la MISMA rejilla visual del profesional
 * (SPEC-714), no en una lista de tarjetas (radicado SPEC-730 · Jelkin probando).
 * El padre ve SOLO sus citas y entra a cada una en su detalle existente
 * (`/dashboard/padre/citas/[id]`, donde ya viven el estado, el contacto —H-2— y
 * el enlace/dirección de SPEC-708): la rejilla es el índice, no reconstruye el panel.
 *
 * El padre no publica ni edita franjas: solo lectura + entrada. Voz «tú». El estado
 * de una cita es PROCESO, nunca criticidad: cielo/ámbar/pino/tinta, CERO rubí (D-120).
 */
import { useMemo } from "react";
import Link from "next/link";
import type { EstadoSolicitudCita } from "@prisma/client";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import { badgeDeCita } from "@/lib/padre/citas-listado";
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
function claseBloque(estado: EstadoSolicitudCita): string {
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

export function RejillaMisCitas({ citas }: { citas: CitaParaPadreDto[] }) {
    const hoy = diaBogota();

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
                    const badge = badgeDeCita(b.cita.estado);
                    return (
                        <Link
                            key={b.id}
                            href={`/dashboard/padre/citas/${b.cita.id}`}
                            aria-label={`${b.cita.profesional.nombreVisible} · ${badge.label} · ${fmt(b.minInicio)}`}
                            className={`absolute inset-x-1 z-10 block overflow-hidden rounded-lg border px-2 py-1 text-[11px] transition hover:brightness-105 ${claseBloque(b.cita.estado)}`}
                            style={{ top, height }}
                        >
                            <div className="font-mono text-[10px] font-semibold">{fmt(b.minInicio)}</div>
                            <div className="truncate font-medium">{b.cita.profesional.nombreVisible}</div>
                            <div className="truncate opacity-90">{badge.label}</div>
                        </Link>
                    );
                }}
            />
        </div>
    );
}
