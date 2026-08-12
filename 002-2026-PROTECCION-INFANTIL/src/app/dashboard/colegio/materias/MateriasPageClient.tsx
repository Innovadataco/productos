"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

type Materia = {
    id: string;
    nombre: string;
    estado: string;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

export default function MateriasPageClient() {
    const [materias, setMaterias] = useState<Materia[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);

    const [creando, setCreando] = useState(false);
    const [nuevaMateria, setNuevaMateria] = useState("");
    const [guardando, setGuardando] = useState(false);

    const [editando, setEditando] = useState<Materia | null>(null);
    const [editNombre, setEditNombre] = useState("");

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/colegio/materias", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMaterias(data.materias || []);
                setMessage(null);
            } else if (res.status === 403) {
                setError(data?.error?.message || "El servicio del colegio no está vigente");
            } else {
                setError(data?.error?.message || "Error cargando materias");
            }
        } catch {
            setError("Error de red cargando materias");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    async function crearMateria() {
        const nombre = nuevaMateria.trim();
        if (!nombre) return;
        setGuardando(true);
        setMessage(null);
        try {
            const res = await fetch("/api/colegio/materias", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCreando(false);
                setNuevaMateria("");
                setMessage({ type: "success", text: "Materia creada" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error creando materia" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red creando materia" });
        } finally {
            setGuardando(false);
        }
    }

    async function guardarEdicion() {
        if (!editando || !editNombre.trim()) return;
        setGuardando(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/materias/${editando.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: editNombre.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEditando(null);
                setMessage({ type: "success", text: "Materia actualizada" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando materia" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando materia" });
        } finally {
            setGuardando(false);
        }
    }

    async function toggleEstado(materia: Materia) {
        const nuevoEstado = materia.estado === "activo" ? "inactivo" : "activo";
        try {
            const res = await fetch(`/api/colegio/materias/${materia.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Materia ${nuevoEstado === "activo" ? "activada" : "desactivada"}` });
                await cargar();
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
                            <h1 className="text-2xl font-bold text-body">Materias</h1>
                            <p className="text-sm text-muted">Catálogo de asignaturas de tu colegio.</p>
                        </div>
                        <Button onClick={() => setCreando(true)}>+ Nueva materia</Button>
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

                    <GlassCard>
                        {loading ? (
                            <div className="flex items-center gap-3 py-8 text-muted">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                Cargando materias...
                            </div>
                        ) : error ? (
                            <ErrorState title="No pudimos cargar las materias" description={error} onRetry={cargar} />
                        ) : materias.length === 0 ? (
                            <EmptyState
                                title="No hay materias registradas"
                                description="Crea la primera para asignarla a los cursos."
                                action={<Button onClick={() => setCreando(true)}>Crear materia</Button>}
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
                                        {materias.map((materia) => (
                                            <tr key={materia.id} className="align-top">
                                                <td className="py-3 pr-3 font-medium text-body">{materia.nombre}</td>
                                                <td className="py-3 pr-3">
                                                    <Badge variant={materia.estado === "activo" ? "success" : "neutral"}>
                                                        {materia.estado === "activo" ? "Activa" : "Inactiva"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => {
                                                                setEditando(materia);
                                                                setEditNombre(materia.nombre);
                                                            }}
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant={materia.estado === "activo" ? "danger" : "secondary"}
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => toggleEstado(materia)}
                                                        >
                                                            {materia.estado === "activo" ? "Desactivar" : "Activar"}
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

            <Modal isOpen={creando} onClose={() => setCreando(false)} title="Nueva materia">
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        required
                        maxLength={150}
                        value={nuevaMateria}
                        onChange={(e) => setNuevaMateria(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={crearMateria} isLoading={guardando}>
                            Crear
                        </Button>
                        <Button variant="outline" onClick={() => setCreando(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={editando !== null} onClose={() => setEditando(null)} title="Editar materia">
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        required
                        maxLength={150}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={guardarEdicion} isLoading={guardando}>
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
