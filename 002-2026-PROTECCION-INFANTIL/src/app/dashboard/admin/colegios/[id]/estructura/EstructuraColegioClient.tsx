"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cargando } from "@/components/ui/Cargando";

/**
 * SPEC-141 (N-1, FR-005): estructura del colegio (cursos → alumnos con
 * identificadores) en SOLO LECTURA (soporte). Sin controles de edición; las
 * mutaciones siguen siendo exclusivas del SCHOOL_ADMIN.
 */

const PAGE_SIZE = 25;

type Curso = {
    id: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
    alumnos: number;
};

type IdentificadorAlumno = {
    id: string;
    tipo: string;
    valor: string;
    plataforma: { id: string; clave: string; nombre: string } | null;
    etiquetaRelacion: string;
};

type Alumno = {
    id: string;
    nombre: string;
    estado: string;
    identificadores: IdentificadorAlumno[];
};

type Paginacion = { page: number; pageSize: number; total: number; totalPages: number };

export default function EstructuraColegioClient({ colegioId }: { colegioId: string }) {
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [loadingCursos, setLoadingCursos] = useState(true);
    const [error, setError] = useState("");
    const [cursoAbierto, setCursoAbierto] = useState<string | null>(null);
    const [alumnos, setAlumnos] = useState<Alumno[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loadingAlumnos, setLoadingAlumnos] = useState(false);

    const cargarCursos = useCallback(async () => {
        setLoadingCursos(true);
        try {
            const res = await fetch(`/api/admin/colegios/${colegioId}/cursos`, { credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    typeof json?.error?.message === "string" ? json.error.message : "No se pudieron cargar los cursos"
                );
            }
            setCursos(json.cursos ?? []);
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudieron cargar los cursos");
        } finally {
            setLoadingCursos(false);
        }
    }, [colegioId]);

    useEffect(() => {
        cargarCursos();
    }, [cargarCursos]);

    const cargarAlumnos = useCallback(
        async (cursoId: string, page: number) => {
            setLoadingAlumnos(true);
            try {
                const res = await fetch(
                    `/api/admin/colegios/${colegioId}/cursos/${cursoId}/alumnos?page=${page}&pageSize=${PAGE_SIZE}`,
                    { credentials: "include" }
                );
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(
                        typeof json?.error?.message === "string" ? json.error.message : "No se pudieron cargar los alumnos"
                    );
                }
                setAlumnos(json.items ?? []);
                setPaginacion(json.pagination ?? { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
            } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudieron cargar los alumnos");
            } finally {
                setLoadingAlumnos(false);
            }
        },
        [colegioId]
    );

    const alternarCurso = (cursoId: string) => {
        if (cursoAbierto === cursoId) {
            setCursoAbierto(null);
            setAlumnos([]);
            return;
        }
        setCursoAbierto(cursoId);
        cargarAlumnos(cursoId, 1);
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">Estructura del colegio</h1>
                    <p className="text-sm text-muted">
                        Vista de soporte: cursos y alumnos con sus identificadores, tal como los cargó el colegio.
                    </p>
                </div>
                <Badge variant="warning">Solo lectura</Badge>
            </div>

            <div>
                <Link href="/dashboard/admin/colegios" className="text-sm text-accent hover:underline">
                    ← Volver a colegios
                </Link>
            </div>

            {error && (
                <GlassCard className="p-4">
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
                </GlassCard>
            )}

            {loadingCursos ? (
                <Cargando inline texto="Cargando cursos..." className="py-8" />
            ) : cursos.length === 0 ? (
                <EmptyState
                    title="El colegio no tiene cursos registrados"
                    description="Cuando el colegio cargue su estructura, los cursos aparecerán aquí."
                />
            ) : (
                <div className="space-y-3">
                    {cursos.map((curso) => (
                        <GlassCard key={curso.id} className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-sm font-semibold text-body">{curso.nombre}</h2>
                                    {curso.grado && <Badge variant="neutral">Grado {curso.grado}</Badge>}
                                    {curso.anioLectivo && <Badge variant="neutral">Año {curso.anioLectivo}</Badge>}
                                    {curso.estado !== "activo" && <Badge variant="neutral">Inactivo</Badge>}
                                    <span className="text-xs text-muted">{curso.alumnos} alumnos</span>
                                </div>
                                <Button
                                    variant="outline"
                                    className="px-3 py-1.5 text-xs"
                                    onClick={() => alternarCurso(curso.id)}
                                >
                                    {cursoAbierto === curso.id ? "Ocultar alumnos" : "Ver alumnos"}
                                </Button>
                            </div>

                            {cursoAbierto === curso.id && (
                                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                                    {loadingAlumnos ? (
                                        <Cargando inline texto="Cargando alumnos..." className="py-4" />
                                    ) : alumnos.length === 0 ? (
                                        <p className="text-sm text-muted">El curso no tiene alumnos registrados.</p>
                                    ) : (
                                        <>
                                            <ul className="space-y-2">
                                                {alumnos.map((alumno) => (
                                                    <li key={alumno.id} className="text-sm text-body">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span>{alumno.nombre}</span>
                                                            {alumno.estado !== "activo" && (
                                                                <Badge variant="neutral">Inactivo</Badge>
                                                            )}
                                                        </div>
                                                        {alumno.identificadores.length > 0 && (
                                                            <ul className="ml-4 mt-1 space-y-1">
                                                                {alumno.identificadores.map((i) => (
                                                                    <li key={i.id} className="flex flex-wrap items-center gap-2">
                                                                        <span className="font-mono text-xs">{i.valor}</span>
                                                                        <span className="text-xs text-muted">
                                                                            {i.tipo}
                                                                            {i.plataforma ? ` · ${i.plataforma.nombre}` : ""}
                                                                            {` · ${i.etiquetaRelacion}`}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="mt-3 flex items-center justify-between text-xs text-muted">
                                                <span>
                                                    Página {paginacion.page} de {Math.max(paginacion.totalPages, 1)} ·{" "}
                                                    {paginacion.total} alumnos
                                                </span>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="px-3 py-1.5 text-xs"
                                                        disabled={paginacion.page <= 1 || loadingAlumnos}
                                                        onClick={() => cargarAlumnos(curso.id, paginacion.page - 1)}
                                                    >
                                                        Anterior
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="px-3 py-1.5 text-xs"
                                                        disabled={paginacion.page >= paginacion.totalPages || loadingAlumnos}
                                                        onClick={() => cargarAlumnos(curso.id, paginacion.page + 1)}
                                                    >
                                                        Siguiente
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}
