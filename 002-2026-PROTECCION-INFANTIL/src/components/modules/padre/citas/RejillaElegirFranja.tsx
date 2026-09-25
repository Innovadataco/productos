"use client";

/**
 * SPEC-730 · El padre ELIGE su franja en la MISMA rejilla visual del profesional
 * (SPEC-714), no en una lista (radicado SPEC-730 · Jelkin probando). Solo lectura
 * salvo el toque que selecciona: el padre no publica franjas. Voz «tú»/neutra.
 *
 * Reusa la rejilla compartida (`components/modules/calendario`): acá solo el mapeo
 * de las franjas libres (ISO → posición Bogotá) y el bloque seleccionable. Se monta
 * con las franjas ya cargadas (el panel muestra carga/vacío/error aparte), para que
 * el ancla abra en la semana de la franja más próxima.
 */
import { useMemo } from "react";
import { estiloBloque, fmt, posicionBogota } from "@/components/modules/calendario/fechas";
import { RejillaCalendario, type BloquePosicionado } from "@/components/modules/calendario/Rejilla";
import { NavCalendario } from "@/components/modules/calendario/NavCalendario";
import { useCalendarioNav } from "@/components/modules/calendario/useCalendarioNav";
import { diaBogota } from "@/lib/fechas/formato-bogota";

export interface FranjaLibre {
    id: string;
    inicio: string;
    fin: string;
    modalidad: "VIRTUAL" | "PRESENCIAL";
}

interface BloqueFranjaLibre extends BloquePosicionado {
    modalidad: "VIRTUAL" | "PRESENCIAL";
    franja: FranjaLibre;
}

export function RejillaElegirFranja({
    franjas,
    franjaSelId,
    onSeleccionar,
}: {
    franjas: FranjaLibre[];
    franjaSelId: string | null;
    onSeleccionar: (f: FranjaLibre) => void;
}) {
    const hoy = diaBogota();

    const bloquesPorDia = useMemo(() => {
        const m = new Map<string, BloqueFranjaLibre[]>();
        for (const f of franjas) {
            const ini = posicionBogota(f.inicio);
            const fin = posicionBogota(f.fin);
            const arr = m.get(ini.fecha) ?? [];
            arr.push({ id: f.id, minInicio: ini.minutos, minFin: fin.minutos, modalidad: f.modalidad, franja: f });
            m.set(ini.fecha, arr);
        }
        return m;
    }, [franjas]);

    // Abrir en la semana de la franja más próxima (hoy o después), no en un «hoy» vacío.
    const anclaInicial = useMemo(() => {
        const fechas = [...bloquesPorDia.keys()].filter((d) => d >= hoy).sort();
        return fechas[0] ?? hoy;
    }, [bloquesPorDia, hoy]);

    const nav = useCalendarioNav(hoy, anclaInicial);

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
                    const sel = b.franja.id === franjaSelId;
                    return (
                        <button
                            key={b.id}
                            type="button"
                            aria-pressed={sel}
                            onClick={() => onSeleccionar(b.franja)}
                            className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] ${sel ? "border-cielo bg-cielo/25 text-cielo-700 ring-2 ring-cielo" : "border-cielo/55 bg-cielo/15 text-cielo-700 hover:bg-cielo/25"}`}
                            style={{ top, height }}
                        >
                            <div className="font-mono text-[10px] font-semibold">{fmt(b.minInicio)}–{fmt(b.minFin)}</div>
                            <div className="opacity-90">{b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</div>
                        </button>
                    );
                }}
            />
        </div>
    );
}
