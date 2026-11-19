"use client";

/**
 * SPEC-931 (FORMA Diseño f700b2c2 §3.2) — listado de estudiantes del colegio.
 * Búsqueda por nombre + filtro por curso + paginación, TODO del lado del servidor
 * (`GET /api/colegio/estudiantes`, colegio de la sesión). «Ver» abre el detalle existente con
 * `?desde=estudiantes`, para que su «← Volver» regrese acá y no al curso.
 * Conteo 0 → «—» (tener 0 identificadores no es un error). Vacío real ≠ vacío por filtro.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "@/components/modules/admin/tables/PaginationControls";
import type { EstudianteListadoDTO } from "@/lib/colegio/estudiantes-listado";

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

interface CursoOpcion {
    id: string;
    nombre: string;
}

/** La API exige ≥ 2 letras para buscar; con menos, no se filtra. */
const MIN_BUSQUEDA = 2;
const ESPERA_BUSQUEDA_MS = 300;

/** Href del detalle con el origen, para que su «← Volver» regrese a este listado. */
export function hrefDetalleEstudiante(id: string): string {
    return `/dashboard/colegio/alumnos/${id}?desde=estudiantes`;
}

function Conteo({ n }: { n: number }) {
    return n > 0 ? <span className="text-body">{n}</span> : <span className="text-muted">—</span>;
}

export default function EstudiantesPageClient() {
    const [texto, setTexto] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [cursoId, setCursoId] = useState("");
    const [page, setPage] = useState(1);
    const [cursos, setCursos] = useState<CursoOpcion[]>([]);
    const [items, setItems] = useState<EstudianteListadoDTO[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const ultimaPeticion = useRef(0);

    // La búsqueda espera a que se deje de escribir; cambiarla vuelve a la página 1.
    useEffect(() => {
        const t = setTimeout(() => {
            const limpio = texto.trim();
            setBusqueda(limpio.length >= MIN_BUSQUEDA ? limpio : "");
            setPage(1);
        }, ESPERA_BUSQUEDA_MS);
        return () => clearTimeout(t);
    }, [texto]);

    // Cursos del colegio para el filtro (si fallan, el filtro queda en «Todos los cursos»).
    useEffect(() => {
        fetch("/api/colegio/cursos", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { cursos: [] }))
            .then((data: { cursos?: CursoOpcion[] }) => setCursos(data.cursos ?? []))
            .catch(() => setCursos([]));
    }, []);

    const cargar = useCallback(async () => {
        const id = ++ultimaPeticion.current;
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ page: String(page), pageSize: "25" });
        if (busqueda) params.set("q", busqueda);
        if (cursoId) params.set("cursoId", cursoId);
        try {
            const res = await fetch(`/api/colegio/estudiantes?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (id !== ultimaPeticion.current) return; // llegó tarde: hay una petición más nueva
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando estudiantes");
                return;
            }
            setItems(data.items ?? []);
            setPagination(data.pagination ?? null);
        } catch {
            if (id === ultimaPeticion.current) setError("Error de red cargando estudiantes");
        } finally {
            if (id === ultimaPeticion.current) setLoading(false);
        }
    }, [page, busqueda, cursoId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const hayFiltro = Boolean(busqueda || cursoId);

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <h1 className="text-2xl font-bold text-body">Estudiantes</h1>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="w-full sm:max-w-sm">
                            <Input
                                aria-label="Buscar por nombre"
                                placeholder="Buscar por nombre…"
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-64">
                            <Select
                                aria-label="Filtrar por curso"
                                options={[{ value: "", label: "Todos los cursos" }, ...cursos.map((c) => ({ value: c.id, label: c.nombre }))]}
                                value={cursoId}
                                onChange={(e) => {
                                    setCursoId(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <SkeletonLista />
                    ) : error ? (
                        <ErrorState title="No pudimos cargar los estudiantes" description={error} onRetry={cargar} />
                    ) : items.length === 0 ? (
                        <EmptyState title={hayFiltro ? "Ningún estudiante coincide con la búsqueda." : "No hay estudiantes"} />
                    ) : (
                        <>
                            <Tabla aria-label="Estudiantes del colegio">
                                <TablaHead variante="borde">
                                    <tr className="text-subtle">
                                        <th className="pb-3 pt-4 pl-4 font-medium">Nombre</th>
                                        <th className="pb-3 pt-4 font-medium">Curso</th>
                                        <th className="pb-3 pt-4 font-medium">Identificadores</th>
                                        <th className="pb-3 pt-4 font-medium">Acudientes</th>
                                        <th className="pb-3 pt-4 pr-4 text-right font-medium">
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </TablaHead>
                                <TablaBody>
                                    {items.map((e) => (
                                        <tr key={e.id} className="align-top">
                                            <td className="py-3 pl-4 pr-3 font-medium text-body">{e.nombre}</td>
                                            <td className="py-3 pr-3 text-muted">{e.curso.nombre}</td>
                                            <td className="py-3 pr-3">
                                                <Conteo n={e.identificadoresActivos} />
                                            </td>
                                            <td className="py-3 pr-3">
                                                <Conteo n={e.acudientes} />
                                            </td>
                                            <td className="py-3 pr-4 text-right">
                                                <a
                                                    href={hrefDetalleEstudiante(e.id)}
                                                    aria-label={`Ver a ${e.nombre}`}
                                                    className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-tinta/5 px-3 text-xs font-semibold text-body transition-all duration-200 hover:bg-tinta/10"
                                                >
                                                    Ver
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </TablaBody>
                            </Tabla>
                            {pagination && pagination.totalPages > 1 && (
                                <PaginationControls
                                    page={pagination.page}
                                    totalPages={pagination.totalPages}
                                    total={pagination.total}
                                    onPageChange={setPage}
                                />
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
