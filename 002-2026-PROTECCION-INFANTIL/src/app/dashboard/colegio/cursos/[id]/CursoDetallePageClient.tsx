"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

type Curso = {
    id: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
};

type Alumno = {
    id: string;
    nombre: string;
    estado: string;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

export default function CursoDetallePageClient({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [cursoId, setCursoId] = useState<string | null>(null);
    const [curso, setCurso] = useState<Curso | null>(null);
    const [alumnos, setAlumnos] = useState<Alumno[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [editForm, setEditForm] = useState<Partial<Curso>>({});
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [nuevoAlumno, setNuevoAlumno] = useState("");

    useEffect(() => {
        params.then((p) => {
            setCursoId(p.id);
            cargar(p.id);
        });
    }, [params]);

    async function cargar(id: string) {
        setLoading(true);
        setError("");
        try {
            const [resCurso, resAlumnos] = await Promise.all([
                fetch(`/api/colegio/cursos/${id}`, { credentials: "include" }),
                fetch(`/api/colegio/cursos/${id}/alumnos`, { credentials: "include" }),
            ]);
            const dataCurso = await resCurso.json().catch(() => ({}));
            const dataAlumnos = await resAlumnos.json().catch(() => ({}));

            if (resCurso.ok && dataCurso.curso) {
                setCurso(dataCurso.curso);
                setEditForm(dataCurso.curso);
            } else if (resCurso.status === 404 || resCurso.status === 403) {
                setError(dataCurso?.error?.message || "No tienes acceso a este curso");
                setLoading(false);
                return;
            }

            if (resAlumnos.ok) {
                setAlumnos(dataAlumnos.alumnos || []);
            }
        } catch {
            setError("Error de red cargando el curso");
        } finally {
            setLoading(false);
        }
    }

    async function guardarEdicion() {
        if (!cursoId || !editForm.nombre) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: editForm.nombre?.trim(),
                    grado: editForm.grado?.trim() || null,
                    anioLectivo: editForm.anioLectivo?.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCurso(data.curso);
                setEditing(false);
                setMessage({ type: "success", text: "Curso actualizado" });
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando curso" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando curso" });
        } finally {
            setSaving(false);
        }
    }

    async function agregarAlumno() {
        if (!cursoId || !nuevoAlumno.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}/alumnos`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: nuevoAlumno.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalOpen(false);
                setNuevoAlumno("");
                setMessage({ type: "success", text: "Alumno agregado" });
                if (cursoId) await cargar(cursoId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error agregando alumno" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red agregando alumno" });
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstadoAlumno(alumno: Alumno) {
        const nuevoEstado = alumno.estado === "activo" ? "inactivo" : "activo";
        try {
            const res = await fetch(`/api/colegio/alumnos/${alumno.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Alumno ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                if (cursoId) await cargar(cursoId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Button
                                variant="outline"
                                onClick={() => router.push("/dashboard/colegio/cursos")}
                                className="mb-2"
                            >
                                ← Volver a cursos
                            </Button>
                            <h1 className="text-2xl font-bold text-body">{curso?.nombre || "Curso"}</h1>
                        </div>
                        <Button onClick={() => setModalOpen(true)}>Nuevo alumno</Button>
                    </div>

                    {message && (
                        <div
                            className={`rounded-xl p-4 text-sm ${
                                message.type === "error"
                                    ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center gap-3 py-8 text-muted">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                            Cargando...
                        </div>
                    ) : error ? (
                        <ErrorState title="No pudimos cargar el curso" description={error} onRetry={() => cursoId && cargar(cursoId)} />
                    ) : curso ? (
                        <>
                            <GlassCard>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-body">Información del curso</h2>
                                    {!editing && (
                                        <Button variant="outline" onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs">
                                            Editar
                                        </Button>
                                    )}
                                </div>
                                {editing ? (
                                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                        <Input
                                            label="Nombre"
                                            required
                                            value={editForm.nombre || ""}
                                            onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                                        />
                                        <Input
                                            label="Grado"
                                            value={editForm.grado || ""}
                                            onChange={(e) => setEditForm({ ...editForm, grado: e.target.value })}
                                        />
                                        <Input
                                            label="Año lectivo"
                                            value={editForm.anioLectivo || ""}
                                            onChange={(e) => setEditForm({ ...editForm, anioLectivo: e.target.value })}
                                        />
                                        <div className="flex items-end gap-2 sm:col-span-3">
                                            <Button onClick={guardarEdicion} isLoading={saving}>
                                                Guardar
                                            </Button>
                                            <Button variant="outline" onClick={() => { setEditing(false); setEditForm(curso); }}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                        <div className="rounded-xl glass-input p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Nombre</p>
                                            <p className="mt-1 text-sm text-body">{curso.nombre}</p>
                                        </div>
                                        <div className="rounded-xl glass-input p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Grado</p>
                                            <p className="mt-1 text-sm text-body">{curso.grado || "—"}</p>
                                        </div>
                                        <div className="rounded-xl glass-input p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Año lectivo</p>
                                            <p className="mt-1 text-sm text-body">{curso.anioLectivo || "—"}</p>
                                        </div>
                                    </div>
                                )}
                            </GlassCard>

                            <GlassCard>
                                <h2 className="text-lg font-semibold text-body">Alumnos</h2>
                                {alumnos.length === 0 ? (
                                    <EmptyState
                                        title="No hay alumnos en este curso"
                                        description="Agrega el primer alumno para comenzar."
                                        action={
                                            <Button onClick={() => setModalOpen(true)}>Agregar alumno</Button>
                                        }
                                    />
                                ) : (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                                <tr className="text-subtle">
                                                    <th className="pb-3 font-medium">Nombre</th>
                                                    <th className="pb-3 font-medium">Estado</th>
                                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {alumnos.map((alumno) => (
                                                    <tr key={alumno.id} className="align-top">
                                                        <td className="py-3 pr-3 font-medium text-body">
                                                            <button
                                                                type="button"
                                                                onClick={() => router.push(`/dashboard/colegio/alumnos/${alumno.id}`)}
                                                                className="text-left hover:underline"
                                                            >
                                                                {alumno.nombre}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 pr-3">
                                                            <Badge variant={alumno.estado === "activo" ? "success" : "neutral"}>
                                                                {alumno.estado === "activo" ? "Activo" : "Inactivo"}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    className="px-3 py-1.5 text-xs"
                                                                    onClick={() => router.push(`/dashboard/colegio/alumnos/${alumno.id}`)}
                                                                >
                                                                    Ver
                                                                </Button>
                                                                <Button
                                                                    variant={alumno.estado === "activo" ? "danger" : "secondary"}
                                                                    className="px-3 py-1.5 text-xs"
                                                                    onClick={() => toggleEstadoAlumno(alumno)}
                                                                >
                                                                    {alumno.estado === "activo" ? "Desactivar" : "Activar"}
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </GlassCard>
                        </>
                    ) : null}
                </div>
            </main>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Agregar alumno">
                <div className="space-y-4">
                    <Input
                        label="Nombre del alumno"
                        required
                        minLength={2}
                        maxLength={150}
                        value={nuevoAlumno}
                        onChange={(e) => setNuevoAlumno(e.target.value)}
                        placeholder="Ej. María Gómez"
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={agregarAlumno} isLoading={saving}>
                            Agregar
                        </Button>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
