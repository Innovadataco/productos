"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type MateriaOpcion = {
    id: string;
    nombre: string;
};

type ProfesorOpcion = {
    id: string;
    nombre: string;
    apellidos: string;
};

type Vinculo = {
    id: string;
    materiaId: string;
    profesorId: string | null;
    materia: { id: string; nombre: string; estado: string };
    profesor: { id: string; nombre: string; apellidos: string; estado: string } | null;
    estado: string;
};

interface SeccionMateriasCursoProps {
    cursoId: string;
    onAviso: (mensaje: string, tipo?: "exito" | "error") => void;
}

export default function SeccionMateriasCurso({ cursoId, onAviso }: SeccionMateriasCursoProps) {
    const [vinculos, setVinculos] = useState<Vinculo[]>([]);
    const [materias, setMaterias] = useState<MateriaOpcion[]>([]);
    const [profesores, setProfesores] = useState<ProfesorOpcion[]>([]);
    const [loading, setLoading] = useState(true);
    const [materiaId, setMateriaId] = useState("");
    const [profesorId, setProfesorId] = useState("");
    const [asignando, setAsignando] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}/materias`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setVinculos(data.materias || []);
        } catch {
            onAviso("Error cargando materias del curso", "error");
        } finally {
            setLoading(false);
        }
    }, [cursoId, onAviso]);

    const cargarCatalogos = useCallback(async () => {
        try {
            const [resMaterias, resProfesores] = await Promise.all([
                fetch("/api/colegio/materias", { credentials: "include" }),
                fetch("/api/colegio/profesores?estado=activo&pageSize=100", { credentials: "include" }),
            ]);
            const dataMaterias = await resMaterias.json().catch(() => ({}));
            const dataProfesores = await resProfesores.json().catch(() => ({}));
            if (resMaterias.ok) setMaterias(dataMaterias.materias || []);
            if (resProfesores.ok) setProfesores(dataProfesores.items || []);
        } catch {
            onAviso("Error cargando catálogos", "error");
        }
    }, [onAviso]);

    useEffect(() => {
        cargar();
        cargarCatalogos();
    }, [cursoId, cargar, cargarCatalogos]);

    async function asignar() {
        if (!materiaId) return;
        setAsignando(true);
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}/materias`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ materiaId, profesorId: profesorId || null }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMateriaId("");
                setProfesorId("");
                onAviso("Materia asignada al curso", "exito");
                await cargar();
            } else {
                onAviso(data?.error?.message || "Error asignando materia", "error");
            }
        } catch {
            onAviso("Error de red asignando materia", "error");
        } finally {
            setAsignando(false);
        }
    }

    async function quitar(vinculoId: string) {
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}/materias/${vinculoId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onAviso("Materia desasignada del curso", "exito");
                await cargar();
            } else {
                onAviso(data?.error?.message || "Error desasignando materia", "error");
            }
        } catch {
            onAviso("Error de red desasignando materia", "error");
        }
    }

    const materiasDisponibles = materias.filter(
        (m) => !vinculos.some((v) => v.materiaId === m.id && v.estado === "activo")
    );

    return (
        <section aria-label="Materias del curso" className="glass rounded-[var(--radio-card)] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="titular-seccion text-body">Materias del curso</h2>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                    <Select
                        label="Materia"
                        options={[
                            { value: "", label: materiasDisponibles.length === 0 ? "Sin materias disponibles" : "Seleccione una materia" },
                            ...materiasDisponibles.map((m) => ({ value: m.id, label: m.nombre })),
                        ]}
                        value={materiaId}
                        onChange={(e) => setMateriaId(e.target.value)}
                    />
                </div>
                <div className="min-w-[200px] flex-1">
                    <Select
                        // SPEC-379 (D3 · candado UI): "toda materia con profesor,
                        // sin excepción" (SPEC-344 servidor). Antes el label decía
                        // "(opcional)" y ofrecía "Sin profesor asignado" — el
                        // rector solo se enteraba con el 400 al guardar. Ahora el
                        // campo es OBLIGATORIO en la pantalla; el servidor sigue
                        // rechazando por si alguien llega por API directa.
                        label="Profesor a cargo"
                        options={[
                            {
                                value: "",
                                label:
                                    profesores.length === 0
                                        ? "Primero cree un profesor"
                                        : "Elija un profesor",
                            },
                            ...profesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellidos}` })),
                        ]}
                        value={profesorId}
                        onChange={(e) => setProfesorId(e.target.value)}
                    />
                </div>
                <Button
                    onClick={asignar}
                    isLoading={asignando}
                    disabled={!materiaId || !profesorId}
                >
                    Asignar
                </Button>
            </div>
            {materiaId && !profesorId && (
                <p className="mt-2 text-xs text-muted" role="status">
                    Toda materia debe llevar un profesor a cargo. Elige uno para poder asignarla.
                </p>
            )}

            {loading ? (
                <div className="mt-6 flex items-center gap-3 text-muted">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/15 border-t-accent" />
                    Cargando materias...
                </div>
            ) : vinculos.length === 0 ? (
                <div className="mt-6">
                    <EmptyState
                        title="Este curso aún no tiene materias"
                        description="Asigne la primera desde el selector de arriba."
                    />
                </div>
            ) : (
                <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-tinta/15">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">Materia</th>
                                <th className="pb-3 font-medium">Profesor</th>
                                <th className="pb-3 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10">
                            {vinculos.map((v) => (
                                <tr key={v.id} className="align-top">
                                    <td className="py-3 pr-3 font-medium text-body">{v.materia.nombre}</td>
                                    <td className="py-3 pr-3 text-muted">
                                        {v.profesor ? (
                                            <>
                                                {`${v.profesor.nombre} ${v.profesor.apellidos}`}
                                                {v.profesor.estado !== "activo" ? (
                                                    <Badge variant="neutral" className="ml-2 text-xs">inactivo</Badge>
                                                ) : null}
                                            </>
                                        ) : (
                                            "Sin profesor asignado"
                                        )}
                                    </td>
                                    <td className="py-3 text-right">
                                        <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => quitar(v.id)}>
                                            Quitar
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
