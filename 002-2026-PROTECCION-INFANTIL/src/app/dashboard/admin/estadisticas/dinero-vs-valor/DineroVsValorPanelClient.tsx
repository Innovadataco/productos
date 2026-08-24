"use client";

/**
 * SPEC-222 (002-PI-123): orquestador cliente del panel principal Análisis
 * (Dinero vs Valor). Estado de filtros y drill-down en el querystring
 * (FR-017): sobrevive a cambios de granularidad, drill y se puede compartir
 * por URL. Los 5 bloques cargan en paralelo con estados de error
 * independientes (§3.1 del research).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cargando } from "@/components/ui/Cargando";
import { FiltrosGlobales } from "./components/FiltrosGlobales";
import { TopDecisiones } from "./components/TopDecisiones";
import { KpiTiles } from "./components/KpiTiles";
import { MatrizDispersion } from "./components/MatrizDispersion";
import { TablaGranularidad } from "./components/TablaGranularidad";
import { PanelAnomalias } from "./components/PanelAnomalias";
import type {
    AnomaliasRespuesta,
    DineroVsValorRespuesta,
    DispersionRespuesta,
    FilaGranularidad,
    Granularidad,
    KpisRespuesta,
    TopDecision,
} from "./components/tipos";

const API = "/api/admin/analisis";

interface Bloque<T> {
    data: T | null;
    cargando: boolean;
    error: string | null;
}

function bloqueInicial<T>(): Bloque<T> {
    return { data: null, cargando: true, error: null };
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
        const cuerpo: unknown = await res.json().catch(() => null);
        const mensaje =
            typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo
                ? String((cuerpo as { error: { message?: string } }).error?.message ?? "Error al cargar")
                : "Error al cargar";
        throw new Error(mensaje);
    }
    return (await res.json()) as T;
}

export function DineroVsValorPanelClient() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Estado de la vista derivado del querystring (fuente de verdad, FR-017).
    const vista = useMemo(() => {
        const get = (k: string) => searchParams.get(k) ?? undefined;
        return {
            granularidad: (get("granularidad") ?? "pais") as Granularidad,
            periodo: get("periodo") ?? "mes",
            desde: get("desde"),
            hasta: get("hasta"),
            estado: get("estado") ?? "todas",
            tipoTitular: get("tipoTitular") ?? "ambos",
            paisId: get("paisId"),
            ciudadId: get("ciudadId"),
            colegioId: get("colegioId"),
            page: Number(get("page") ?? "1") || 1,
        };
    }, [searchParams]);

    /** Escribe cambios en el querystring conservando el resto (filtros persistentes). */
    const actualizarVista = useCallback(
        (cambios: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [clave, valor] of Object.entries(cambios)) {
                if (valor === null) params.delete(clave);
                else params.set(clave, valor);
            }
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [router, pathname, searchParams]
    );

    const paramsPeriodo = useMemo(() => {
        const p = new URLSearchParams({ periodo: vista.periodo });
        if (vista.periodo === "custom" && vista.desde && vista.hasta) {
            p.set("desde", vista.desde);
            p.set("hasta", vista.hasta);
        }
        return p;
    }, [vista.periodo, vista.desde, vista.hasta]);

    const queryTabla = useMemo(() => {
        const p = new URLSearchParams(paramsPeriodo);
        p.set("granularidad", vista.granularidad);
        p.set("estado", vista.estado);
        p.set("tipoTitular", vista.tipoTitular);
        if (vista.paisId) p.set("paisId", vista.paisId);
        if (vista.ciudadId) p.set("ciudadId", vista.ciudadId);
        if (vista.colegioId) p.set("colegioId", vista.colegioId);
        p.set("page", String(vista.page));
        return p.toString();
    }, [paramsPeriodo, vista]);

    const queryDispersion = useMemo(() => {
        const p = new URLSearchParams(paramsPeriodo);
        p.set("estado", vista.estado);
        p.set("tipoTitular", vista.tipoTitular);
        return p.toString();
    }, [paramsPeriodo, vista]);

    const [top, setTop] = useState<Bloque<TopDecision[]>>(bloqueInicial);
    const [kpis, setKpis] = useState<Bloque<KpisRespuesta>>(bloqueInicial);
    const [dispersion, setDispersion] = useState<Bloque<DispersionRespuesta>>(bloqueInicial);
    const [tabla, setTabla] = useState<Bloque<DineroVsValorRespuesta>>(bloqueInicial);
    const [anomalias, setAnomalias] = useState<Bloque<AnomaliasRespuesta>>(bloqueInicial);

    const cargarTop = useCallback(async () => {
        setTop((prev) => ({ ...prev, cargando: true, error: null }));
        try {
            const res = await fetchJson<{ items: TopDecision[] }>(`${API}/top-decisiones`);
            setTop({ data: res.items, cargando: false, error: null });
        } catch (e) {
            setTop({ data: null, cargando: false, error: e instanceof Error ? e.message : "Error al cargar" });
        }
    }, []);

    useEffect(() => {
        void cargarTop();
    }, [cargarTop]);

    useEffect(() => {
        let activo = true;
        const cargar = async <T,>(
            url: string,
            set: React.Dispatch<React.SetStateAction<Bloque<T>>>
        ): Promise<void> => {
            set((prev) => ({ ...prev, cargando: true, error: null }));
            try {
                const data = await fetchJson<T>(url);
                if (activo) set({ data, cargando: false, error: null });
            } catch (e) {
                if (activo) set({ data: null, cargando: false, error: e instanceof Error ? e.message : "Error" });
            }
        };
        void cargar<KpisRespuesta>(`${API}/kpis?${paramsPeriodo.toString()}`, setKpis);
        void cargar<DispersionRespuesta>(`${API}/dispersion?${queryDispersion}`, setDispersion);
        void cargar<DineroVsValorRespuesta>(`${API}/dinero-vs-valor?${queryTabla}`, setTabla);
        void cargar<AnomaliasRespuesta>(`${API}/anomalias?pageSize=10`, setAnomalias);
        return () => {
            activo = false;
        };
    }, [paramsPeriodo, queryDispersion, queryTabla]);

    /** Resuelve una recomendación; ante 409 igual refresca el Top 5 (Edge Case). */
    const resolver = useCallback(
        async (id: string, accion: "APLICADA" | "IGNORADA") => {
            try {
                await fetch(`${API}/recomendaciones/${id}/resolver`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ accion }),
                });
            } finally {
                await cargarTop();
            }
        },
        [cargarTop]
    );

    /** Drill-down: baja un nivel con los params de la fila o va a la vista cliente. */
    const navegarFila = useCallback(
        (fila: FilaGranularidad) => {
            if (fila.drill) {
                actualizarVista({
                    granularidad: fila.drill.granularidad,
                    paisId: fila.drill.params.paisId ?? null,
                    ciudadId: fila.drill.params.ciudadId ?? null,
                    colegioId: null,
                    page: null,
                });
                return;
            }
            if (fila.suscripcionId) {
                router.push(`/dashboard/admin/pagos/cliente/${fila.suscripcionId}`);
            }
        },
        [actualizarVista, router]
    );

    const navegarCliente = useCallback(
        (suscripcionId: string) => router.push(`/dashboard/admin/pagos/cliente/${suscripcionId}`),
        [router]
    );

    return (
        <div className="space-y-6">
            <TopDecisiones bloque={top} onResolver={resolver} />

            <FiltrosGlobales vista={vista} onCambiar={actualizarVista} />

            {kpis.cargando && !kpis.data ? (
                <Cargando texto="Cargando KPIs..." />
            ) : kpis.error ? (
                <p className="text-sm text-muted">No se pudieron cargar los KPIs: {kpis.error}</p>
            ) : kpis.data ? (
                <KpiTiles data={kpis.data} />
            ) : null}

            {dispersion.cargando && !dispersion.data ? (
                <Cargando texto="Cargando matriz..." />
            ) : dispersion.error ? (
                <p className="text-sm text-muted">No se pudo cargar la matriz: {dispersion.error}</p>
            ) : dispersion.data ? (
                <MatrizDispersion data={dispersion.data} onNavegarCliente={navegarCliente} />
            ) : null}

            {tabla.cargando && !tabla.data ? (
                <Cargando texto="Cargando agregados..." />
            ) : tabla.error ? (
                <p className="text-sm text-muted">No se pudieron cargar los agregados: {tabla.error}</p>
            ) : tabla.data ? (
                <TablaGranularidad
                    data={tabla.data}
                    granularidad={vista.granularidad}
                    onCambiarGranularidad={(g) =>
                        actualizarVista({ granularidad: g, paisId: null, ciudadId: null, colegioId: null, page: null })
                    }
                    onNavegarFila={navegarFila}
                    onBreadcrumb={(accion) => {
                        if (accion === "todos") {
                            actualizarVista({ granularidad: "pais", paisId: null, ciudadId: null, colegioId: null, page: null });
                        } else if (accion === "pais" && vista.paisId) {
                            actualizarVista({ granularidad: "ciudad", ciudadId: null, colegioId: null, page: null });
                        } else if (accion === "ciudad" && vista.ciudadId) {
                            actualizarVista({ granularidad: "colegio", colegioId: null, page: null });
                        }
                    }}
                    onPagina={(page) => actualizarVista({ page: String(page) })}
                />
            ) : null}

            {anomalias.cargando && !anomalias.data ? (
                <Cargando texto="Cargando anomalías..." />
            ) : anomalias.error ? (
                <p className="text-sm text-muted">No se pudieron cargar las anomalías: {anomalias.error}</p>
            ) : anomalias.data ? (
                <PanelAnomalias data={anomalias.data} onNavegarCliente={navegarCliente} />
            ) : null}
        </div>
    );
}
