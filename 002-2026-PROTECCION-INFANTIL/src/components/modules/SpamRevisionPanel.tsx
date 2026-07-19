"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { AdminReporteDetalle } from "./AdminReporteDetalle";

const CATEGORIAS = [
    { value: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
    { value: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
    { value: "OFRECIMIENTO_REGALOS", label: "Ofrecimiento de regalos" },
    { value: "SUPLANTACION_IDENTIDAD", label: "Suplantación de identidad" },
    { value: "SOLICITUD_ENCUENTRO", label: "Solicitud de encuentro" },
    { value: "COMPARTIMIENTO_SEXUAL", label: "Compartimiento sexual" },
    { value: "EXTORSION", label: "Extorsión" },
    { value: "CONTENIDO_GENERADO_IA", label: "Contenido generado por IA" },
    { value: "DIFUSION_NO_CONSENTIDA", label: "Difusión no consentida" },
    { value: "DOXING", label: "Doxing" },
    { value: "OTRO", label: "Otro" },
];

type SpamReporteItem = {
    id: string;
    identificador: string;
    plataforma: { id: string; nombre: string; clave: string };
    texto: string;
    estado: string;
    creadoEn: string;
    prioridadAlta: boolean;
    operadorId: string | null;
    asignadoA: { id: string; nombre: string | null; email: string } | null;
    clasificacion: { categoria: string; confianza: number } | null;
    confianzaSpam: number;
};

function formatCategoria(value: string) {
    return CATEGORIAS.find((c) => c.value === value)?.label || value;
}

export function SpamRevisionPanel() {
    const [reportes, setReportes] = useState<SpamReporteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [categoria, setCategoria] = useState("OTRO");
    const [motivo, setMotivo] = useState("");
    const [resolviendo, setResolviendo] = useState(false);
    const [success, setSuccess] = useState("");

    const fetchReportes = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/spam/pendientes", { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando pendientes");
            const json = await res.json();
            setReportes(json.reportes || []);
        } catch {
            setError("Error cargando reportes en revisión de spam");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReportes();
    }, [fetchReportes]);

    const selected = reportes.find((r) => r.id === selectedId);

    const resolver = async (esSpam: boolean) => {
        if (!selectedId) return;
        if (!esSpam && !categoria) {
            setError("Seleccione una categoría para el reporte válido.");
            return;
        }
        setResolviendo(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/spam/${selectedId}/resolver`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    esSpam,
                    categoria: esSpam ? undefined : categoria,
                    motivo: motivo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al resolver");
                return;
            }
            setSuccess(esSpam ? "Confirmado como spam y dado de baja." : "Marcado como reporte válido.");
            setSelectedId(null);
            setMotivo("");
            setCategoria("OTRO");
            await fetchReportes();
        } catch {
            setError("Error al resolver el caso");
        } finally {
            setResolviendo(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Revisión de spam</h1>
                <p className="text-sm text-muted">Reportes marcados como posible spam por la IA esperando validación humana.</p>
            </div>

            {error && <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
            {success && <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-4 text-sm text-green-700 dark:text-green-300">{success}</div>}

            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                            <tr>
                                <th className="px-4 py-3 font-medium">Identificador</th>
                                <th className="px-4 py-3 font-medium">Plataforma</th>
                                <th className="px-4 py-3 font-medium">Confianza SPAM</th>
                                <th className="px-4 py-3 font-medium">Asignado a</th>
                                <th className="px-4 py-3 font-medium">Recibido</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                        <p className="mt-2 text-xs">Cargando...</p>
                                    </td>
                                </tr>
                            ) : reportes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                                        No hay reportes en revisión de spam.
                                    </td>
                                </tr>
                            ) : (
                                reportes.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 text-body">{r.identificador}</td>
                                        <td className="px-4 py-3 text-body">{r.plataforma.nombre}</td>
                                        <td className="px-4 py-3 text-body">{(r.confianzaSpam * 100).toFixed(1)}%</td>
                                        <td className="px-4 py-3 text-body">{r.asignadoA?.nombre || r.asignadoA?.email || "—"}</td>
                                        <td className="px-4 py-3 text-subtle">{new Date(r.creadoEn).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <Button onClick={() => setSelectedId(r.id)} variant="outline" className="py-2 px-3 text-xs">
                                                Revisar
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedId && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl glass-strong p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-body">Revisar posible spam</h2>
                            <Button onClick={() => setSelectedId(null)} variant="secondary" disabled={resolviendo}>
                                Cerrar
                            </Button>
                        </div>

                        <AdminReporteDetalle
                            reporteId={selectedId}
                            onClose={() => setSelectedId(null)}
                            onRefresh={fetchReportes}
                        />

                        <div className="mt-6 space-y-4 rounded-2xl glass p-4">
                            <h3 className="font-medium text-body">Resolución</h3>
                            <div>
                                <label className="block text-sm font-medium text-body mb-1.5">Categoría si es válido</label>
                                <Select
                                    options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
                                    value={categoria}
                                    onChange={(e) => setCategoria(e.target.value)}
                                />
                            </div>
                            <textarea
                                className="w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={3}
                                placeholder="Motivo de la resolución (opcional)"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={() => resolver(false)} disabled={resolviendo} variant="secondary">
                                    {resolviendo ? "Resolviendo..." : "Marcar como válido"}
                                </Button>
                                <Button onClick={() => resolver(true)} disabled={resolviendo}>
                                    {resolviendo ? "Resolviendo..." : "Confirmar spam"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
