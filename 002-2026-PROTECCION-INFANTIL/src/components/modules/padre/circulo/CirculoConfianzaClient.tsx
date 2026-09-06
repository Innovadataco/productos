"use client";

/**
 * A-73 (SPEC-367) · Tu círculo de confianza.
 *
 * Rediseño de G12 sobre el mockup aprobado por Jelkin. Las tres decisiones que
 * mandan:
 *  1. Nombre doble: la miga dice "A quién vigilo" (el menú) y el título "Tu
 *     círculo de confianza".
 *  2. Se avisa de una vez: un reporte en revisión ya se muestra (no se espera a
 *     que esté procesado).
 *  3. Las estadísticas viven DENTRO de cada persona ("Ver de qué se trata"); la
 *     pantalla principal queda simple, sin mapas ni donas sueltas.
 *
 * Reusa la API que ya existe (candado 15v5): lista, alta, PATCH de contacto y de
 * identificadores (lista COMPLETA), baja lógica, detalle con agregado y
 * preferencia de aviso. Voz tú · nunca rojo · sin jerga.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BloqueAtencion } from "./BloqueAtencion";
import { DetallePersona } from "./DetallePersona";
import { EstadoVacio } from "./EstadoVacio";
import { IlustracionCirculo } from "./IlustracionCirculo";
import { PanelAgregar, type DatoNuevo } from "./PanelAgregar";
import { QueRecibes } from "./QueRecibes";
import { TarjetaPersona } from "./TarjetaPersona";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
    nombreVisible,
    tonoDeContacto,
    type Contacto,
    type DetalleContacto,
    type IdentificadorDetalle,
    type IdentificadorPayload,
    type Plataforma,
} from "./tipos";

type Panel =
    | { tipo: "cerrado" }
    | { tipo: "persona" }
    | { tipo: "dato"; contacto: Contacto }
    // SPEC-539: editar los datos de una persona vigilada (nombre / parentesco).
    | { tipo: "editar"; contacto: Contacto };

export function CirculoConfianzaClient() {
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [tope, setTope] = useState(20);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [avisoCorreo, setAvisoCorreo] = useState(true);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [errorPanel, setErrorPanel] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [panel, setPanel] = useState<Panel>({ tipo: "cerrado" });
    // SPEC-539: formulario de edición de nombre/parentesco de un contacto.
    const [edicion, setEdicion] = useState({ nombre: "", parentesco: "" });
    const [detalle, setDetalle] = useState<DetalleContacto | null>(null);
    // SPEC-540: la confirmación de «Quitar» es un modal del estándar, no window.confirm.
    const [confirmarQuitar, setConfirmarQuitar] = useState<Contacto | null>(null);

    const cargar = useCallback(async () => {
        try {
            const [resLista, resPref, resPlat] = await Promise.all([
                fetch("/api/circulo-confianza"),
                fetch("/api/circulo-confianza/preferencias"),
                fetch("/api/plataformas"),
            ]);
            if (!resLista.ok) throw new Error("No pudimos cargar tu círculo");
            const lista = await resLista.json();
            setContactos(lista.contactos ?? []);
            if (typeof lista.tope === "number") setTope(lista.tope);
            if (resPref.ok) {
                const pref = await resPref.json();
                setAvisoCorreo(pref.notificacionesCirculo !== false);
            }
            if (resPlat.ok) {
                const plat = await resPlat.json();
                setPlataformas(Array.isArray(plat) ? plat : (plat.plataformas ?? []));
            }
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos cargar tu círculo");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const activos = useMemo(() => contactos.filter((c) => c.activo), [contactos]);
    const tranquilas = activos.filter((c) => tonoDeContacto(c) === "verde").length;
    const enAtencion = useMemo(() => activos.filter((c) => tonoDeContacto(c) === "ambar"), [activos]);
    const enPausa = contactos.length - activos.length;

    /** El PATCH de identificadores es de LISTA COMPLETA (SPEC-325). */
    function comoLista(items: { id: string; valor: string; tipo: string | null; plataforma: Plataforma | null; activo: boolean }[]): IdentificadorPayload[] {
        return items.map((i) => ({
            id: i.id,
            valor: i.valor,
            ...(i.tipo ? { tipo: i.tipo } : {}),
            ...(i.plataforma ? { plataformaId: i.plataforma.id } : {}),
            activo: i.activo,
        }));
    }

    async function patchContacto(id: string, cuerpo: unknown, mensajeError: string) {
        setGuardando(true);
        setError("");
        try {
            const res = await fetch(`/api/circulo-confianza/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cuerpo),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || mensajeError);
            }
            await cargar();
            if (detalle?.id === id) await verDetalle({ id });
        } catch (e) {
            setError(e instanceof Error ? e.message : mensajeError);
        } finally {
            setGuardando(false);
        }
    }

    async function verDetalle(contacto: { id: string }) {
        try {
            const res = await fetch(`/api/circulo-confianza/${contacto.id}`);
            if (!res.ok) throw new Error("No pudimos abrir esta persona");
            setDetalle(await res.json());
            setPanel({ tipo: "cerrado" });
        } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos abrir esta persona");
        }
    }

    async function crearPersona({ nombre, parentesco, datos }: { nombre: string; parentesco: string; datos: DatoNuevo[] }) {
        setGuardando(true);
        setErrorPanel("");
        try {
            const res = await fetch("/api/circulo-confianza", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre,
                    ...(parentesco ? { parentesco } : {}),
                    identificadores: datos.map((d) => ({
                        valor: d.valor,
                        ...(d.plataformaId ? { plataformaId: d.plataformaId } : {}),
                    })),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || "No pudimos agregar a esta persona");
            }
            setPanel({ tipo: "cerrado" });
            await cargar();
        } catch (e) {
            setErrorPanel(e instanceof Error ? e.message : "No pudimos agregar a esta persona");
        } finally {
            setGuardando(false);
        }
    }

    async function agregarDato(contacto: Contacto, datos: DatoNuevo[]) {
        setErrorPanel("");
        // Se manda la lista completa: los que ya están (con su `activo`) + los nuevos.
        const res = await fetch(`/api/circulo-confianza/${contacto.id}`);
        const actual: DetalleContacto | null = res.ok ? await res.json() : null;
        const existentes = actual ? comoLista(actual.identificadores) : comoLista(contacto.identificadores);
        const nuevos: IdentificadorPayload[] = datos.map((d) => ({
            valor: d.valor,
            ...(d.plataformaId ? { plataformaId: d.plataformaId } : {}),
            activo: true,
        }));
        setPanel({ tipo: "cerrado" });
        await patchContacto(contacto.id, { identificadores: [...existentes, ...nuevos] }, "No pudimos guardar el dato");
    }

    async function cambiarDato(identificador: IdentificadorDetalle, activo: boolean) {
        if (!detalle) return;
        const lista = comoLista(detalle.identificadores).map((i) =>
            i.id === identificador.id ? { ...i, activo } : i
        );
        await patchContacto(detalle.id, { identificadores: lista }, "No pudimos cambiar ese dato");
    }

    // SPEC-539: abrir el formulario de edición pre-cargado con lo que ya hay.
    function abrirEditar(contacto: Contacto) {
        setErrorPanel("");
        setDetalle(null);
        setEdicion({ nombre: contacto.nombre ?? contacto.etiqueta ?? "", parentesco: contacto.parentesco ?? "" });
        setPanel({ tipo: "editar", contacto });
    }

    // SPEC-539: guardar el cambio de nombre/parentesco contra el PATCH que ya existe.
    async function guardarEdicion(e: React.FormEvent) {
        e.preventDefault();
        if (panel.tipo !== "editar") return;
        const id = panel.contacto.id;
        setGuardando(true);
        setErrorPanel("");
        try {
            const res = await fetch(`/api/circulo-confianza/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: edicion.nombre.trim(), parentesco: edicion.parentesco.trim() || null }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || "No pudimos guardar los cambios");
            }
            setPanel({ tipo: "cerrado" });
            await cargar();
        } catch (err) {
            setErrorPanel(err instanceof Error ? err.message : "No pudimos guardar los cambios");
        } finally {
            setGuardando(false);
        }
    }

    // SPEC-540: «Quitar» confirma en un modal del estándar (no window.confirm).
    function quitarPersona(contacto: Contacto) {
        setConfirmarQuitar(contacto);
    }

    async function ejecutarQuitar() {
        const contacto = confirmarQuitar;
        if (!contacto) return;
        setGuardando(true);
        setError("");
        try {
            const res = await fetch(`/api/circulo-confianza/${contacto.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("No pudimos quitar a esta persona");
            if (detalle?.id === contacto.id) setDetalle(null);
            setConfirmarQuitar(null);
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "No pudimos quitar a esta persona");
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarAviso() {
        const siguiente = !avisoCorreo;
        setAvisoCorreo(siguiente);
        try {
            const res = await fetch("/api/circulo-confianza/preferencias", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificacionesCirculo: siguiente }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setAvisoCorreo(!siguiente);
            setError("No pudimos guardar tu preferencia de aviso");
        }
    }

    function abrirAgregar() {
        setErrorPanel("");
        setDetalle(null);
        setPanel({ tipo: "persona" });
    }

    const sinCupo = activos.length >= tope;

    return (
        <div className="mx-auto w-full max-w-[960px] px-4 pb-16 pt-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-pino" />A quién vigilo
            </p>

            <header className="mt-3 grid items-center gap-6 md:grid-cols-[1fr_340px]">
                <div>
                    <h1 className="text-3xl font-semibold leading-tight text-body md:text-4xl">
                        Tu círculo <span className="text-pino">de confianza</span>
                    </h1>
                    <p className="mt-3 max-w-[44ch] text-base text-muted">
                        Las personas cercanas a tus hijos: el tío, la niñera, el entrenador. Si alguien las reporta, te
                        avisamos a ti.
                    </p>
                </div>
                <IlustracionCirculo contactos={activos} />
            </header>

            {error && (
                <p role="alert" className="mt-4 rounded-xl bg-ambar/10 px-4 py-3 text-sm text-ambar">
                    {error}
                </p>
            )}

            {cargando ? (
                <p className="mt-8 text-muted">Cargando tu círculo…</p>
            ) : contactos.length === 0 && panel.tipo === "cerrado" ? (
                <EstadoVacio onAgregar={abrirAgregar} />
            ) : (
                <>
                    {(panel.tipo === "persona" || panel.tipo === "dato") && (
                        <div className="mt-6">
                            <PanelAgregar
                                modo={panel.tipo === "persona" ? "persona" : "dato"}
                                plataformas={plataformas}
                                {...(panel.tipo === "dato" ? { contacto: panel.contacto } : {})}
                                guardando={guardando}
                                error={errorPanel}
                                onCancelar={() => setPanel({ tipo: "cerrado" })}
                                onGuardarPersona={crearPersona}
                                onGuardarDato={agregarDato}
                            />
                        </div>
                    )}

                    {panel.tipo === "editar" && (
                        <form onSubmit={guardarEdicion} className="glass mt-6 space-y-3 rounded-2xl p-5" data-testid="editar-contacto">
                            <h3 className="text-base font-semibold text-body">Editar a {edicion.nombre || "esta persona"}</h3>
                            {errorPanel && <p className="text-sm text-estado-rubi" role="alert">{errorPanel}</p>}
                            <Input label="Nombre" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
                            <Input label="Qué es de tus hijos" value={edicion.parentesco} onChange={(e) => setEdicion({ ...edicion, parentesco: e.target.value })} />
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setPanel({ tipo: "cerrado" })} disabled={guardando}>
                                    Cancelar
                                </Button>
                                <Button type="submit" isLoading={guardando} disabled={guardando}>
                                    Guardar cambios
                                </Button>
                            </div>
                        </form>
                    )}

                    {detalle && (
                        <div className="mt-6">
                            <DetallePersona
                                detalle={detalle}
                                guardando={guardando}
                                onCerrar={() => setDetalle(null)}
                                onCambiarDato={cambiarDato}
                            />
                        </div>
                    )}

                    {contactos.length > 0 && (
                        <>
                            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-tinta/10 bg-white px-4 py-3 text-sm text-muted dark:bg-tinta/20">
                                <span>
                                    <b className="font-semibold text-body">
                                        {activos.length} {activos.length === 1 ? "persona" : "personas"}
                                    </b>{" "}
                                    en tu círculo
                                </span>
                                {tranquilas > 0 && (
                                    <span className="inline-flex items-center gap-2">
                                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-pino" />
                                        {tranquilas} {tranquilas === 1 ? "tranquila" : "tranquilas"}
                                    </span>
                                )}
                                {enAtencion.length > 0 && (
                                    <span className="inline-flex items-center gap-2">
                                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ambar" />
                                        {enAtencion.length} con {enAtencion.length === 1 ? "un reporte" : "reportes"}
                                    </span>
                                )}
                                {enPausa > 0 && (
                                    <span className="inline-flex items-center gap-2">
                                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-tinta/30" />
                                        {enPausa} en pausa
                                    </span>
                                )}
                                <span className="ml-auto text-muted">
                                    <b className="font-semibold text-body">{activos.length}</b> de {tope}
                                </span>
                            </div>

                            {enAtencion.length > 0 && <BloqueAtencion personas={enAtencion} onVer={verDetalle} />}

                            <section className="mt-7">
                                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                                    <h2 className="text-xl font-semibold text-body">Las personas que vigilas</h2>
                                    <div className="flex flex-wrap gap-3 text-xs text-muted">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-pino" />
                                            Tranquila
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ambar" />
                                            Con un reporte
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta/30" />
                                            En pausa
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-3.5 md:grid-cols-2">
                                    {contactos.map((c) => (
                                        <TarjetaPersona
                                            key={c.id}
                                            contacto={c}
                                            ocupado={guardando}
                                            onVerDetalle={verDetalle}
                                            onAgregarDato={(contacto) => {
                                                setErrorPanel("");
                                                setDetalle(null);
                                                setPanel({ tipo: "dato", contacto });
                                            }}
                                            onPausar={(contacto) =>
                                                patchContacto(
                                                    contacto.id,
                                                    { activo: !contacto.activo },
                                                    "No pudimos cambiar el estado"
                                                )
                                            }
                                            onEditar={abrirEditar}
                                            onQuitar={quitarPersona}
                                        />
                                    ))}

                                    {!sinCupo && (
                                        <button
                                            type="button"
                                            onClick={abrirAgregar}
                                            className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-tinta/15 p-4 text-center transition hover:border-pino/50 hover:bg-pino/5"
                                        >
                                            <span className="grid h-10 w-10 place-items-center rounded-full bg-pino/10 text-pino">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                                                    <path d="M12 5v14M5 12h14" />
                                                </svg>
                                            </span>
                                            <span className="font-semibold text-body">Agregar a alguien</span>
                                            <span className="text-sm text-muted">
                                                Un minuto: nombre, qué es de tus hijos y su celular o usuario.
                                            </span>
                                        </button>
                                    )}
                                </div>

                                {sinCupo && (
                                    <p className="mt-3 rounded-xl bg-papel px-4 py-3 text-sm text-muted">
                                        Llegaste al tope de {tope} personas. Para agregar a alguien más, pausa o quita a
                                        una.
                                    </p>
                                )}
                            </section>

                            <QueRecibes avisoCorreo={avisoCorreo} onCambiar={cambiarAviso} />
                        </>
                    )}
                </>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
                {!sinCupo && contactos.length > 0 && (
                    <button
                        type="button"
                        onClick={abrirAgregar}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-pino px-5 font-semibold text-white transition hover:brightness-110"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Agregar a alguien
                    </button>
                )}
                <Link
                    href="/dashboard/padre/hijos"
                    className="inline-flex h-12 items-center rounded-xl border border-tinta/15 bg-white px-5 font-semibold text-body transition hover:bg-papel dark:bg-tinta/20"
                >
                    Ir a &ldquo;A quién protejo&rdquo;
                </Link>
            </div>

            <Modal
                isOpen={confirmarQuitar !== null}
                onClose={() => setConfirmarQuitar(null)}
                title="Quitar del círculo"
            >
                <p className="text-sm text-body">
                    {confirmarQuitar
                        ? `¿Quitar a ${nombreVisible(confirmarQuitar)} de tu círculo? Dejaremos de vigilarla y se borrarán sus datos guardados. Esto no se puede deshacer.`
                        : ""}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setConfirmarQuitar(null)} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button onClick={ejecutarQuitar} isLoading={guardando} disabled={guardando}>
                        Quitar
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
