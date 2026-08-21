"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { Button } from "@/components/ui/Button";

type ReporteItem = {
    id: string;
    estado: string;
    creadoEn: string;
    esAnonimo: boolean;
    plataforma: { nombre: string; clave: string } | null;
    clasificacion: { categoria: string; confianza: number } | null;
};

type UsuarioDetalle = {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    estado: string;
    creadoEn: string;
    ultimaSesion: string | null;
    reportes: { items: ReporteItem[]; total: number };
};

function fechaCorta(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default function UsuarioDetalleClient() {
    const params = useParams();
    const id = params.id as string;

    const [data, setData] = useState<UsuarioDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function cargar() {
            try {
                const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: "include" });
                const json = await res.json().catch(() => ({}));
                if (res.ok) {
                    setData(json);
                } else {
                    setMessage({ type: "error", text: json?.error?.message || "Error cargando el detalle" });
                }
            } catch {
                setMessage({ type: "error", text: "Error de red cargando el detalle" });
            } finally {
                setLoading(false);
            }
        }
        void cargar();
    }, [id]);

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl py-8">
                <Cargando inline texto="Cargando detalle..." />
            </div>
        );
    }

    if (message || !data) {
        return (
            <div className="mx-auto max-w-5xl py-8">
                {message && <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">{message.text}</Alerta>}
                <div className="mt-4">
                    <Link href="/dashboard/admin/usuarios" className="text-sm text-pino hover:underline">
                        ← Volver a usuarios
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{data.email}</h1>
                    <p className="text-sm text-muted">{data.nombre || "Sin nombre"} · {data.rol}</p>
                </div>
                <Link href="/dashboard/admin/usuarios">
                    <Button variant="outline">← Volver</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard>
                    <p className="text-sm text-muted">Estado</p>
                    <Badge variant={data.estado === "activo" ? "success" : "neutral"}>{data.estado}</Badge>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-muted">Registro</p>
                    <p className="text-body">{fechaCorta(data.creadoEn)}</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-muted">Última sesión</p>
                    <p className="text-body">{fechaCorta(data.ultimaSesion)}</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-muted">Reportes enviados</p>
                    <p className="text-body">{data.reportes.total}</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Historial de reportes (metadatos)</h2>
                {data.reportes.items.length === 0 ? (
                    <EmptyState title="Sin reportes" description="Este usuario no ha enviado reportes." />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Fecha</th>
                                    <th className="pb-3 font-medium">Plataforma</th>
                                    <th className="pb-3 font-medium">Clasificación</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {data.reportes.items.map((r) => (
                                    <tr key={r.id}>
                                        <td className="py-3 pr-3"><Badge variant="neutral">{r.estado}</Badge></td>
                                        <td className="py-3 pr-3 text-muted">{fechaCorta(r.creadoEn)}</td>
                                        <td className="py-3 pr-3 text-muted">{r.plataforma?.nombre || "—"}</td>
                                        <td className="py-3 pr-3 text-muted">{r.clasificacion?.categoria || "—"}</td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        <p className="mt-4 text-sm text-muted">Mostrando {data.reportes.items.length} de {data.reportes.total} reportes.</p>
                    </>
                )}
            </GlassCard>
        </div>
    );
}
