"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Button } from "@/components/ui/Button";
import { ColegioDetalleSecciones } from "@/components/modules/admin/ColegioDetalleSecciones";

type Detalle = Parameters<typeof ColegioDetalleSecciones>[0]["detalle"];

export default function ColegioDetalleClient() {
    const params = useParams();
    const colegioId = params.colegioId as string;

    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function cargar() {
            try {
                const res = await fetch(`/api/admin/analytics/colegios/${colegioId}`, { credentials: "include" });
                const json = await res.json().catch(() => ({}));
                if (res.ok) {
                    setDetalle(json);
                } else {
                    setMessage({ type: "error", text: json?.error?.message || "Error cargando la ficha" });
                }
            } catch {
                setMessage({ type: "error", text: "Error de red cargando la ficha" });
            } finally {
                setLoading(false);
            }
        }
        void cargar();
    }, [colegioId]);

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl py-8">
                <Cargando inline texto="Cargando ficha del colegio..." />
            </div>
        );
    }

    if (message || !detalle) {
        return (
            <div className="mx-auto max-w-5xl py-8">
                {message && <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">{message.text}</Alerta>}
                <div className="mt-4">
                    <Link href="/dashboard/admin/estadisticas/operacion?tab=colegios" className="text-sm text-pino hover:underline">
                        ← Volver a colegios
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.infoBasica.nombre}</h1>
                    <p className="text-sm text-muted">Ficha analítica · {detalle.infoBasica.ciudad}</p>
                </div>
                <Link href="/dashboard/admin/estadisticas/operacion?tab=colegios">
                    <Button variant="outline">← Volver</Button>
                </Link>
            </div>
            <ColegioDetalleSecciones detalle={detalle} />
        </div>
    );
}
