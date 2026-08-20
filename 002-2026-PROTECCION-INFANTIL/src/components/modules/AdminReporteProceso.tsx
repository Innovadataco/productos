"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";

interface EventoTransicion {
    tipo: "TRANSICION";
    id: string;
    fecha: string;
    estadoAnterior: string;
    estadoNuevo: string;
    responsableTipo: string;
    responsableId: string | null;
    motivo: string | null;
}

interface EventoReintento {
    tipo: "REINTENTO";
    id: string;
    fecha: string;
    intento: number;
    exitoso: boolean;
    error: string | null;
}

interface EventoAsignacionOperador {
    tipo: "ASIGNACION_OPERADOR";
    id: string;
    fecha: string;
    accion: "OPERADOR_ASIGNADO" | "OPERADOR_REASIGNADO" | "OPERADOR_DESASIGNADO";
    operadorEmail: string | null;
    operadorNombre: string | null;
    actorEmail: string | null;
    actorNombre: string | null;
}

type EventoProceso = EventoTransicion | EventoReintento | EventoAsignacionOperador;

interface TimelineResponse {
    eventos: EventoProceso[];
}

interface AdminReporteProcesoProps {
    reporteId: string;
}

function formatearFechaHora(fecha: string): string {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });
}

function formatearEstado(estado: string): string {
    return estado.replace(/_/g, " ");
}

function Stage({ titulo, children, icono }: { titulo: string; children: React.ReactNode; icono: React.ReactNode }) {
    return (
        <div className="relative pl-6">
            <span className="absolute left-0 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cielo text-[10px] text-white ring-4 ring-cielo/20">
                {icono}
            </span>
            <div className="absolute left-[9px] top-8 h-[calc(100%-20px)] w-0.5 bg-tinta/10" />
            <GlassCard className="mb-4 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-body">{titulo}</h4>
                </div>
                <div className="space-y-2 text-sm text-body">{children}</div>
            </GlassCard>
        </div>
    );
}

function EventoTransicionCard({ evento }: { evento: EventoTransicion }) {
    return (
        <Stage
            titulo={`Transición: ${formatearEstado(evento.estadoAnterior)} → ${formatearEstado(evento.estadoNuevo)}`}
            icono="T"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{evento.responsableTipo.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted">{formatearFechaHora(evento.fecha)}</span>
            </div>
            {evento.motivo && (
                <div>
                    <p className="text-xs font-medium text-muted">Motivo</p>
                    <p className="text-sm">{evento.motivo}</p>
                </div>
            )}
            {evento.responsableId && (
                <p className="text-xs text-muted">Responsable id: <span className="font-mono">{evento.responsableId}</span></p>
            )}
        </Stage>
    );
}

function EventoReintentoCard({ evento }: { evento: EventoReintento }) {
    return (
        <Stage titulo={`Reintento #${evento.intento}`} icono="R">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={evento.exitoso ? "success" : "danger"}>
                    {evento.exitoso ? "Exitoso" : "Fallido"}
                </Badge>
                <span className="text-xs text-muted">{formatearFechaHora(evento.fecha)}</span>
            </div>
            {evento.error && (
                <div>
                    <p className="text-xs font-medium text-muted">Error</p>
                    <p className="text-sm text-rubi">{evento.error}</p>
                </div>
            )}
        </Stage>
    );
}

function textoAsignacion(evento: EventoAsignacionOperador): string {
    const operador = evento.operadorEmail ?? "operador";
    const actor = evento.actorEmail ?? "sistema";
    switch (evento.accion) {
        case "OPERADOR_ASIGNADO":
            return `Asignado a ${operador} por ${actor}`;
        case "OPERADOR_REASIGNADO":
            return `Reasignado a ${operador} por ${actor}`;
        case "OPERADOR_DESASIGNADO":
            return `Desasignado por ${actor}`;
        default:
            return evento.accion;
    }
}

function EventoAsignacionOperadorCard({ evento }: { evento: EventoAsignacionOperador }) {
    return (
        <Stage titulo={textoAsignacion(evento)} icono="A">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{evento.accion.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted">{formatearFechaHora(evento.fecha)}</span>
            </div>
            {evento.operadorEmail && (
                <p className="text-xs text-muted">
                    Operador: <span className="font-mono">{evento.operadorEmail}</span>
                </p>
            )}
            {evento.actorEmail && (
                <p className="text-xs text-muted">
                    Actor: <span className="font-mono">{evento.actorEmail}</span>
                </p>
            )}
        </Stage>
    );
}

export function AdminReporteProceso({ reporteId }: AdminReporteProcesoProps) {
    const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/proceso`, { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            const json = (await res.json()) as TimelineResponse;
            if (!res.ok) {
                const mensaje =
                    typeof json === "object" && json !== null && "error" in json && typeof json.error === "object" && json.error !== null && "message" in json.error && typeof json.error.message === "string"
                        ? json.error.message
                        : "No se pudo cargar el proceso";
                throw new Error(mensaje);
            }
            setTimeline(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo cargar el proceso");
        } finally {
            setLoading(false);
        }
    }, [reporteId]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    if (loading) {
        return <Cargando tamano="sm" texto="Cargando proceso..." className="py-10" />;
    }

    if (error) {
        return (
            <div className="py-6 text-center">
                <p className="text-sm text-rubi" role="alert">{error}</p>
                <Button onClick={cargar} variant="outline" className="mt-4">
                    Reintentar
                </Button>
            </div>
        );
    }

    const eventos = timeline?.eventos ?? [];

    return (
        <div className="space-y-4">
            <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-body">Línea de tiempo del proceso</h3>
                <p className="text-xs text-muted">
                    Eventos internos de transiciones de estado y reintentos de procesamiento. Uso exclusivo de ADMIN.
                </p>
            </GlassCard>

            {eventos.length === 0 ? (
                <GlassCard className="p-4 text-center">
                    <p className="text-sm text-subtle">No hay eventos registrados para este reporte.</p>
                </GlassCard>
            ) : (
                <div className="space-y-1">
                    {eventos.map((evento) => {
                        if (evento.tipo === "TRANSICION") {
                            return <EventoTransicionCard key={evento.id} evento={evento} />;
                        }
                        if (evento.tipo === "REINTENTO") {
                            return <EventoReintentoCard key={evento.id} evento={evento} />;
                        }
                        return <EventoAsignacionOperadorCard key={evento.id} evento={evento} />;
                    })}
                </div>
            )}
        </div>
    );
}
