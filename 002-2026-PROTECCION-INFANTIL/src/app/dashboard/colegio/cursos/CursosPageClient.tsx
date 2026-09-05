"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { GRADO_OPTIONS } from "@/lib/colegio/grados";

type Curso = {
    id: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

export default function CursosPageClient() {
    const router = useRouter();
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    // SPEC-176: el listado por defecto solo trae activos; el toggle trae también
    // los desactivados para poder reactivarlos sin salir de la página.
    const [mostrarInactivos, setMostrarInactivos] = useState(false);

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const url = mostrarInactivos ? "/api/colegio/cursos?incluirInactivos=true" : "/api/colegio/cursos";
            const res = await fetch(url, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCursos(data.cursos || []);
                setMessage(null);
            } else if (res.status === 403) {
                setError(data?.error?.message || "El servicio del colegio no está vigente");
            } else {
                setError(data?.error?.message || "Error cargando cursos");
            }
        } catch {
            setError("Error de red cargando cursos");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mostrarInactivos]);

    async function toggleEstado(curso: Curso) {
        const nuevoEstado = curso.estado === "activo" ? "inactivo" : "activo";
        try {
            const res = await fetch(`/api/colegio/cursos/${curso.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Curso ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        }
    }

    // SPEC-129 (C4): edición en línea desde la fila (modal), sin navegar al detalle.
    const [editando, setEditando] = useState<Curso | null>(null);
    const [editForm, setEditForm] = useState<Partial<Curso>>({});
    const [saving, setSaving] = useState(false);

    function abrirEdicion(curso: Curso) {
        setEditando(curso);
        setEditForm({ nombre: curso.nombre, grado: curso.grado, anioLectivo: curso.anioLectivo });
    }

    async function guardarEdicion() {
        if (!editando || !editForm.nombre?.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/cursos/${editando.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: editForm.nombre.trim(),
                    grado: editForm.grado?.trim() || null,
                    anioLectivo: editForm.anioLectivo?.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEditando(null);
                setMessage({ type: "success", text: "Curso actualizado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando curso" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando curso" });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Cursos</h1>
                            <p className="text-sm text-muted">Gestione los cursos de su colegio.</p>
                        </div>
                        <Button onClick={() => router.push("/dashboard/colegio/cursos/unificado")}>
                            Nuevo curso
                        </Button>
                        <Button variant="outline" onClick={() => router.push("/dashboard/colegio/cursos/unificado?modo=excel")}>
                            Subir lista
                        </Button>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none w-fit">
                        <input
                            type="checkbox"
                            checked={mostrarInactivos}
                            onChange={(e) => setMostrarInactivos(e.target.checked)}
                            className="h-4 w-4 accent-pino"
                        />
                        Mostrar desactivados
                    </label>

                    {message && (
                        <div
                            className={`rounded-xl p-4 text-sm ${
                                message.type === "error"
                                    ? "bg-rubi/10 text-estado-rubi"
                                    : "bg-pino/10 text-estado-pino"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <GlassCard>
                        {loading ? (
                            <div className="flex items-center gap-3 py-8 text-muted">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/20 border-t-accent" />
                                Cargando cursos...
                            </div>
                        ) : error ? (
                            <ErrorState title="No pudimos cargar los cursos" description={error} onRetry={cargar} />
                        ) : cursos.length === 0 ? (
                            <EmptyState
                                title="No hay cursos registrados"
                                description="Cree el primer curso para comenzar a gestionar alumnos."
                                action={
                                    <Button onClick={() => router.push("/dashboard/colegio/cursos/unificado")}>
                                        Crear curso
                                    </Button>
                                }
                            />
                        ) : (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-tinta/10">
                                        <tr className="text-subtle">
                                            <th className="pb-3 font-medium">Nombre</th>
                                            <th className="pb-3 font-medium">Grado</th>
                                            <th className="pb-3 font-medium">Año lectivo</th>
                                            <th className="pb-3 font-medium">Estado</th>
                                            <th className="pb-3 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-tinta/10">
                                        {cursos.map((curso) => (
                                            <tr key={curso.id} className="align-top">
                                                <td className="py-3 pr-3 font-medium text-body">
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/dashboard/colegio/cursos/${curso.id}`)}
                                                        className="text-left hover:underline"
                                                    >
                                                        {curso.nombre}
                                                    </button>
                                                </td>
                                                <td className="py-3 pr-3 text-muted">{curso.grado || "—"}</td>
                                                <td className="py-3 pr-3 text-muted">{curso.anioLectivo || "—"}</td>
                                                <td className="py-3 pr-3">
                                                    <Badge variant={curso.estado === "activo" ? "success" : "neutral"}>
                                                        {curso.estado === "activo" ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => abrirEdicion(curso)}
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => router.push(`/dashboard/colegio/cursos/${curso.id}`)}
                                                        >
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            // SPEC-377 (I-268): "Desactivar" NO es rojo — la regla
                                                            // dura de Jelkin es "NUNCA rojo" (gris = inactivo,
                                                            // ámbar = única alerta). Reversible + no destructivo →
                                                            // outline neutro. "Activar" vuelve al verde secondary.
                                                            variant={curso.estado === "activo" ? "outline" : "secondary"}
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => toggleEstado(curso)}
                                                        >
                                                            {curso.estado === "activo" ? "Desactivar" : "Activar"}
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
                </div>
            </main>

            {/* SPEC-129 (C4): edición en línea del curso desde la fila. */}
            <Modal isOpen={editando !== null} onClose={() => setEditando(null)} title="Editar curso">
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        required
                        value={editForm.nombre || ""}
                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    />
                    <Select
                        label="Grado"
                        options={GRADO_OPTIONS}
                        value={editForm.grado || ""}
                        onChange={(e) => setEditForm({ ...editForm, grado: e.target.value })}
                    />
                    <Input
                        label="Año lectivo"
                        value={editForm.anioLectivo || ""}
                        onChange={(e) => setEditForm({ ...editForm, anioLectivo: e.target.value })}
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={guardarEdicion} isLoading={saving}>
                            Guardar
                        </Button>
                        <Button variant="outline" onClick={() => setEditando(null)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
