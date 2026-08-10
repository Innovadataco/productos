"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";

type ComparativaGrupo = {
    grupo: string;
    cursos: number;
    estudiantes: number;
    identificadores: number;
    alertas: number;
    promedioEstudiantes: number;
};

type Comparativa = {
    colegioId: string;
    colegioNombre: string;
    agruparPor: "grado" | "anioLectivo";
    grupos: ComparativaGrupo[];
    totales: {
        cursos: number;
        estudiantes: number;
        identificadores: number;
        alertas: number;
    };
};

const OPCIONES_CRITERIO = [
    { value: "grado", label: "Grado" },
    { value: "anioLectivo", label: "Año lectivo" },
];

export default function ComparativaCursosPage() {
    const [comparativa, setComparativa] = useState<Comparativa | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [criterio, setCriterio] = useState<"grado" | "anioLectivo">("grado");
    const [descargando, setDescargando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/analisis/comparativa?agruparPor=${criterio}`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando comparativa");
                setComparativa(null);
                return;
            }
            setComparativa(data);
        } catch {
            setError("Error de red cargando comparativa");
            setComparativa(null);
        } finally {
            setCargando(false);
        }
    }, [criterio]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const descargarExcel = async () => {
        setDescargando(true);
        try {
            const res = await fetch(`/api/colegio/analisis/comparativa/excel?agruparPor=${criterio}`, {
                credentials: "include",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error?.message || "Error generando Excel");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const filename = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "comparativa.xlsx";
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Error de red descargando Excel");
        } finally {
            setDescargando(false);
        }
    };

    if (cargando) return <Cargando texto="Cargando comparativa..." />;
    if (error) return <ErrorState title="No pudimos cargar la comparativa" description={error} onRetry={cargar} />;
    if (!comparativa || comparativa.grupos.length === 0) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-body">Comparativa entre cursos</h1>
                <EmptyState
                    title="Sin datos para comparar"
                    description="No hay cursos activos en el colegio todavía. Crea cursos y vuelve a consultar."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">Comparativa entre cursos</h1>
                    <p className="text-subtle">Datos agregados por {criterio === "grado" ? "grado" : "año lectivo"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        label="Agrupar por"
                        options={OPCIONES_CRITERIO}
                        value={criterio}
                        onChange={(e) => setCriterio(e.target.value as "grado" | "anioLectivo")}
                        className="w-44"
                    />
                    <Button onClick={descargarExcel} isLoading={descargando}>
                        Exportar Excel
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <GlassCard>
                    <p className="text-sm text-subtle">Cursos</p>
                    <p className="text-2xl font-bold text-body">{comparativa.totales.cursos}</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-subtle">Estudiantes</p>
                    <p className="text-2xl font-bold text-body">{comparativa.totales.estudiantes}</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-subtle">Identificadores</p>
                    <p className="text-2xl font-bold text-body">{comparativa.totales.identificadores}</p>
                </GlassCard>
                <GlassCard>
                    <p className="text-sm text-subtle">Alertas</p>
                    <p className="text-2xl font-bold text-body">{comparativa.totales.alertas}</p>
                </GlassCard>
            </div>

            <Tabla aria-label="Comparativa de cursos">
                <TablaHead>
                    <tr>
                        <th className="px-4 py-3 font-semibold">Grupo</th>
                        <th className="px-4 py-3 font-semibold text-right">Cursos</th>
                        <th className="px-4 py-3 font-semibold text-right">Estudiantes</th>
                        <th className="px-4 py-3 font-semibold text-right">Identificadores</th>
                        <th className="px-4 py-3 font-semibold text-right">Alertas</th>
                        <th className="px-4 py-3 font-semibold text-right">Prom. estudiantes/curso</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {comparativa.grupos.map((grupo) => (
                        <tr key={grupo.grupo}>
                            <td className="px-4 py-3">{grupo.grupo}</td>
                            <td className="px-4 py-3 text-right">{grupo.cursos}</td>
                            <td className="px-4 py-3 text-right">{grupo.estudiantes}</td>
                            <td className="px-4 py-3 text-right">{grupo.identificadores}</td>
                            <td className="px-4 py-3 text-right">{grupo.alertas}</td>
                            <td className="px-4 py-3 text-right">{grupo.promedioEstudiantes}</td>
                        </tr>
                    ))}
                </TablaBody>
            </Tabla>
        </div>
    );
}
