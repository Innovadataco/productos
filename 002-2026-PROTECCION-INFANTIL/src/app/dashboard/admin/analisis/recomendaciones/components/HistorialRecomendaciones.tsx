"use client";

/**
 * SPEC-227 (002-PI-128, FR-009/010): tabla filtrable del historial de
 * sugerencias + KPIs de tuning + bloque "Por regla" + export CSV.
 * Terminología del brief §3: "Sugerencia", "Pendiente/Aplicada/Ignorada/
 * Expirada", "Regla". Tono neutral, sin voseo. Solo lectura: la resolución
 * de sugerencias ocurre en el panel de SPEC-221/226, no aquí.
 * Semáforo: pino (sana), ambar (pendiente/atención), rubi (tasa de ignorada
 * sobre el umbral → "revisar umbral").
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

export interface ReglaFiltro {
    id: string;
    clave: string;
    nombre: string;
    categoria: string;
}

interface ItemHistorial {
    id: string;
    titulo: string;
    regla: { id: string; clave: string; nombre: string };
    categoria: string;
    prioridad: number;
    estado: string;
    generadaEn: string;
    resueltaEn: string | null;
    ejecutadaAutomatica: boolean;
    sujetoTipo: string | null;
    sujetoId: string | null;
}

interface MetricasPorRegla {
    reglaId: string;
    reglaClave: string;
    reglaNombre: string;
    totalGeneradas: number;
    tasaAplicacionPct: number | null;
    tasaIgnoradaPct: number | null;
    tasaExpiradaPct: number | null;
    tiempoPromedioResolucionHoras: number | null;
    sobreUmbralAlerta: boolean;
}

interface MetricasHistorial {
    totalGeneradas: number;
    totalResueltas: number;
    pendientes: number;
    tasaAplicacionPct: number | null;
    tasaIgnoradaPct: number | null;
    tasaExpiradaPct: number | null;
    tiempoPromedioResolucionHoras: number | null;
    umbralAlertaIgnoradaPct: number;
    porRegla: MetricasPorRegla[];
}

interface RespuestaLista {
    items: ItemHistorial[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const ESTADOS = [
    { valor: "PENDIENTE", etiqueta: "Pendiente" },
    { valor: "APLICADA", etiqueta: "Aplicada" },
    { valor: "IGNORADA", etiqueta: "Ignorada" },
    { valor: "EXPIRADA", etiqueta: "Expirada" },
] as const;

const ETIQUETA_ESTADO: Record<string, string> = Object.fromEntries(
    ESTADOS.map((e) => [e.valor, e.etiqueta])
);

const CLASES_BADGE_ESTADO: Record<string, string> = {
    PENDIENTE: "bg-ambar/15 text-ambar",
    APLICADA: "bg-pino/15 text-pino",
    IGNORADA: "bg-rubi/15 text-rubi",
    EXPIRADA: "bg-tinta/10 text-muted",
};

const FILTROS_VACIOS = {
    estado: "",
    reglaId: "",
    categoria: "",
    sujetoTipo: "",
    sujetoId: "",
    ejecutadaAutomatica: "",
    desde: "",
    hasta: "",
};

type Filtros = typeof FILTROS_VACIOS;

function construirQueryString(filtros: Filtros, page?: number): string {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
        if (valor !== "") params.set(clave, valor);
    }
    if (page !== undefined) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

function formatearPct(valor: number | null): string {
    return valor === null ? "—" : `${valor}%`;
}

function formatearHoras(valor: number | null): string {
    return valor === null ? "—" : `${valor} h`;
}

export function HistorialRecomendaciones({ reglas }: { reglas: ReglaFiltro[] }) {
    const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
    const [page, setPage] = useState(1);
    const [lista, setLista] = useState<RespuestaLista | null>(null);
    const [metricas, setMetricas] = useState<MetricasHistorial | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const categorias = useMemo(
        () => [...new Set(reglas.map((r) => r.categoria))].sort(),
        [reglas]
    );

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const qsLista = construirQueryString(filtros, page);
            const qsMetricas = construirQueryString(filtros);
            const [resLista, resMetricas] = await Promise.all([
                fetch(`/api/admin/analisis/recomendaciones${qsLista}`, { credentials: "include" }),
                fetch(`/api/admin/analisis/recomendaciones/metricas${qsMetricas}`, { credentials: "include" }),
            ]);
            if (!resLista.ok || !resMetricas.ok) {
                setError("No se pudo cargar el historial. Intenta de nuevo.");
                setLista(null);
                setMetricas(null);
                return;
            }
            setLista((await resLista.json()) as RespuestaLista);
            setMetricas((await resMetricas.json()) as MetricasHistorial);
        } catch {
            setError("No se pudo cargar el historial. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    }, [filtros, page]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function actualizarFiltro(clave: keyof Filtros, valor: string) {
        setPage(1);
        setFiltros((prev) => ({ ...prev, [clave]: valor }));
    }

    function limpiarFiltros() {
        setPage(1);
        setFiltros(FILTROS_VACIOS);
    }

    const urlExport = `/api/admin/analisis/recomendaciones/export${construirQueryString(filtros)}`;
    const paginacion = lista?.pagination;

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <section aria-label="Filtros" className="glass rounded-2xl p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                        label="Regla"
                        value={filtros.reglaId}
                        onChange={(e) => actualizarFiltro("reglaId", e.target.value)}
                        options={[
                            { value: "", label: "Todas las reglas" },
                            ...reglas.map((r) => ({ value: r.id, label: r.nombre })),
                        ]}
                    />
                    <Select
                        label="Estado"
                        value={filtros.estado}
                        onChange={(e) => actualizarFiltro("estado", e.target.value)}
                        options={[
                            { value: "", label: "Todos los estados" },
                            ...ESTADOS.map((e) => ({ value: e.valor, label: e.etiqueta })),
                        ]}
                    />
                    <Select
                        label="Categoría"
                        value={filtros.categoria}
                        onChange={(e) => actualizarFiltro("categoria", e.target.value)}
                        options={[
                            { value: "", label: "Todas las categorías" },
                            ...categorias.map((c) => ({ value: c, label: c })),
                        ]}
                    />
                    <Select
                        label="Ejecución"
                        value={filtros.ejecutadaAutomatica}
                        onChange={(e) => actualizarFiltro("ejecutadaAutomatica", e.target.value)}
                        options={[
                            { value: "", label: "Todas" },
                            { value: "true", label: "Ejecutada sola" },
                            { value: "false", label: "Sugerida al equipo" },
                        ]}
                    />
                    <Select
                        label="Tipo de cliente"
                        value={filtros.sujetoTipo}
                        onChange={(e) => actualizarFiltro("sujetoTipo", e.target.value)}
                        options={[
                            { value: "", label: "Todos" },
                            { value: "Suscripcion", label: "Suscripción" },
                            { value: "Colegio", label: "Colegio" },
                            { value: "Usuario", label: "Usuario" },
                        ]}
                    />
                    <Input
                        label="Cliente (identificador)"
                        value={filtros.sujetoId}
                        onChange={(e) => actualizarFiltro("sujetoId", e.target.value)}
                        placeholder="Identificador de suscripción o colegio"
                    />
                    <Input
                        label="Desde"
                        type="date"
                        value={filtros.desde}
                        onChange={(e) => actualizarFiltro("desde", e.target.value)}
                    />
                    <Input
                        label="Hasta"
                        type="date"
                        value={filtros.hasta}
                        onChange={(e) => actualizarFiltro("hasta", e.target.value)}
                    />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={limpiarFiltros}>
                        Limpiar filtros
                    </Button>
                    <a
                        href={urlExport}
                        download
                        className="inline-flex items-center rounded-xl bg-ambar px-4 py-2 text-sm font-semibold text-white transition hover:bg-ambar/90"
                    >
                        Exportar CSV
                    </a>
                    <span className="text-xs text-subtle">
                        El CSV no incluye datos personales: el cliente viaja como identificador opaco.
                    </span>
                </div>
            </section>

            {error && <Alerta tono="error">{error}</Alerta>}

            {/* KPIs globales */}
            {metricas && (
                <section aria-label="Métricas del conjunto filtrado" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <article className="glass rounded-2xl p-6" data-testid="kpi-total">
                        <p className="text-sm font-medium text-muted">Sugerencias generadas</p>
                        <p className="mt-2 text-3xl font-bold text-body">{metricas.totalGeneradas}</p>
                        <p className="mt-1 text-xs text-subtle">{metricas.pendientes} pendientes</p>
                    </article>
                    <article className="glass rounded-2xl p-6" data-testid="kpi-tasa-aplicacion">
                        <p className="text-sm font-medium text-muted">Tasa de aplicación</p>
                        <p className="mt-2 text-3xl font-bold text-pino">{formatearPct(metricas.tasaAplicacionPct)}</p>
                        <p className="mt-1 text-xs text-subtle">sobre {metricas.totalResueltas} resueltas</p>
                    </article>
                    <article className="glass rounded-2xl p-6" data-testid="kpi-tasa-ignorada">
                        <p className="text-sm font-medium text-muted">Tasa de ignorada</p>
                        <p
                            className={`mt-2 text-3xl font-bold ${
                                metricas.tasaIgnoradaPct !== null &&
                                metricas.tasaIgnoradaPct > metricas.umbralAlertaIgnoradaPct
                                    ? "text-rubi"
                                    : "text-body"
                            }`}
                        >
                            {formatearPct(metricas.tasaIgnoradaPct)}
                        </p>
                        <p className="mt-1 text-xs text-subtle">
                            alerta sobre {metricas.umbralAlertaIgnoradaPct}%
                        </p>
                    </article>
                    <article className="glass rounded-2xl p-6" data-testid="kpi-tiempo-promedio">
                        <p className="text-sm font-medium text-muted">Tiempo promedio de resolución</p>
                        <p className="mt-2 text-3xl font-bold text-body">
                            {formatearHoras(metricas.tiempoPromedioResolucionHoras)}
                        </p>
                        <p className="mt-1 text-xs text-subtle">de generada a resuelta</p>
                    </article>
                </section>
            )}

            {/* Por regla */}
            {metricas && metricas.porRegla.length > 0 && (
                <section aria-label="Métricas por regla" data-testid="bloque-por-regla">
                    <h3 className="mb-2 text-sm font-semibold text-body">Por regla</h3>
                    <Tabla aria-label="Métricas por regla">
                        <TablaHead>
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold">Regla</th>
                                <th className="px-4 py-3 text-xs font-semibold">Generadas</th>
                                <th className="px-4 py-3 text-xs font-semibold">% aplicada</th>
                                <th className="px-4 py-3 text-xs font-semibold">% ignorada</th>
                                <th className="px-4 py-3 text-xs font-semibold">% expirada</th>
                                <th className="px-4 py-3 text-xs font-semibold">Resolución prom.</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {metricas.porRegla.map((fila) => (
                                <tr
                                    key={fila.reglaId}
                                    className={fila.sobreUmbralAlerta ? "bg-rubi/10" : undefined}
                                    data-testid={fila.sobreUmbralAlerta ? "fila-regla-alerta" : undefined}
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-body">{fila.reglaNombre}</span>
                                        {fila.sobreUmbralAlerta && (
                                            <span className="ml-2 rounded-full bg-rubi/15 px-2 py-0.5 text-xs font-semibold text-rubi">
                                                revisar umbral
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-muted">{fila.totalGeneradas}</td>
                                    <td className="px-4 py-3 text-pino">{formatearPct(fila.tasaAplicacionPct)}</td>
                                    <td className="px-4 py-3 text-muted">{formatearPct(fila.tasaIgnoradaPct)}</td>
                                    <td className="px-4 py-3 text-muted">{formatearPct(fila.tasaExpiradaPct)}</td>
                                    <td className="px-4 py-3 text-muted">
                                        {formatearHoras(fila.tiempoPromedioResolucionHoras)}
                                    </td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                </section>
            )}

            {/* Tabla del historial */}
            {cargando ? (
                <Cargando texto="Cargando historial..." />
            ) : lista && lista.items.length === 0 ? (
                <p className="glass rounded-2xl p-6 text-center text-sm text-muted">
                    No hay sugerencias para los filtros seleccionados.
                </p>
            ) : lista ? (
                <div data-testid="tabla-sugerencias">
                    <Tabla aria-label="Historial de sugerencias">
                        <TablaHead>
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold">Sugerencia</th>
                                <th className="px-4 py-3 text-xs font-semibold">Regla</th>
                                <th className="px-4 py-3 text-xs font-semibold">Categoría</th>
                                <th className="px-4 py-3 text-xs font-semibold">Prioridad</th>
                                <th className="px-4 py-3 text-xs font-semibold">Estado</th>
                                <th className="px-4 py-3 text-xs font-semibold">Generada</th>
                                <th className="px-4 py-3 text-xs font-semibold">Resuelta</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {lista.items.map((item) => (
                                <tr key={item.id}>
                                    <td className="max-w-xs px-4 py-3">
                                        <span className="block truncate font-medium text-body" title={item.titulo}>
                                            {item.titulo}
                                        </span>
                                        <span className="block text-xs text-subtle">
                                            {item.sujetoId
                                                ? `${item.sujetoTipo ?? "Sujeto"} · ${item.sujetoId.slice(0, 8)}…`
                                                : "Sujeto no disponible"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-muted">{item.regla.nombre}</td>
                                    <td className="px-4 py-3 text-muted">{item.categoria}</td>
                                    <td className="px-4 py-3 text-muted">{item.prioridad}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                CLASES_BADGE_ESTADO[item.estado] ?? "bg-tinta/10 text-muted"
                                            }`}
                                        >
                                            {ETIQUETA_ESTADO[item.estado] ?? item.estado}
                                        </span>
                                        {item.ejecutadaAutomatica && (
                                            <span className="ml-1 rounded-full bg-cielo/15 px-2 py-0.5 text-xs font-semibold text-cielo">
                                            ejecutada sola
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-muted">{formatoFechaHoraBogota(item.generadaEn)}</td>
                                    <td className="px-4 py-3 text-muted">
                                        {item.resueltaEn ? formatoFechaHoraBogota(item.resueltaEn) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                </div>
            ) : null}

            {/* Paginación */}
            {paginacion && paginacion.total > 0 && (
                <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
                    <span className="text-muted">
                        Página {paginacion.page} de {Math.max(1, paginacion.totalPages)} · {paginacion.total}{" "}
                        sugerencias
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            disabled={page >= paginacion.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Siguiente
                        </Button>
                    </div>
                </nav>
            )}
        </div>
    );
}
