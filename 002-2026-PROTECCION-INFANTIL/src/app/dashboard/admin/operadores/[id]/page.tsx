"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";
import { AdminReporteDetalle } from "@/components/modules/AdminReporteDetalle";
import { ReasignarModal } from "@/components/modules/operadores/ReasignarModal";
import { MetricasCards } from "./components/MetricasCards";
import { CasosAbiertosTable } from "./components/CasosAbiertosTable";
import { DistribucionCategorias } from "./components/DistribucionCategorias";
import { HistorialCasos } from "./components/HistorialCasos";
import { PAGE_SIZE } from "./utils";
import type { Metricas, CasoItem, Paginacion, CasoAbierto } from "./types";

export default function AdminOperadorDetallePage() {
    const params = useParams();
    const router = useRouter();
    const operadorId = String(params.id);

    const [metricas, setMetricas] = useState<Metricas | null>(null);
    const [loadingMetricas, setLoadingMetricas] = useState(true);
    const [errorMetricas, setErrorMetricas] = useState("");

    const [casos, setCasos] = useState<CasoItem[]>([]);
    const [pagination, setPagination] = useState<Paginacion>({
        page: 1,
        pageSize: PAGE_SIZE,
        total: 0,
        totalPages: 0,
    });
    const [loadingCasos, setLoadingCasos] = useState(true);
    const [errorCasos, setErrorCasos] = useState("");
    const [estadoFiltro, setEstadoFiltro] = useState("CORREGIDO");
    const [page, setPage] = useState(1);

    const [selectedReporteId, setSelectedReporteId] = useState<string | null>(null);
    const [casoParaReasignar, setCasoParaReasignar] = useState<CasoAbierto | null>(null);

    const cargarMetricas = useCallback(async () => {
        setLoadingMetricas(true);
        setErrorMetricas("");
        try {
            const res = await fetch(`/api/admin/operadores/${encodeURIComponent(operadorId)}/metricas`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMetricas(data);
            } else {
                setErrorMetricas(data?.error?.message || "Error cargando métricas del operador");
            }
        } catch {
            setErrorMetricas("Error de red cargando métricas del operador");
        } finally {
            setLoadingMetricas(false);
        }
    }, [operadorId]);

    const cargarCasos = useCallback(async () => {
        setLoadingCasos(true);
        setErrorCasos("");
        try {
            const query = new URLSearchParams({
                page: String(page),
                pageSize: String(PAGE_SIZE),
            });
            if (estadoFiltro) query.set("estado", estadoFiltro);
            const res = await fetch(
                `/api/admin/operadores/${encodeURIComponent(operadorId)}/casos?${query.toString()}`,
                { credentials: "include" }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCasos(data.items || []);
                setPagination(data.pagination || { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
            } else {
                setErrorCasos(data?.error?.message || "Error cargando casos del operador");
            }
        } catch {
            setErrorCasos("Error de red cargando casos del operador");
        } finally {
            setLoadingCasos(false);
        }
    }, [operadorId, estadoFiltro, page]);

    useEffect(() => {
        cargarMetricas();
    }, [cargarMetricas]);

    useEffect(() => {
        cargarCasos();
    }, [cargarCasos]);

    const nombreOperador = metricas?.operador.nombre || metricas?.operador.email || "Operador";

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">{nombreOperador}</h1>
                    <p className="text-sm text-muted">
                        {metricas?.operador.email} · Cupo {metricas?.operador.cupoMaximo ?? "—"} ·{" "}
                        {metricas?.casosAbiertos.length ?? 0} casos abiertos
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/dashboard/admin/operadores/asignar")}>
                    Volver a asignar
                </Button>
            </div>

            {errorMetricas && (
                <ErrorState
                    title="No pudimos cargar la ficha del operador"
                    description={errorMetricas}
                    onRetry={cargarMetricas}
                />
            )}

            {loadingMetricas ? (
                <Cargando inline texto="Cargando métricas..." className="py-8" />
            ) : (
                metricas && (
                    <>
                        <MetricasCards metricas={metricas} />
                        <CasosAbiertosTable
                            casos={metricas.casosAbiertos}
                            onVerDetalle={setSelectedReporteId}
                            onReasignar={setCasoParaReasignar}
                        />
                        <DistribucionCategorias casosPorCategoria={metricas.casosPorCategoria} />
                    </>
                )
            )}

            <HistorialCasos
                estadoFiltro={estadoFiltro}
                setEstadoFiltro={setEstadoFiltro}
                page={page}
                setPage={setPage}
                casos={casos}
                pagination={pagination}
                loading={loadingCasos}
                error={errorCasos}
                onRetry={cargarCasos}
                onVerDetalle={setSelectedReporteId}
            />

            {selectedReporteId && (
                <AdminReporteDetalle
                    reporteId={selectedReporteId}
                    onClose={() => setSelectedReporteId(null)}
                    onRefresh={() => {
                        void cargarMetricas();
                        void cargarCasos();
                    }}
                />
            )}

            {casoParaReasignar && metricas && (
                <ReasignarModal
                    reporteId={casoParaReasignar.id}
                    operadorActualId={metricas.operador.id}
                    operadorActualNombre={metricas.operador.nombre || metricas.operador.email}
                    isOpen={!!casoParaReasignar}
                    onClose={() => setCasoParaReasignar(null)}
                    onReasignado={() => {
                        void cargarMetricas();
                        void cargarCasos();
                    }}
                />
            )}
        </div>
    );
}
