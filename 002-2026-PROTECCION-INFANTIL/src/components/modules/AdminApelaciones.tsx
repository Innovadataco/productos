"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

interface Apelacion {
    id: string;
    identificador: string;
    plataforma: { nombre: string };
    estado: string;
    tipoVerificacion: string;
    motivoSolicitud: string;
    pausaHasta: string | null;
    creadoEn: string;
}

export function AdminApelaciones() {
    const [items, setItems] = useState<Apelacion[]>([]);
    const [selected, setSelected] = useState<Apelacion | null>(null);
    const [detail, setDetail] = useState<{ apelacion: Apelacion; reportes: any[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [respuesta, setRespuesta] = useState("");
    const [seleccionados, setSeleccionados] = useState<string[]>([]);
    const [notaRehab, setNotaRehab] = useState("");

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/apelaciones", { credentials: "include", cache: "no-store" });
            const data = await res.json();
            if (res.ok) setItems(data.items || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function openDetail(apelacion: Apelacion) {
        setSelected(apelacion);
        const res = await fetch(`/api/admin/apelaciones/${apelacion.id}`, { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
            setDetail(data);
            setSeleccionados([]);
        }
    }

    async function resolver(accion: "ACEPTAR" | "RECHAZAR") {
        if (!selected || !respuesta.trim()) return;
        const res = await fetch(`/api/admin/apelaciones/${selected.id}/resolver`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accion,
                respuestaAdmin: respuesta,
                reportesSeleccionados: accion === "ACEPTAR" ? seleccionados : undefined,
            }),
        });
        if (res.ok) {
            setSelected(null);
            setDetail(null);
            setRespuesta("");
            load();
        } else {
            const data = await res.json();
            alert(data?.error?.message || "Error");
        }
    }

    async function rehabilitar() {
        if (!selected || !notaRehab.trim()) return;
        const res = await fetch(`/api/admin/apelaciones/${selected.id}/rehabilitar`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nota: notaRehab }),
        });
        if (res.ok) {
            setSelected(null);
            setDetail(null);
            setNotaRehab("");
            load();
        } else {
            const data = await res.json();
            alert(data?.error?.message || "Error");
        }
    }

    return (
        <section className="space-y-6" aria-labelledby="apelaciones-title">
            <h1 id="apelaciones-title" className="text-2xl font-bold text-body">Apelaciones</h1>

            {loading ? (
                <p className="text-sm text-muted">Cargando...</p>
            ) : items.length === 0 ? (
                <GlassCard className="p-6"><p className="text-sm text-muted">Sin apelaciones.</p></GlassCard>
            ) : (
                <div className="space-y-3">
                    {items.map((a) => (
                        <GlassCard key={a.id} className="p-4 cursor-pointer hover:shadow-md" onClick={() => openDetail(a)}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-body">{a.identificador}</p>
                                    <p className="text-xs text-muted">{a.plataforma.nombre} · {new Date(a.creadoEn).toLocaleString()}</p>
                                </div>
                                <Badge variant={a.estado === "RECIBIDA" || a.estado === "EN_REVISION" ? "warning" : a.estado === "ACEPTADA" ? "success" : "danger"}>
                                    {a.estado}
                                </Badge>
                            </div>
                            {a.tipoVerificacion === "NICK" && (
                                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Titularidad no verificada</p>
                            )}
                        </GlassCard>
                    ))}
                </div>
            )}

            {selected && detail && (
                <GlassCard className="p-6">
                    <h2 className="text-lg font-semibold text-body">Detalle de apelación</h2>
                    <p className="text-sm text-muted">{detail.apelacion.identificador} · {detail.apelacion.plataforma.nombre}</p>
                    <p className="mt-4 text-sm text-body">{detail.apelacion.motivoSolicitud}</p>

                    {detail.apelacion.estado !== "RECHAZADA" && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-body">Respuesta del admin</label>
                            <textarea
                                value={respuesta}
                                onChange={(e) => setRespuesta(e.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                            />
                        </div>
                    )}

                    {detail.apelacion.estado === "RECIBIDA" || detail.apelacion.estado === "EN_REVISION" ? (
                        <>
                            <h3 className="mt-6 text-sm font-semibold text-body">Reportes del identificador (selecciona los que sean falsos)</h3>
                            <div className="mt-2 space-y-2">
                                {detail.reportes.map((r) => (
                                    <label key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={seleccionados.includes(r.id)}
                                            onChange={(e) => setSeleccionados((prev) => e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id))}
                                        />
                                        <span className="text-body">{r.estado} · {r.clasificacion?.categoria || "sin clasificar"}</span>
                                        <span className="text-xs text-muted">{new Date(r.creadoEn).toLocaleString()}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button variant="secondary" onClick={() => resolver("ACEPTAR")}>Aceptar y dar de baja seleccionados</Button>
                                <Button variant="outline" onClick={() => resolver("RECHAZAR")}>Rechazar</Button>
                            </div>
                        </>
                    ) : detail.apelacion.estado === "RECHAZADA" ? (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-body">Nota para rehabilitar derecho a apelar</label>
                            <textarea
                                value={notaRehab}
                                onChange={(e) => setNotaRehab(e.target.value)}
                                rows={2}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                            />
                            <Button className="mt-2" variant="outline" onClick={rehabilitar}>Rehabilitar derecho</Button>
                        </div>
                    ) : null}

                    <Button className="mt-4" variant="ghost" onClick={() => { setSelected(null); setDetail(null); }}>Cerrar</Button>
                </GlassCard>
            )}
        </section>
    );
}
