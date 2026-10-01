"use client";

/**
 * SPEC-787 · La bandeja «Reportes que no coinciden» del verificador. Lista los incidentes de
 * contradicción (SPEC-753) ordenados por vencimiento real, con su estado y su reloj. El resumen y
 * el detalle leen el MISMO `incumplida` (esIncumplimiento, del backend). Superficie interna.
 */
import { useCallback, useEffect, useState } from "react";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";
import { IncidenteContradiccionCard } from "./IncidenteContradiccionCard";
import type { BandejaIncidentesDto } from "@/lib/profesional/cita/bandeja-incidentes.service";

const ENDPOINT = "/api/admin/verificacion-profesionales/incidentes-contradiccion";

export function ReportesNoCoincidenClient() {
    const [data, setData] = useState<BandejaIncidentesDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [resolviendoId, setResolviendoId] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(ENDPOINT, { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (res.ok) setData(body as BandejaIncidentesDto);
            else setError(body?.error?.message || "No pudimos cargar los reportes que no coinciden");
        } catch {
            setError("Error de red al cargar la bandeja");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function resolver(id: string) {
        setResolviendoId(id);
        try {
            const res = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}/resolver`, { method: "POST", credentials: "include" });
            if (res.ok) await cargar();
        } finally {
            setResolviendoId(null);
        }
    }

    if (loading) return <Cargando inline texto="Cargando reportes..." className="py-8" />;
    if (error) return <ErrorState title="No pudimos cargar la bandeja" description={error} onRetry={cargar} />;
    if (!data || data.incidentes.length === 0) {
        return <p className="cuerpo text-subtle py-8">No hay reportes que no coincidan pendientes.</p>;
    }

    return (
        <div className="space-y-4">
            {/* Resumen desde la MISMA fuente que el detalle (incumplida = esIncumplimiento). */}
            <p className="text-sm text-muted">
                {data.resumen.total} reporte{data.resumen.total === 1 ? "" : "s"} que no coincide
                {data.resumen.total === 1 ? "" : "n"} · {data.resumen.incumplidos} fuera del plazo
            </p>
            {data.incidentes.map((inc) => (
                <IncidenteContradiccionCard
                    key={inc.id}
                    incidente={inc}
                    onResolver={resolver}
                    resolviendo={resolviendoId === inc.id}
                />
            ))}
        </div>
    );
}
