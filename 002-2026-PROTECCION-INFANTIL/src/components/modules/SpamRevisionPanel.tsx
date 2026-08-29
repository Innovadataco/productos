"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Alerta } from "@/components/ui/Alerta";
import { ErrorState } from "@/components/ui/ErrorState";
import { SpamAnaliticaPanel } from "./spam/SpamAnaliticaPanel";
import { SpamFiltros } from "./spam/SpamFiltros";
import { SpamReportesTabla } from "./spam/SpamReportesTabla";
import { SpamResolucionModal } from "./spam/SpamResolucionModal";
import type { SpamReporteItem, Analitica, VentanaDias } from "./spam/types";

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

    const [analitica, setAnalitica] = useState<Analitica | null>(null);
    const [loadingAnalitica, setLoadingAnalitica] = useState(true);
    const [errorAnalitica, setErrorAnalitica] = useState("");
    const [ventanaActiva, setVentanaActiva] = useState<VentanaDias>(7);
    const [descargandoBanco, setDescargandoBanco] = useState(false);

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

    const fetchAnalitica = useCallback(async () => {
        setLoadingAnalitica(true);
        setErrorAnalitica("");
        try {
            const res = await fetch("/api/admin/spam/analitica", { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando analítica");
            const json = await res.json();
            setAnalitica(json);
        } catch {
            setErrorAnalitica("Error cargando analítica de spam");
        } finally {
            setLoadingAnalitica(false);
        }
    }, []);

    useEffect(() => {
        fetchReportes();
        fetchAnalitica();
    }, [fetchReportes, fetchAnalitica]);

    const applyFilters = () => {
        router.push(`${pathname}?${buildQueryString({ page: "1" })}`);
    };

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

    const handleOrdenChange = (nuevoOrden: string) => {
        router.push(`${pathname}?${buildQueryString({ page: "1", orden: nuevoOrden })}`);
    };

    const resolver = async (decision: "es_spam" | "corregir" | "procesar_como_acoso") => {
        if (!selectedId) return;
        if (decision === "corregir" && !categoria) {
            setError("Seleccione una categoría para el reporte válido.");
            return;
        }
        setResolviendo(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${selectedId}/resolver-spam`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision,
                    categoria: decision === "corregir" ? categoria : undefined,
                    motivo: motivo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al resolver");
                return;
            }
            const mensajes: Record<typeof decision, string> = {
                es_spam: "Confirmado como spam y dado de baja.",
                corregir: "Marcado como reporte válido.",
                procesar_como_acoso: "Procesado como acoso.",
            };
            setSuccess(mensajes[decision]);
            setSelectedId(null);
            setMotivo("");
            setCategoria("OTRO");
            await fetchReportes();
            await fetchAnalitica();
        } catch {
            setError("Error al resolver el caso");
        } finally {
            setResolviendo(false);
        }
    };

    const sugerirAlBanco = async () => {
        setDescargandoBanco(true);
        try {
            const res = await fetch("/api/admin/spam/banco-sugerencias?limit=100", { credentials: "include" });
            if (!res.ok) throw new Error("Error generando sugerencias");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `banco-spam-sugerido-${new Date().toISOString().slice(0, 10)}.jsonl`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Error descargando sugerencias para el banco");
        } finally {
            setDescargandoBanco(false);
        }
    };

    const selected = reportes.find((r) => r.id === selectedId);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-body">Revisión de spam</h1>
                <p className="text-sm text-muted">Reportes marcados como posible spam por la IA esperando validación humana.</p>
            </div>

            <SpamAnaliticaPanel
                analitica={analitica}
                loading={loadingAnalitica}
                error={errorAnalitica}
                ventanaActiva={ventanaActiva}
                descargandoBanco={descargandoBanco}
                onVentanaChange={setVentanaActiva}
                onSugerirBanco={sugerirAlBanco}
                onRetry={fetchAnalitica}
            />

            <SpamFiltros
                q={q}
                setQ={setQ}
                estado={estado}
                setEstado={setEstado}
                orden={orden}
                setOrden={setOrden}
                onApply={applyFilters}
                onOrdenChange={handleOrdenChange}
            />

            {error && (
                <ErrorState
                    title="No pudimos cargar los reportes en revisión"
                    description={error}
                    onRetry={fetchReportes}
                />
            )}
            {success && <Alerta tono="exito" role="status" className="p-4">{success}</Alerta>}

            <SpamReportesTabla
                reportes={reportes}
                loading={loading}
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onReview={setSelectedId}
                onPageChange={goToPage}
            />

            {selectedId && selected && (
                <SpamResolucionModal
                    reporteId={selectedId}
                    categoria={categoria}
                    motivo={motivo}
                    resolviendo={resolviendo}
                    onClose={() => setSelectedId(null)}
                    onCategoriaChange={setCategoria}
                    onMotivoChange={setMotivo}
                    onResolve={resolver}
                    onRefresh={fetchReportes}
                />
            )}
        </div>
    );
}
