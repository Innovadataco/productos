"use client";

/**
 * SPEC-714 · El calendario del profesional, nivel dios (mockup aprobado por Jelkin).
 *
 * UN SOLO componente para «Calendario» (publicar) y «Citaciones» (responder):
 * la rejilla se PINTA (semana/día), la hora se arrastra para crear, se repite y
 * se copia; lo reservado se ve pero no se borra por accidente. Los estados de la
 * cita viven DENTRO de la cuadrícula (SPEC-712): libre · validando · esperando ·
 * confirmada. Las dos reglas del servidor están a la vista: el muro de vigencia
 * (SPEC-449) y la modalidad que atiende (SPEC-447).
 *
 * Voz «usted» en toda la superficie (SPEC-550/719). Colores por token del sistema
 * (cielo = disponible, pino = confirmada, ámbar = necesita su respuesta). Las horas
 * se muestran en Bogotá; el servidor ya las proyecta (fecha + minutos).
 *
 * Bloquear día (SPEC-714, modelo `DiaBloqueado` de Datos): el profesional cierra un día
 * (vacaciones) — no se publican franjas ahí y el día va rayado; las citas ya confirmadas se
 * conservan (bloquear solo inserta la fila, imposibilidad estructural). El detalle de la
 * confirmada NO muestra código de cierre (no existe el flujo, L6) ni dirección/enlace
 * (SPEC-708): muestra el contacto que sí existe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { instanteDesdeHoraBogota } from "@/lib/fechas/formato-bogota";
import type { BloqueCalendario, CalendarioProfesionalDto } from "@/lib/profesional/calendario/calendario.service";
import { DOW, H0, H1, PXH, SNAP, addDias, diaSemana, fmt, lunesDe, nombreMes, numMes, snap, type Modalidad, type Repeticion } from "@/components/modules/calendario/fechas";
import { BellIcon, RejillaCalendario } from "@/components/modules/calendario/Rejilla";
import { BloqueFranja, OverlayDiaProfesional } from "./calendario/Rejilla";
import { PanelBloque, PopoverCrear, type CrearState, type PanelState } from "./calendario/Paneles";

/**
 * Bogotá (fecha + minutos del día) → instante UTC ISO. La zona horaria vive en
 * UN solo lugar: `instanteDesdeHoraBogota` (@/lib/fechas/formato-bogota). Nunca
 * un offset a mano en la pantalla (I-247 · D-69).
 */
function instanteISO(fecha: string, minutos: number): string {
    const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
    const mm = String(minutos % 60).padStart(2, "0");
    return instanteDesdeHoraBogota(fecha, `${hh}:${mm}`).toISOString();
}

async function mensajeError(res: Response, respaldo: string): Promise<string> {
    const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return cuerpo?.error?.message ?? respaldo;
}

interface Props {
    datos: CalendarioProfesionalDto;
    /** «calendario» lidera con publicar; «citaciones» antepone «Esperando su respuesta». */
    modo?: "calendario" | "citaciones";
}

export function CalendarioProfesional({ datos, modo = "calendario" }: Props) {
    const router = useRouter();
    const [vista, setVista] = useState<"semana" | "dia">("semana");
    const [ancla, setAncla] = useState(datos.hoy); // fecha dentro de la semana/día visible
    const [selModo, setSelModo] = useState(false);
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [crear, setCrear] = useState<CrearState | null>(null);
    const [panel, setPanel] = useState<PanelState | null>(null);
    const [buzon, setBuzon] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const avisoTimer = useRef<number | undefined>(undefined);

    const modalidadFija: Modalidad = datos.atiendeVirtual ? "VIRTUAL" : "PRESENCIAL";
    const muro = datos.muro;
    const diasBloqueados = useMemo(() => new Set(datos.diasBloqueados), [datos.diasBloqueados]);

    // En un teléfono la vista principal es el día (la semana es ilegible).
    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 768) setVista("dia");
    }, []);

    const toast = useCallback((txt: string) => {
        setAviso(txt);
        if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
        avisoTimer.current = window.setTimeout(() => setAviso(null), 4500);
    }, []);

    const diasVisibles = useMemo(() => {
        if (vista === "dia") return [ancla];
        const lun = lunesDe(ancla);
        return Array.from({ length: 7 }, (_, i) => addDias(lun, i));
    }, [vista, ancla]);

    const bloquesPorDia = useMemo(() => {
        const m = new Map<string, BloqueCalendario[]>();
        for (const b of datos.bloques) {
            if (!diasVisibles.includes(b.fecha)) continue;
            const arr = m.get(b.fecha) ?? [];
            arr.push(b);
            m.set(b.fecha, arr);
        }
        return m;
    }, [datos.bloques, diasVisibles]);

    const esperando = useMemo(() => datos.bloques.filter((b) => b.estado === "esperando"), [datos.bloques]);

    /** ¿el fin (fecha+min Bogotá) cae después del muro de vigencia? Comparación pura. */
    const pasaVigencia = useCallback(
        (fecha: string, minFin: number): boolean => {
            if (!muro) return false;
            return fecha > muro.fecha || (fecha === muro.fecha && minFin > muro.minuto);
        },
        [muro],
    );
    const solapa = useCallback(
        (fecha: string, a: number, b: number): boolean =>
            (bloquesPorDia.get(fecha) ?? []).some((f) => a < f.minFin && b > f.minInicio),
        [bloquesPorDia],
    );

    const rango = useMemo(() => {
        if (vista === "dia") return `${DOW[diaSemana(ancla)]} ${numMes(ancla)} de ${nombreMes(ancla)}`;
        const lun = lunesDe(ancla);
        const dom = addDias(lun, 6);
        return `${numMes(lun)} ${nombreMes(lun)} – ${numMes(dom)} ${nombreMes(dom)}`;
    }, [vista, ancla]);

    /* ─────────── acciones de red ─────────── */
    function diasParaRepetir(fecha: string, minFin: number, rep: Repeticion): string[] {
        if (rep === "no") return [fecha];
        if (rep === "labor") {
            const lun = lunesDe(fecha);
            return Array.from({ length: 5 }, (_, i) => addDias(lun, i)); // lun-vie de esa semana
        }
        const salida: string[] = []; // «semanal»: cada {mismo día} hasta la vigencia (cap 60)
        let d = fecha;
        for (let i = 0; i < 60; i++) {
            if (pasaVigencia(d, minFin)) break;
            salida.push(d);
            d = addDias(d, 7);
        }
        return salida.length ? salida : [fecha];
    }

    async function publicarLote(franjas: { inicio: string; fin: string; modalidad: Modalidad }[], exito: (creadas: number, omitidas: number) => string) {
        const res = await fetch("/api/profesional/franjas/lote", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ franjas }),
        });
        if (!res.ok) {
            toast(await mensajeError(res, "No se pudieron publicar las horas."));
            return;
        }
        const { data } = (await res.json()) as { data: { creadas: number; omitidas: unknown[] } };
        toast(exito(data.creadas, data.omitidas.length));
        router.refresh();
    }

    async function publicar(fecha: string, minInicio: number, minFin: number, modalidad: Modalidad, rep: Repeticion) {
        const dias = diasParaRepetir(fecha, minFin, rep);
        setEnviando(true);
        try {
            if (dias.length === 1) {
                const res = await fetch("/api/profesional/franjas", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ inicio: instanteISO(fecha, minInicio), fin: instanteISO(fecha, minFin), modalidad }),
                });
                if (!res.ok) {
                    toast(await mensajeError(res, "No se pudo publicar la hora."));
                    return;
                }
                toast("Hora publicada. La familia ya la puede reservar.");
                router.refresh();
            } else {
                await publicarLote(
                    dias.map((d) => ({ inicio: instanteISO(d, minInicio), fin: instanteISO(d, minFin), modalidad })),
                    (creadas, omitidas) =>
                        creadas > 0
                            ? `Publicó ${creadas} ${creadas === 1 ? "hora" : "horas"}${omitidas ? ` · ${omitidas} no cupieron (vigencia o cruce)` : ""}.`
                            : "Ninguna cupo (vigencia o cruce con otra que ya publicó).",
                );
            }
            setCrear(null);
        } catch {
            toast("No pudimos comunicarnos con el servidor. Revise su conexión.");
        } finally {
            setEnviando(false);
        }
    }

    async function quitar(ids: string[]) {
        setEnviando(true);
        try {
            const resultados = await Promise.all(
                ids.map((id) => fetch(`/api/profesional/franjas/${id}`, { method: "DELETE", credentials: "include" })),
            );
            const ok = resultados.filter((r) => r.ok).length;
            setSel(new Set());
            toast(ok === ids.length ? `Quitó ${ok} ${ok === 1 ? "hora" : "horas"}.` : "Alguna no se pudo quitar (una reservada no se borra desde acá).");
            router.refresh();
        } finally {
            setEnviando(false);
        }
    }

    async function copiarDia() {
        const libres = (bloquesPorDia.get(ancla) ?? []).filter((b) => b.estado === "libre");
        if (!libres.length) {
            toast("No hay horas libres en ese día para copiar.");
            return;
        }
        const dest = addDias(ancla, 1);
        setEnviando(true);
        try {
            await publicarLote(
                libres.map((b) => ({ inicio: instanteISO(dest, b.minInicio), fin: instanteISO(dest, b.minFin), modalidad: b.modalidad })),
                (creadas) => (creadas ? `Copió ${creadas} ${creadas === 1 ? "hora" : "horas"} a ${DOW[diaSemana(dest)]}.` : "Nada que copiar (o no cupo por la vigencia o un cruce)."),
            );
        } finally {
            setEnviando(false);
        }
    }

    async function bloquearODesbloquear(fecha: string) {
        const bloqueado = diasBloqueados.has(fecha);
        setEnviando(true);
        try {
            const res = await fetch("/api/profesional/dias-bloqueados", {
                method: bloqueado ? "DELETE" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fecha }),
            });
            if (!res.ok) {
                toast(await mensajeError(res, "No se pudo cambiar el estado del día."));
                return;
            }
            toast(
                bloqueado
                    ? `${DOW[diaSemana(fecha)]} ${numMes(fecha)} reabierto. Ya puede publicar horas.`
                    : `${DOW[diaSemana(fecha)]} ${numMes(fecha)} bloqueado. No se ofrecen horas nuevas; sus citas confirmadas se conservan.`,
            );
            router.refresh();
        } finally {
            setEnviando(false);
        }
    }

    async function responder(bloque: BloqueCalendario, accion: "confirmar" | "rechazar") {
        if (!bloque.solicitudId) return;
        setEnviando(true);
        try {
            const res = await fetch(`/api/profesional/solicitudes/${bloque.solicitudId}/${accion}`, { method: "PATCH", credentials: "include" });
            if (!res.ok) {
                toast(await mensajeError(res, "No se pudo responder."));
                return;
            }
            toast(accion === "confirmar" ? `Cita confirmada con ${bloque.familia}.` : `Le avisamos a ${bloque.familia} que no puede atender. La hora vuelve a quedar libre.`);
            setPanel(null);
            router.refresh();
        } finally {
            setEnviando(false);
        }
    }

    /* ─────────── arrastrar para crear ─────────── */
    const dragRef = useRef<{ fecha: string; startMin: number; curMin: number; el: HTMLElement } | null>(null);
    const [ghost, setGhost] = useState<{ fecha: string; a: number; b: number } | null>(null);

    function onPointerDown(ev: React.PointerEvent, fecha: string) {
        if (selModo || (ev.target as HTMLElement).closest("[data-franja]")) return; // no crear sobre un bloque
        if (diasBloqueados.has(fecha)) {
            toast("Este día está bloqueado. Reábralo para publicar horas.");
            return;
        }
        const col = ev.currentTarget as HTMLElement;
        const rect = col.getBoundingClientRect();
        const startMin = snap(((ev.clientY - rect.top) / PXH) * 60 + H0 * 60);
        dragRef.current = { fecha, startMin, curMin: startMin + 60, el: col };
        col.setPointerCapture?.(ev.pointerId);
        setGhost({ fecha, a: startMin, b: startMin + 60 });
    }
    function onPointerMove(ev: React.PointerEvent) {
        const d = dragRef.current;
        if (!d) return;
        const rect = d.el.getBoundingClientRect();
        d.curMin = snap(((ev.clientY - rect.top) / PXH) * 60 + H0 * 60);
        const a = Math.min(d.startMin, d.curMin);
        const b = Math.max(a + SNAP, Math.max(d.startMin, d.curMin));
        setGhost({ fecha: d.fecha, a, b });
    }
    function onPointerUp(ev: React.PointerEvent) {
        const d = dragRef.current;
        dragRef.current = null;
        setGhost(null);
        if (!d) return;
        try {
            d.el.releasePointerCapture?.(ev.pointerId);
        } catch {
            /* ok */
        }
        const a = Math.min(d.startMin, d.curMin);
        let b = Math.max(d.startMin, d.curMin);
        if (b - a < SNAP) b = a + 60;
        if (a < H0 * 60 || b > H1 * 60) return;
        if (pasaVigencia(d.fecha, b)) {
            toast("No puede ofrecer horas después de que venza su verificación. Renuévela para abrir fechas más adelante.");
            return;
        }
        if (solapa(d.fecha, a, b)) {
            toast("Esa hora se cruza con otra que ya publicó.");
            return;
        }
        setBuzon(false);
        setPanel(null);
        setCrear({ fecha: d.fecha, minInicio: a, minFin: b, modalidad: modalidadFija, x: 12, y: Math.max(8, (a / 60 - H0) * PXH) });
    }

    function onBloque(b: BloqueCalendario) {
        setCrear(null);
        setBuzon(false);
        if (b.estado === "esperando") return setPanel({ tipo: "responder", bloque: b });
        if (b.estado === "confirmada") return setPanel({ tipo: "detalle", bloque: b });
        if (b.estado === "validando") return toast("Reservada, validando el pago. Cuando se apruebe, aquí podrá responder. Por ahora no tiene que hacer nada.");
        if (b.estado === "reservada") return toast("Esta hora está reservada. No se puede borrar desde acá; se gestiona en Citaciones.");
        if (selModo) {
            setSel((s) => {
                const n = new Set(s);
                if (n.has(b.id)) n.delete(b.id);
                else n.add(b.id);
                return n;
            });
        }
    }

    const anchoDia = vista === "dia" ? "1fr" : "repeat(7, minmax(84px, 1fr))";
    const altura = (H1 - H0) * PXH;

    return (
        <div className="mx-auto max-w-6xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-body">{modo === "citaciones" ? "Citaciones" : "Calendario"}</h1>
                <span className="font-mono text-xs text-muted">{rango}</span>
                <div className="ml-auto flex items-center gap-2">
                    <button aria-label="Ir al período anterior" className="rounded-lg border border-tinta/10 px-2 py-1 text-muted hover:text-body" onClick={() => setAncla(addDias(ancla, vista === "dia" ? -1 : -7))}>‹</button>
                    <button className="rounded-lg border border-tinta/10 px-3 py-1 text-xs font-semibold text-muted hover:text-body" onClick={() => setAncla(datos.hoy)}>Hoy</button>
                    <button aria-label="Ir al período siguiente" className="rounded-lg border border-tinta/10 px-2 py-1 text-muted hover:text-body" onClick={() => setAncla(addDias(ancla, vista === "dia" ? 1 : 7))}>›</button>
                    <div className="inline-flex rounded-lg bg-tinta/5 p-0.5">
                        <button aria-pressed={vista === "dia"} className={`rounded-md px-3 py-1 text-xs font-semibold ${vista === "dia" ? "bg-page text-body shadow-sm" : "text-muted"}`} onClick={() => setVista("dia")}>Día</button>
                        <button aria-pressed={vista === "semana"} className={`rounded-md px-3 py-1 text-xs font-semibold ${vista === "semana" ? "bg-page text-body shadow-sm" : "text-muted"}`} onClick={() => setVista("semana")}>Semana</button>
                    </div>
                    <button aria-label="Citas esperando su respuesta" className="relative rounded-lg border border-tinta/10 p-2 text-muted hover:text-body" onClick={() => { setBuzon((v) => !v); setCrear(null); setPanel(null); }}>
                        <BellIcon />
                        {esperando.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-estado-ambar px-1 text-[10px] font-bold text-white">{esperando.length}</span>}
                    </button>
                </div>
            </div>

            {modo === "citaciones" && (
                <div className="mb-3 rounded-xl border border-estado-ambar/30 bg-estado-ambar/5 p-3">
                    <p className="text-sm font-semibold text-body">Esperando su respuesta</p>
                    {esperando.length ? (
                        <ul className="mt-1 space-y-1">
                            {esperando.map((b) => (
                                <li key={b.id}>
                                    <button className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-estado-ambar/10" onClick={() => onBloque(b)}>
                                        <span className="font-medium text-body">{b.familia}</span>
                                        <span className="ml-2 font-mono text-xs text-subtle">{DOW[diaSemana(b.fecha)]} {numMes(b.fecha)} · {fmt(b.minInicio)} · {b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-1 text-xs text-subtle">Nada por responder. Cuando una familia reserve y pague, aparece acá.</p>
                    )}
                </div>
            )}

            <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-cielo/15 px-3 py-1.5 text-xs font-semibold text-cielo-700">Arrastre sobre un espacio vacío para publicar una hora</span>
                <button className="rounded-lg border border-tinta/10 px-3 py-1.5 text-xs font-semibold text-muted hover:text-body" onClick={copiarDia} disabled={enviando}>Copiar día</button>
                <button className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${diasBloqueados.has(ancla) ? "border-estado-ambar/40 bg-estado-ambar/10 text-estado-ambar" : "border-tinta/10 text-muted hover:text-body"}`} onClick={() => bloquearODesbloquear(ancla)} disabled={enviando}>
                    {diasBloqueados.has(ancla) ? `Reabrir ${DOW[diaSemana(ancla)]} ${numMes(ancla)}` : `Bloquear ${DOW[diaSemana(ancla)]} ${numMes(ancla)}`}
                </button>
                <button aria-pressed={selModo} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${selModo ? "border-cielo/40 bg-cielo/15 text-cielo-700" : "border-tinta/10 text-muted hover:text-body"}`} onClick={() => { setSelModo((v) => !v); setSel(new Set()); }}>Seleccionar</button>
                {sel.size > 0 && (
                    <span className="text-xs font-semibold text-cielo-700">{sel.size} elegidas · <button className="underline" onClick={() => quitar([...sel])} disabled={enviando}>quitar</button></span>
                )}
            </div>

            {vista === "dia" && (
                <div className="mb-2 flex gap-1 overflow-x-auto">
                    {Array.from({ length: 7 }, (_, i) => addDias(lunesDe(ancla), i)).map((d) => (
                        <button key={d} aria-pressed={d === ancla} className={`flex-none rounded-xl px-3 py-1.5 text-center ${d === ancla ? "bg-cielo text-white" : "text-muted hover:bg-tinta/5"}`} onClick={() => setAncla(d)}>
                            <div className="font-mono text-[10px] uppercase">{DOW[diaSemana(d)]}</div>
                            <div className="text-sm font-semibold">{numMes(d)}</div>
                        </button>
                    ))}
                </div>
            )}

            <RejillaCalendario
                diasVisibles={diasVisibles}
                hoy={datos.hoy}
                anchoDia={anchoDia}
                bloquesPorDia={bloquesPorDia}
                ghost={ghost}
                diaHeaderTono={(d) => (diasBloqueados.has(d) ? "text-estado-ambar" : undefined)}
                overlayDia={(fecha) => <OverlayDiaProfesional fecha={fecha} muro={muro} bloqueado={diasBloqueados.has(fecha)} altura={altura} />}
                onDiaHeaderClick={(d) => { setVista("dia"); setAncla(d); }}
                onColumnaPointerDown={onPointerDown}
                onColumnaPointerMove={onPointerMove}
                onColumnaPointerUp={onPointerUp}
                renderBloque={(b) => (
                    <BloqueFranja key={b.id} b={b} sel={sel.has(b.id)} selModo={selModo} onClick={() => onBloque(b)} onQuitar={() => quitar([b.id])} />
                )}
            >
                {crear && (
                    <PopoverCrear
                        crear={crear}
                        atiendeVirtual={datos.atiendeVirtual}
                        atiendePresencial={datos.atiendePresencial}
                        enviando={enviando}
                        onModalidad={(m) => setCrear({ ...crear, modalidad: m })}
                        onCancel={() => setCrear(null)}
                        onPublicar={(rep) => publicar(crear.fecha, crear.minInicio, crear.minFin, crear.modalidad, rep)}
                    />
                )}

                {buzon && (
                    <div className="absolute right-3 top-3 z-30 w-72 rounded-xl border border-tinta/10 bg-page p-2 shadow-xl">
                        <p className="px-2 py-1 text-sm font-semibold text-body">Esperando su respuesta</p>
                        {esperando.length ? (
                            esperando.map((b) => (
                                <button key={b.id} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-estado-ambar/10" onClick={() => onBloque(b)}>
                                    <span className="block text-sm font-medium text-body">{b.familia}</span>
                                    <span className="block font-mono text-[11px] text-subtle">{DOW[diaSemana(b.fecha)]} {numMes(b.fecha)} · {fmt(b.minInicio)} · {b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</span>
                                </button>
                            ))
                        ) : (
                            <p className="px-2 py-2 text-xs text-subtle">Nada por responder. Cuando una familia reserve y pague, aparece acá.</p>
                        )}
                    </div>
                )}

                {panel && <PanelBloque panel={panel} enviando={enviando} onCerrar={() => setPanel(null)} onResponder={responder} />}
            </RejillaCalendario>

            {aviso && <p role="status" className="mt-3 rounded-lg bg-tinta/90 px-4 py-2 text-sm text-page">{aviso}</p>}
        </div>
    );
}
