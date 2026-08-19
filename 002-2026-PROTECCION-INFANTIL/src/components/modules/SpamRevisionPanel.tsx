"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AdminReporteDetalle } from "./AdminReporteDetalle";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

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

// SPEC-181: la cola mezcla POSIBLE_SPAM y REVISION_MANUAL clasificado como SPAM.
const ESTADOS_SPAM = [
    { value: "", label: "Todos los estados" },
    { value: "POSIBLE_SPAM", label: "Posible spam" },
    { value: "REVISION_MANUAL", label: "Revisión manual" },
];

// Claves de orden validadas por `ordenBandejaSchema` (mapa cerrado en el repo).
const ORDENES = [
    { value: "prioridad", label: "Prioridad" },
    { value: "recientes", label: "Más recientes" },
    { value: "antiguos", label: "Más antiguos" },
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
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [reportes, setReportes] = useState<SpamReporteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [categoria, setCategoria] = useState("OTRO");
    const [motivo, setMotivo] = useState("");
    const [resolviendo, setResolviendo] = useState(false);
    const [success, setSuccess] = useState("");

    const [q, setQ] = useState(searchParams.get("q") || "");
    const [estado, setEstado] = useState(searchParams.get("estado") || "");
    const [orden, setOrden] = useState(searchParams.get("orden") || "prioridad");

    const page = Math.max(1, Number(searchParams.get("page") || "1"));

    const buildQueryString = useCallback(
        (override: Record<string, string> = {}) => {
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (estado) params.set("estado", estado);
            params.set("orden", orden);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [q, estado, orden, page]
    );

    const fetchReportes = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/spam/pendientes?${buildQueryString()}`, { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando pendientes");
            const json = await res.json();
            setReportes(json.reportes || []);
            setPagination(json.pagination);
        } catch {
            setError("Error cargando reportes en revisión de spam");
        } finally {
            setLoading(false);
        }
    }, [buildQueryString]);

    useEffect(() => {
        fetchReportes();
    }, [fetchReportes]);

    const applyFilters = () => {
        router.push(`${pathname}?${buildQueryString({ page: "1" })}`);
    };

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

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

            <div className="glass rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-2">
                        <Input
                            label="Buscar"
                            type="text"
                            placeholder="RPT-XXXX o identificador/nick"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    applyFilters();
                                }
                            }}
                        />
                    </div>
                    <Select label="Estado" options={ESTADOS_SPAM} value={estado} onChange={(e) => setEstado(e.target.value)} />
                    <Select
                        label="Ordenar por"
                        options={ORDENES}
                        value={orden}
                        onChange={(e) => {
                            setOrden(e.target.value);
                            router.push(`${pathname}?${buildQueryString({ page: "1", orden: e.target.value })}`);
                        }}
                    />
                    <div className="flex items-end">
                        <Button onClick={applyFilters}>Aplicar filtros</Button>
                    </div>
                </div>
            </div>

            {error && (
                <ErrorState
                    title="No pudimos cargar los reportes en revisión"
                    description="Ocurrió un problema al consultar la cola de spam. Intenta de nuevo."
                    onRetry={fetchReportes}
                />
            )}
            {success && <Alerta tono="exito" role="status" className="p-4">{success}</Alerta>}

            <div className="glass rounded-2xl overflow-hidden">
                <Tabla sinContenedor>
                    <TablaHead>
                        <tr>
                            <th className="px-4 py-3 font-medium">Identificador</th>
                            <th className="px-4 py-3 font-medium">Plataforma</th>
                            <th className="px-4 py-3 font-medium">Confianza SPAM</th>
                            <th className="px-4 py-3 font-medium">Asignado a</th>
                            <th className="px-4 py-3 font-medium">Recibido</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                    </TablaHead>
                    <TablaBody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-2 text-center text-subtle">
                                    <Cargando tamano="sm" />
                                </td>
                            </tr>
                        ) : reportes.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-2">
                                    <EmptyState
                                        title="No hay reportes en revisión de spam"
                                        description="Cuando la IA marque un reporte como posible spam, aparecerá aquí para validación humana."
                                    />
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
                    </TablaBody>
                </Tabla>

                {pagination.totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                        <p className="text-sm text-subtle">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total} reportes
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => goToPage(page - 1)} disabled={page <= 1} variant="outline">
                                Anterior
                            </Button>
                            <Button onClick={() => goToPage(page + 1)} disabled={page >= pagination.totalPages} variant="outline">
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {selectedId && selected && (
                <Modal isOpen onClose={() => setSelectedId(null)} title="Revisar posible spam">
                    <AdminReporteDetalle
                        reporteId={selectedId}
                        onClose={() => setSelectedId(null)}
                        onRefresh={fetchReportes}
                        inline
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
                </Modal>
            )}
        </div>
    );
}
