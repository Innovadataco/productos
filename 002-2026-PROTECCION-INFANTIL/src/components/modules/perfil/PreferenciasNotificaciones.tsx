"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Bell, Lock } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";

type Canal = "EMAIL" | "IN_APP";

type ReglaPreferencia = {
    evento: string;
    canal: Canal;
    eventoRegla: string;
    obligatoria: boolean;
    habilitado: boolean;
};

type GrupoPreferencia = {
    evento: string;
    canales: ReglaPreferencia[];
};

interface Props {
    /** SPEC-326 §3.1: para el padre se muestra la vista en frases (sin claves técnicas). */
    rol?: string;
    correo?: string;
}

const LABEL_CANAL: Record<Canal, string> = {
    EMAIL: "Email",
    IN_APP: "In-app",
};

// SPEC-326 §3.1 (diseño CEO-aprobado 2026-08-30): las 2 notificaciones que el padre
// controla, en frases. Mapeadas a eventos REALES del motor (verificado en seed.ts).
// El evento 2 (identificador de hijos) y el 5 (resumen semanal) NO existen → no aparecen.
const TOGGLES_PADRE: Array<{ evento: string; titulo: string; detalle: string }> = [
    {
        evento: "padre.circulo_confianza.reporte_enriquecido",
        titulo: "Cuando alguien reporte a una persona de mi círculo",
        detalle: "Te avisamos apenas aparezca un reporte sobre alguien que estás vigilando.",
    },
    {
        evento: "reporte.resuelto",
        titulo: "Cuando se resuelva un reporte que hice",
        detalle: "Te contamos cuando tu reporte quede resuelto.",
    },
];

// Avisos que siempre llegan (plan + seguridad): se muestran para que el padre sepa
// que existen, sin interruptor. `suscripcion.por_vencer` es obligatoria en el motor.
const FORZADOS_PADRE: Array<{ titulo: string; detalle: string }> = [
    { titulo: "Cuando tu plan esté por vencer", detalle: "Unos días antes, para que no te quedes sin cobertura." },
    { titulo: "Cuando cambie tu contraseña o pidas recuperarla", detalle: "Avisos de seguridad de tu cuenta." },
];

function formatearEvento(evento: string): string {
    return evento
        .split(".")
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(" › ");
}

export function PreferenciasNotificaciones({ rol, correo }: Props = {}) {
    const [grupos, setGrupos] = useState<GrupoPreferencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState<Set<string>>(new Set());

    const esPadre = rol === "PARENT";
    // SPEC-506 (decisión de Jelkin · barrido de voz §D): la voz del CUERPO va por
    // AUDIENCIA, igual que el título por rol (TEMA_POR_ROL en la page). §1.9:
    // padre = «tú» (sin voseo) · colegio/profesional/admin/interno = «usted».
    const voz = esPadre
        ? {
            errorTitulo: "No pudimos cargar tus preferencias",
            sinConfig: "No hay notificaciones configurables para tu rol.",
        }
        : {
            errorTitulo: "No pudimos cargar sus preferencias",
            sinConfig: "No hay notificaciones configurables para su rol.",
        };

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/notificaciones/preferencias");
            if (!res.ok) throw new Error("Error al cargar preferencias");
            const json = (await res.json()) as { preferencias: GrupoPreferencia[] };
            setGrupos(json.preferencias ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setLoading(false);
        }
    }

    async function patch(eventoRegla: string, habilitado: boolean) {
        const res = await fetch("/api/notificaciones", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventoRegla, habilitado }),
        });
        if (!res.ok) {
            const json = (await res.json()) as { error?: string };
            throw new Error(
                json.error === "regla_obligatoria"
                    ? "Este aviso es obligatorio y no se puede desactivar."
                    : "Error al guardar"
            );
        }
    }

    async function cambiar(regla: ReglaPreferencia, habilitado: boolean) {
        if (regla.obligatoria) return;
        setGuardando((prev) => new Set(prev).add(regla.eventoRegla));
        try {
            await patch(regla.eventoRegla, habilitado);
            setGrupos((prev) =>
                prev.map((g) => ({
                    ...g,
                    canales: g.canales.map((c) =>
                        c.eventoRegla === regla.eventoRegla ? { ...c, habilitado } : c
                    ),
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setGuardando((prev) => {
                const next = new Set(prev);
                next.delete(regla.eventoRegla);
                return next;
            });
        }
    }

    // SPEC-326 §3.1: un toggle de frase controla todos sus canales (EMAIL/IN_APP) juntos.
    async function cambiarFrase(grupo: GrupoPreferencia, habilitado: boolean) {
        const conmutables = grupo.canales.filter((c) => !c.obligatoria);
        conmutables.forEach((c) => setGuardando((prev) => new Set(prev).add(c.eventoRegla)));
        try {
            await Promise.all(conmutables.map((c) => patch(c.eventoRegla, habilitado)));
            setGrupos((prev) =>
                prev.map((g) =>
                    g.evento === grupo.evento
                        ? { ...g, canales: g.canales.map((c) => (c.obligatoria ? c : { ...c, habilitado })) }
                        : g
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setGuardando((prev) => {
                const next = new Set(prev);
                conmutables.forEach((c) => next.delete(c.eventoRegla));
                return next;
            });
        }
    }

    useEffect(() => {
        void cargar();
    }, []);

    if (loading) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <Cargando texto="Cargando preferencias…" />
            </div>
        );
    }

    if (error && grupos.length === 0) {
        return <ErrorState title={voz.errorTitulo} description={error} onRetry={() => void cargar()} />;
    }

    // ── SPEC-326 §3.1: vista en frases para el padre ──────────────────────────
    if (esPadre) {
        const frases = TOGGLES_PADRE.map((t) => ({
            ...t,
            grupo: grupos.find((g) => g.evento === t.evento),
        })).filter((f) => f.grupo); // solo frases con evento real (FR-005)

        return (
            <div className="space-y-6">
                {error && (
                    <p className="rounded-xl bg-rubi/10 px-4 py-3 text-sm text-rubi-ink" role="alert">
                        {error}
                    </p>
                )}

                {/* Encabezado: a dónde escribimos */}
                <section className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
                        <p className="text-sm text-body">
                            Te escribimos a <span className="font-semibold">{correo ?? "tu correo"}</span>
                        </p>
                    </div>
                    <Link href="/dashboard/padre/perfil" className="text-sm font-semibold text-cielo-600 hover:underline">
                        Cambiar
                    </Link>
                </section>

                {/* Toggles reales */}
                <section className="glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-body">¿Qué quieres que te avisemos?</h3>
                    <div className="mt-4 space-y-4">
                        {frases.map((f) => {
                            const grupo = f.grupo!;
                            const encendido = grupo.canales.filter((c) => !c.obligatoria).every((c) => c.habilitado);
                            const guardandoFrase = grupo.canales.some((c) => guardando.has(c.eventoRegla));
                            return (
                                <div key={f.evento} className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-body">{f.titulo}</p>
                                        <p className="mt-0.5 text-sm text-muted">{f.detalle}</p>
                                    </div>
                                    {guardandoFrase ? (
                                        <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted" aria-hidden="true" />
                                    ) : (
                                        <Switch
                                            checked={encendido}
                                            onChange={(v) => void cambiarFrase(grupo, v)}
                                            ariaLabel={f.titulo}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Bloque forzado: siempre llegan */}
                <section className="rounded-2xl border border-tinta/10 p-5">
                    <p className="text-sm text-muted">
                        Algunos avisos son de seguridad o de tu plan y <span className="font-medium">siempre te llegan</span>:
                    </p>
                    <ul className="mt-3 space-y-2">
                        {FORZADOS_PADRE.map((f) => (
                            <li key={f.titulo} className="flex items-start gap-2 text-sm text-muted">
                                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>
                                    <span className="text-body">{f.titulo}.</span> {f.detalle}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        );
    }

    // ── Resto de roles: vista existente (sin cambio) ──────────────────────────
    if (grupos.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center text-muted">
                {voz.sinConfig}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <p className="rounded-xl bg-rubi/10 px-4 py-3 text-sm text-rubi-ink" role="alert">
                    {error}
                </p>
            )}
            {grupos.map((grupo) => (
                <section key={grupo.evento} className="glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-body">{formatearEvento(grupo.evento)}</h3>
                    <div className="mt-4 space-y-3">
                        {grupo.canales.map((regla) => {
                            const Icon = regla.canal === "EMAIL" ? Mail : Bell;
                            return (
                                <div key={regla.eventoRegla}>
                                    <div className="flex items-center gap-3">
                                        <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
                                        <span className="text-sm text-body">{LABEL_CANAL[regla.canal]}</span>
                                        {regla.obligatoria ? (
                                            <Tooltip content="Transaccional — no se puede apagar (necesario para el servicio)">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-tinta/5 px-2 py-1 text-xs text-muted">
                                                    <Lock className="h-3 w-3" aria-hidden="true" />
                                                    Obligatoria
                                                </span>
                                            </Tooltip>
                                        ) : null}
                                        {guardando.has(regla.eventoRegla) ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
                                        ) : (
                                            <Switch
                                                checked={regla.habilitado}
                                                onChange={(v) => void cambiar(regla, v)}
                                                disabled={regla.obligatoria}
                                                ariaLabel={`${LABEL_CANAL[regla.canal]} para ${grupo.evento}`}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
