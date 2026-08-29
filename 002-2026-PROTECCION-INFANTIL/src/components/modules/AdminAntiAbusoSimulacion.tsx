"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { useFetchJson } from "@/components/ui/use-fetch-json";

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

type SimulacionItem = {
    identificador: string;
    plataformaNombre: string;
    score: number;
    scoreAjustado: number;
    nivelActual: NivelRiesgo;
    nivelAjustado: NivelRiesgo;
    cambioNivel: number;
    pesoAnonimoPromedio: number;
    pesoAutenticadoPromedio: number;
    totalReportes: number;
    reportesAnonimos: number;
    reportesAutenticados: number;
};

type Resumen = {
    subidas: number;
    bajadas: number;
    sinCambio: number;
};

type Pagination = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

type SimulacionResponse = {
    resumen: Resumen;
    detalles: SimulacionItem[];
    pagination: Pagination;
};

type Plataforma = { id: string; nombre: string };

const NIVEL_LABELS: Record<NivelRiesgo, string> = {
    BAJO: "Bajo",
    MEDIO: "Medio",
    ALTO: "Alto",
    CRITICO: "Crítico",
};

const NIVEL_COLORS: Record<NivelRiesgo, string> = {
    BAJO: "bg-pino/10 text-pino",
    MEDIO: "bg-ambar/10 text-ambar",
    ALTO: "bg-rubi/10 text-rubi",
    CRITICO: "bg-rubi/20 text-rubi ring-1 ring-rubi/40",
};

const NIVEL_OPCIONES = [
    { value: "", label: "Todos los niveles" },
    { value: "BAJO", label: "Bajo" },
    { value: "MEDIO", label: "Medio" },
    { value: "ALTO", label: "Alto" },
    { value: "CRITICO", label: "Crítico" },
];

const ORDEN_OPCIONES = [
    { value: "recientes", label: "Más recientes" },
    { value: "antiguos", label: "Más antiguos" },
    { value: "score", label: "Mayor score actual" },
];

export function AdminAntiAbusoSimulacion() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // SPEC-181: la URL es la fuente de verdad; los controles son estado local
    // que se publica a la URL al aplicar (patrón de AdminReportesTable).
    const [q, setQ] = useState(searchParams.get("q") || "");
    const [nivel, setNivel] = useState(searchParams.get("nivel") || "");
    const [plataformaId, setPlataformaId] = useState(searchParams.get("plataformaId") || "");
    const [orden, setOrden] = useState(searchParams.get("orden") || "recientes");
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);

    const page = Math.max(1, Number(searchParams.get("page") || "1"));

    const { datos: data, cargando: loading, error } = useFetchJson<SimulacionResponse>(
        `/api/admin/anti-abuso/simulacion-score?${searchParams.toString()}`
    );

    useEffect(() => {
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json())
            .then((json) => setPlataformas(json.plataformas || []))
            .catch(() => setPlataformas([]));
    }, []);

    const buildQueryString = useCallback(
        (override: Record<string, string> = {}) => {
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (nivel) params.set("nivel", nivel);
            if (plataformaId) params.set("plataformaId", plataformaId);
            if (orden && orden !== "recientes") params.set("orden", orden);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [q, nivel, plataformaId, orden, page]
    );

    const aplicarFiltros = (override: Record<string, string> = {}) => {
        router.push(`${pathname}?${buildQueryString({ page: "1", ...override })}`);
    };

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

    const plataformaOpciones = [
        { value: "", label: "Todas las plataformas" },
        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
    ];

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 id="anti-abuso-title" className="text-2xl font-bold text-body">Anti-abuso</h1>
                    <p className="mt-1 text-sm text-muted">
                        Simulación en seco del ajuste de score por señal de fuente.
                        El feature flag sigue desactivado; esta vista no altera datos.
                    </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-tinta/5 px-3 py-1 text-xs font-medium text-muted ring-1 ring-tinta/10">
                    Flag: scoring.source_weight.enabled = false
                </span>
            </div>

            <div className="glass rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                        <Input
                            label="Buscar"
                            type="text"
                            placeholder="Identificador (mín. 3 caracteres)"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    aplicarFiltros();
                                }
                            }}
                        />
                    </div>
                    <Select
                        label="Nivel de riesgo"
                        options={NIVEL_OPCIONES}
                        value={nivel}
                        onChange={(e) => {
                            setNivel(e.target.value);
                            aplicarFiltros({ nivel: e.target.value });
                        }}
                    />
                    <Select
                        label="Plataforma"
                        options={plataformaOpciones}
                        value={plataformaId}
                        onChange={(e) => {
                            setPlataformaId(e.target.value);
                            aplicarFiltros({ plataformaId: e.target.value });
                        }}
                    />
                    <Select
                        label="Ordenar por"
                        options={ORDEN_OPCIONES}
                        value={orden}
                        onChange={(e) => {
                            setOrden(e.target.value);
                            aplicarFiltros({ orden: e.target.value });
                        }}
                    />
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={() => aplicarFiltros()}>Aplicar filtros</Button>
                </div>
            </div>

            {error && !data && (
                <ErrorState
                    title="No pudimos cargar la simulación"
                    description="Ocurrió un problema al consultar los datos. Intenta recargar la página."
                    onRetry={() => window.location.reload()}
                />
            )}

            {!data && !error && (
                <div className="glass rounded-2xl p-6">
                    <Cargando texto="Cargando simulación..." />
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <TarjetaMetrica disposicion="panel" label="Identificadores analizados" value={data.pagination.total} />
                        <TarjetaMetrica disposicion="panel" label="Subidas de nivel" value={data.resumen.subidas} tone="up" />
                        <TarjetaMetrica disposicion="panel" label="Bajadas de nivel" value={data.resumen.bajadas} tone="down" />
                        <TarjetaMetrica disposicion="panel" label="Sin cambio" value={data.resumen.sinCambio} />
                    </div>

                    <div className="glass rounded-2xl p-6">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold text-body">Comparación score actual vs. ajustado</h2>
                            {/* El contenido previo permanece mientras carga la nueva página (sin parpadeo). */}
                            {loading && <Cargando inline tamano="sm" texto="Actualizando..." />}
                        </div>
                        <Tabla sinContenedor>
                            <TablaHead>
                                <tr>
                                    <th className="px-4 py-3 font-medium">Identificador</th>
                                    <th className="px-4 py-3 font-medium">Plataforma</th>
                                    <th className="px-4 py-3 font-medium">Reportes</th>
                                    <th className="px-4 py-3 font-medium">Peso anónimo</th>
                                    <th className="px-4 py-3 font-medium">Peso autenticado</th>
                                    <th className="px-4 py-3 font-medium">Score actual</th>
                                    <th className="px-4 py-3 font-medium">Score ajustado</th>
                                    <th className="px-4 py-3 font-medium">Nivel actual</th>
                                    <th className="px-4 py-3 font-medium">Nivel ajustado</th>
                                    <th className="px-4 py-3 font-medium">Cambio</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {data.detalles.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-2">
                                            <EmptyState
                                                title="No hay identificadores que coincidan"
                                                description="Prueba ajustar los filtros o vuelve más tarde."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    data.detalles.map((row) => (
                                        <tr key={`${row.identificador}-${row.plataformaNombre}`}>
                                            <td className="px-4 py-3 font-mono text-body">{row.identificador}</td>
                                            <td className="px-4 py-3 text-body">{row.plataformaNombre}</td>
                                            <td className="px-4 py-3 text-body">
                                                {row.totalReportes}
                                                <span className="ml-2 text-xs text-muted">
                                                    ({row.reportesAnonimos}A / {row.reportesAutenticados}Auth)
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-body">{row.pesoAnonimoPromedio.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-body">{row.pesoAutenticadoPromedio.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-body">{row.score}</td>
                                            <td className="px-4 py-3 text-body">{row.scoreAjustado}</td>
                                            <td className="px-4 py-3">
                                                <NivelBadge nivel={row.nivelActual} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <NivelBadge nivel={row.nivelAjustado} />
                                            </td>
                                            <td className="px-4 py-3">
                                                {row.cambioNivel === 0 ? (
                                                    <span className="text-subtle">—</span>
                                                ) : (
                                                    <span className={`font-semibold ${row.cambioNivel > 0 ? "text-rubi" : "text-pino"}`}>
                                                        {row.cambioNivel > 0 ? `▲ ${row.cambioNivel}` : `▼ ${Math.abs(row.cambioNivel)}`}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </TablaBody>
                        </Tabla>

                        {data.pagination.totalPages > 1 && (
                            <div className="mt-4 flex flex-col gap-3 border-t border-tinta/10 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-subtle">
                                    Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} identificadores
                                </p>
                                <div className="flex gap-2">
                                    <Button onClick={() => goToPage(page - 1)} disabled={page <= 1} variant="outline">
                                        Anterior
                                    </Button>
                                    <Button
                                        onClick={() => goToPage(page + 1)}
                                        disabled={page >= data.pagination.totalPages}
                                        variant="outline"
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

function NivelBadge({ nivel }: { nivel: NivelRiesgo }) {
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${NIVEL_COLORS[nivel]}`}>
            {NIVEL_LABELS[nivel]}
        </span>
    );
}
