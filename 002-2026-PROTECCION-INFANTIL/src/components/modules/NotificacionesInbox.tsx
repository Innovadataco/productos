"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { PanelVidrio } from "@/components/ui/PanelVidrio";

export interface NotificacionItem {
    id: string;
    titulo: string;
    mensaje: string;
    creadoEn: string;
    leidaEn: string | null;
}

export type NotificacionesVariant = "padre" | "colegio" | "admin";

interface NotificacionesInboxProps {
    variant: NotificacionesVariant;
    cargarResumen: () => Promise<{ noLeidas: number }>;
    cargarListado: () => Promise<{ items: NotificacionItem[] }>;
    onMarcarLeida: (id: string) => Promise<void>;
    onMarcarTodasLeidas: () => Promise<void>;
    onArchivar?: (id: string) => Promise<void>;
}

const PALETA: Record<NotificacionesVariant, { badge: string; unread: string; iconHover: string; textAccent: string }> = {
    padre: {
        badge: "bg-cielo-600",
        unread: "bg-cielo-500/10",
        iconHover: "hover:bg-cielo-100",
        textAccent: "text-cielo-700",
    },
    colegio: {
        badge: "bg-pino-600",
        unread: "bg-pino-500/10",
        iconHover: "hover:bg-pino-100",
        textAccent: "text-pino-700",
    },
    admin: {
        badge: "bg-ambar-600",
        unread: "bg-ambar-500/10",
        iconHover: "hover:bg-ambar-100",
        textAccent: "text-ambar-700",
    },
};

export function NotificacionesInbox({
    variant,
    cargarResumen,
    cargarListado,
    onMarcarLeida,
    onMarcarTodasLeidas,
    onArchivar,
}: NotificacionesInboxProps) {
    const [abierto, setAbierto] = useState(false);
    /**
     * SPEC-415: `null` = **no se pudo preguntar**, distinto de `0` = no hay nuevas.
     * Antes un fallo del resumen dejaba el contador en 0 y el badge escondido:
     * el usuario leía "no tengo nada" cuando en realidad nadie había podido
     * mirar. Un aviso de este producto puede ser el de un caso de su hijo.
     */
    const [noLeidas, setNoLeidas] = useState<number | null>(0);
    const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [accionando, setAccionando] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const tema = PALETA[variant];

    async function refrescarResumen() {
        try {
            const json = await cargarResumen();
            setNoLeidas(json.noLeidas ?? 0);
        } catch (error) {
            // No bloquea la UI, pero tampoco miente: el badge pasa a "no sé".
            console.error("[NotificacionesInbox] resumen:", error);
            setNoLeidas(null);
        }
    }

    async function refrescarListado() {
        setLoading(true);
        try {
            const json = await cargarListado();
            setNotificaciones(json.items ?? []);
        } finally {
            setLoading(false);
        }
    }

    async function marcarLeida(id: string) {
        setAccionando(id);
        try {
            await onMarcarLeida(id);
            setNotificaciones((prev) =>
                prev.map((n) => (n.id === id ? { ...n, leidaEn: new Date().toISOString() } : n))
            );
            setNoLeidas((n) => (n === null ? null : Math.max(0, n - 1)));
        } finally {
            setAccionando(null);
        }
    }

    async function marcarTodasLeidas() {
        setAccionando("todas");
        try {
            await onMarcarTodasLeidas();
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leidaEn: new Date().toISOString() })));
            setNoLeidas(0);
        } finally {
            setAccionando(null);
        }
    }

    async function archivar(id: string) {
        if (!onArchivar) return;
        setAccionando(id);
        try {
            await onArchivar(id);
            setNotificaciones((prev) => prev.filter((n) => n.id !== id));
            setNoLeidas((n) => (n === null ? null : Math.max(0, n - 1)));
        } finally {
            setAccionando(null);
        }
    }

    useEffect(() => {
        void refrescarResumen();
        const interval = setInterval(() => void refrescarResumen(), 60000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (abierto) {
            void refrescarListado();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                aria-label={
                    noLeidas === null
                        ? "Notificaciones, no se pudo consultar si hay nuevas"
                        : `Notificaciones${noLeidas > 0 ? `, ${noLeidas} no leídas` : ""}`
                }
                aria-expanded={abierto}
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {noLeidas === null ? (
                    <span
                        className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ambar px-1 text-[10px] font-bold text-white"
                        title="No se pudo consultar si hay notificaciones nuevas"
                    >
                        ?
                    </span>
                ) : (
                    noLeidas > 0 && (
                        <span className={`absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full ${tema.badge} px-1 text-[10px] font-bold text-white`}>
                            {noLeidas > 99 ? "99+" : noLeidas}
                        </span>
                    )
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
                                    className={`text-xs font-semibold ${tema.textAccent} hover:opacity-80 disabled:opacity-50`}
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
                                            className={`rounded-xl p-3 transition ${n.leidaEn ? "bg-papel/50" : tema.unread}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold ${n.leidaEn ? "text-muted" : "text-body"}`}>
                                                        {n.titulo}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted">{n.mensaje}</p>
                                                    <p className="mt-1 text-[10px] text-subtle">
                                                        {n.creadoEn}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    {!n.leidaEn && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void marcarLeida(n.id)}
                                                            disabled={accionando === n.id}
                                                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${tema.textAccent} ${tema.iconHover} disabled:opacity-50`}
                                                            aria-label="Marcar como leída"
                                                        >
                                                            {accionando === n.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                            )}
                                                        </button>
                                                    )}
                                                    {onArchivar && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void archivar(n.id)}
                                                            disabled={accionando === n.id}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-tinta/5 disabled:opacity-50"
                                                            aria-label="Archivar"
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </button>
                                                    )}
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
