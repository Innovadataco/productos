"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { PanelVidrio } from "@/components/ui/PanelVidrio";

interface NotificacionItem {
    id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    entidadId: string | null;
    leidaEn: string | null;
    creadoEn: string;
}

export function CentroNotificaciones() {
    const [abierto, setAbierto] = useState(false);
    const [noLeidas, setNoLeidas] = useState(0);
    const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [accionando, setAccionando] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    async function cargarResumen() {
        try {
            const res = await fetch("/api/colegio/notificaciones/resumen");
            if (!res.ok) return;
            const json = await res.json();
            setNoLeidas(json.noLeidas ?? 0);
        } catch {
            // fail-silently: el badge no bloquea la UI
        }
    }

    async function cargarListado() {
        setLoading(true);
        try {
            const res = await fetch("/api/colegio/notificaciones?pageSize=10");
            if (!res.ok) return;
            const json = await res.json();
            setNotificaciones(json.items ?? []);
        } finally {
            setLoading(false);
        }
    }

    async function marcarLeida(id: string) {
        setAccionando(id);
        try {
            const res = await fetch(`/api/colegio/notificaciones/${id}`, { method: "PATCH" });
            if (!res.ok) return;
            setNotificaciones((prev) =>
                prev.map((n) => (n.id === id ? { ...n, leidaEn: new Date().toISOString() } : n))
            );
            setNoLeidas((n) => Math.max(0, n - 1));
        } finally {
            setAccionando(null);
        }
    }

    async function marcarTodasLeidas() {
        setAccionando("todas");
        try {
            const res = await fetch("/api/colegio/notificaciones/marcar-leidas", { method: "PATCH" });
            if (!res.ok) return;
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leidaEn: new Date().toISOString() })));
            setNoLeidas(0);
        } finally {
            setAccionando(null);
        }
    }

    async function archivar(id: string) {
        setAccionando(id);
        try {
            const res = await fetch(`/api/colegio/notificaciones/${id}`, { method: "DELETE" });
            if (!res.ok) return;
            setNotificaciones((prev) => prev.filter((n) => n.id !== id));
            setNoLeidas((n) => Math.max(0, n - 1));
        } finally {
            setAccionando(null);
        }
    }

    useEffect(() => {
        void cargarResumen();
        const interval = setInterval(() => void cargarResumen(), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (abierto) {
            void cargarListado();
        }
    }, [abierto]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setAbierto(false);
            }
        }
        if (abierto) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [abierto]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-body transition hover:bg-tinta/5"
                aria-label={`Notificaciones${noLeidas > 0 ? `, ${noLeidas} no leídas` : ""}`}
                aria-expanded={abierto}
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {noLeidas > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rubi px-1 text-[10px] font-bold text-white">
                        {noLeidas > 99 ? "99+" : noLeidas}
                    </span>
                )}
            </button>

            {abierto && (
                <div className="absolute right-0 top-12 z-50 w-80 sm:w-96">
                    <PanelVidrio className="flex max-h-[70vh] flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-tinta/10 p-4">
                            <span className="font-semibold text-body">Notificaciones</span>
                            {notificaciones.some((n) => !n.leidaEn) && (
                                <button
                                    type="button"
                                    onClick={() => void marcarTodasLeidas()}
                                    disabled={accionando === "todas"}
                                    className="text-xs font-semibold text-accent hover:text-pino disabled:opacity-50"
                                >
                                    {accionando === "todas" ? "Marcando…" : "Marcar todas"}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
                                </div>
                            ) : notificaciones.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted">No hay notificaciones pendientes.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {notificaciones.map((n) => (
                                        <li
                                            key={n.id}
                                            className={`rounded-xl p-3 transition ${
                                                n.leidaEn ? "bg-papel/50" : "bg-pino/[0.06]"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold ${n.leidaEn ? "text-muted" : "text-body"}`}>
                                                        {n.titulo}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted">{n.mensaje}</p>
                                                    <p className="mt-1 text-[10px] text-subtle">
                                                        {new Date(n.creadoEn).toLocaleString("es-CO", {
                                                            dateStyle: "short",
                                                            timeStyle: "short",
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    {!n.leidaEn && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void marcarLeida(n.id)}
                                                            disabled={accionando === n.id}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-accent hover:bg-pino/10 disabled:opacity-50"
                                                            aria-label="Marcar como leída"
                                                        >
                                                            {accionando === n.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => void archivar(n.id)}
                                                        disabled={accionando === n.id}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-tinta/5 disabled:opacity-50"
                                                        aria-label="Archivar"
                                                    >
                                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </PanelVidrio>
                </div>
            )}
        </div>
    );
}
