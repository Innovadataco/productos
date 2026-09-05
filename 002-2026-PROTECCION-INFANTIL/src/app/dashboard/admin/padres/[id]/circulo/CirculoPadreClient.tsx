"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cargando } from "@/components/ui/Cargando";

/**
 * SPEC-141 (N-1, FR-005): círculo de confianza del padre en SOLO LECTURA
 * (soporte). Muestra exactamente lo que ve el dueño (mismo servicio y predicado
 * de estados); sin controles de edición. Estados con lenguaje estadístico (§1.3).
 */

type PlataformaRef = { id: string; nombre: string; clave: string };

type IdentificadorContacto = {
    id: string;
    valor: string;
    tipo: string | null;
    plataforma: PlataformaRef | null;
};

type Contacto = {
    id: string;
    etiqueta: string | null;
    nota: string | null;
    activo: boolean;
    estado: "sinReportes" | "enRevision" | "clasificado";
    totalReportes: number;
    identificadores: IdentificadorContacto[];
};

type CirculoResponse = {
    contactos: Contacto[];
    resumen: {
        sinReportes: number;
        enRevision: number;
        clasificado: number;
        activos: number;
        inhabilitados: number;
    };
};

const ETIQUETAS_ESTADO: Record<Contacto["estado"], { label: string; variant: "neutral" | "warning" | "info" }> = {
    sinReportes: { label: "Sin reportes registrados", variant: "neutral" },
    enRevision: { label: "En proceso", variant: "warning" },
    clasificado: { label: "Con reportes registrados", variant: "info" },
};

export default function CirculoPadreClient({ padreId }: { padreId: string }) {
    const [datos, setDatos] = useState<CirculoResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/padres/${padreId}/circulo-confianza`, { credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    typeof json?.error?.message === "string" ? json.error.message : "No se pudo cargar el círculo de confianza"
                );
            }
            setDatos(json as CirculoResponse);
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo cargar el círculo de confianza");
        } finally {
            setLoading(false);
        }
    }, [padreId]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">Círculo de confianza del padre</h1>
                    <p className="text-sm text-muted">
                        Vista de soporte: los contactos e identificadores exactamente como los ve el usuario.
                    </p>
                </div>
                <Badge variant="warning">Solo lectura</Badge>
            </div>

            <div>
                <Link href="/dashboard/admin/padres" className="text-sm text-accent hover:underline">
                    ← Volver a cuentas de padres
                </Link>
            </div>

            {loading ? (
                <Cargando inline texto="Cargando círculo de confianza..." className="py-8" />
            ) : error ? (
                <GlassCard className="p-6">
                    <p className="text-sm text-rubi" role="alert">{error}</p>
                </GlassCard>
            ) : datos && datos.contactos.length === 0 ? (
                <EmptyState
                    title="El usuario no tiene contactos en su círculo"
                    description="Cuando el usuario agregue contactos de confianza, aparecerán aquí con sus identificadores."
                />
            ) : datos ? (
                <>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="neutral">{datos.resumen.activos} activos</Badge>
                        <Badge variant="neutral">{datos.resumen.inhabilitados} inhabilitados</Badge>
                        <Badge variant="warning">{datos.resumen.enRevision} en proceso</Badge>
                        <Badge variant="info">{datos.resumen.clasificado} con reportes registrados</Badge>
                    </div>
                    <div className="space-y-3">
                        {datos.contactos.map((contacto) => {
                            const estado = ETIQUETAS_ESTADO[contacto.estado] ?? ETIQUETAS_ESTADO.sinReportes;
                            return (
                                <GlassCard key={contacto.id} className="p-4">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <h2 className="text-sm font-semibold text-body">
                                            {contacto.etiqueta || "Sin etiqueta"}
                                        </h2>
                                        <Badge variant={estado.variant}>{estado.label}</Badge>
                                        {!contacto.activo && <Badge variant="neutral">Inhabilitado</Badge>}
                                        {contacto.totalReportes > 0 && (
                                            <span className="text-xs text-muted">
                                                {contacto.totalReportes} reportes registrados
                                            </span>
                                        )}
                                    </div>
                                    {contacto.nota && <p className="mb-2 text-xs text-muted">{contacto.nota}</p>}
                                    <ul className="space-y-1 text-sm text-body">
                                        {contacto.identificadores.map((i) => (
                                            <li key={i.id} className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs">{i.valor}</span>
                                                <span className="text-xs text-muted">
                                                    {i.tipo ?? "—"}
                                                    {i.plataforma ? ` · ${i.plataforma.nombre}` : ""}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </GlassCard>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </div>
    );
}
