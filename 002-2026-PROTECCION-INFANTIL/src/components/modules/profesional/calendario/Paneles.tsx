"use client";

/** SPEC-714 · Popover de crear y panel de responder/detalle del calendario. Voz «usted». */
import { useState } from "react";
import type { BloqueCalendario } from "@/lib/profesional/calendario/calendario.service";
import { DOW, diaSemana, fmt, numMes, type Modalidad, type Repeticion } from "@/components/modules/calendario/fechas";

export interface CrearState {
    fecha: string;
    minInicio: number;
    minFin: number;
    modalidad: Modalidad;
    x: number;
    y: number;
}
export interface PanelState {
    tipo: "responder" | "detalle";
    bloque: BloqueCalendario;
}

export function PopoverCrear(props: {
    crear: CrearState;
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    enviando: boolean;
    onModalidad: (m: Modalidad) => void;
    onCancel: () => void;
    onPublicar: (rep: Repeticion) => void;
}) {
    const { crear } = props;
    const [rep, setRep] = useState<Repeticion>("no");
    return (
        <div className="absolute z-40 w-64 rounded-xl border border-tinta/10 bg-page p-4 shadow-xl" style={{ left: crear.x, top: Math.min(crear.y, 380) }}>
            <p className="text-sm font-semibold text-body">Publicar esta hora</p>
            <p className="mb-3 font-mono text-xs text-muted">{DOW[diaSemana(crear.fecha)]} {numMes(crear.fecha)} · {fmt(crear.minInicio)} – {fmt(crear.minFin)}</p>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-subtle">Modalidad</p>
            <div className="mb-3 flex gap-1.5">
                <button disabled={!props.atiendeVirtual} aria-pressed={crear.modalidad === "VIRTUAL"} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${crear.modalidad === "VIRTUAL" ? "border-cielo bg-cielo/15 text-cielo-700" : "border-tinta/10 text-muted"}`} onClick={() => props.onModalidad("VIRTUAL")}>Virtual</button>
                <button disabled={!props.atiendePresencial} aria-pressed={crear.modalidad === "PRESENCIAL"} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${crear.modalidad === "PRESENCIAL" ? "border-cielo bg-cielo/15 text-cielo-700" : "border-tinta/10 text-muted"}`} onClick={() => props.onModalidad("PRESENCIAL")}>Presencial</button>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                <span>Repetir</span>
                <select aria-label="Repetir esta hora" value={rep} onChange={(e) => setRep(e.target.value as Repeticion)} className="flex-1 rounded-lg border border-tinta/10 bg-transparent px-2 py-1 text-xs text-body">
                    <option value="no">no repetir</option>
                    <option value="semanal">cada {DOW[diaSemana(crear.fecha)].toLowerCase()}, hasta la vigencia</option>
                    <option value="labor">lun a vie, esta semana</option>
                </select>
            </div>
            <div className="flex gap-2">
                <button className="flex-1 rounded-lg bg-cielo px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" onClick={() => props.onPublicar(rep)} disabled={props.enviando}>Publicar</button>
                <button className="rounded-lg border border-tinta/10 px-3 py-2 text-xs font-semibold text-muted" onClick={props.onCancel}>Cancelar</button>
            </div>
        </div>
    );
}

export function PanelBloque({ panel, enviando, onCerrar, onResponder }: {
    panel: PanelState;
    enviando: boolean;
    onCerrar: () => void;
    onResponder: (b: BloqueCalendario, a: "confirmar" | "rechazar") => void;
}) {
    const b = panel.bloque;
    return (
        <div className="absolute right-3 top-3 z-40 w-72 rounded-xl border border-tinta/10 bg-page p-4 shadow-xl">
            {panel.tipo === "responder" ? (
                <>
                    <p className="text-sm font-semibold text-body">Responder</p>
                    <p className="mb-2 font-mono text-xs text-muted">{DOW[diaSemana(b.fecha)]} {numMes(b.fecha)} · {fmt(b.minInicio)}–{fmt(b.minFin)} · {b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</p>
                    <div className="mb-3 rounded-lg bg-tinta/5 p-2.5 text-xs text-muted">
                        <span className="mb-1 block font-semibold text-body">{b.familia}</span>
                        «{b.relato ?? "—"}»
                    </div>
                    <div className="flex gap-2">
                        <button className="flex-1 rounded-lg bg-cielo px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" onClick={() => onResponder(b, "confirmar")} disabled={enviando}>Confirmar</button>
                        <button className="flex-1 rounded-lg border border-tinta/10 px-3 py-2 text-xs font-semibold text-muted disabled:opacity-50" onClick={() => onResponder(b, "rechazar")} disabled={enviando}>No puedo</button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-sm font-semibold text-body">Cita confirmada</p>
                    <p className="mb-2 font-mono text-xs text-muted">{DOW[diaSemana(b.fecha)]} {numMes(b.fecha)} · {fmt(b.minInicio)}–{fmt(b.minFin)}</p>
                    <div className="space-y-1 text-xs text-body">
                        <div><span className="font-mono text-[10px] uppercase text-subtle">Con</span> {b.familia}</div>
                        <div><span className="font-mono text-[10px] uppercase text-subtle">Modo</span> {b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</div>
                        {b.contactoEmail && <div><span className="font-mono text-[10px] uppercase text-subtle">Contacto</span> {b.contactoEmail}</div>}
                    </div>
                    <p className="mt-3 text-[11px] text-subtle">El cierre de la cita todavía no está disponible.</p>
                    <button className="mt-3 w-full rounded-lg border border-tinta/10 px-3 py-2 text-xs font-semibold text-muted" onClick={onCerrar}>Cerrar</button>
                </>
            )}
        </div>
    );
}
