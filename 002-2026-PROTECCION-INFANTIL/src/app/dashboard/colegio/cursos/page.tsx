"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ColegioNav } from "@/components/modules/colegio/ColegioNav";

type Curso = {
    id: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    estado: string;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

export default function CursosPage() {
    const router = useRouter();
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/colegio/cursos", { credentials: "include" });
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
    }, []);

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

    return (
        <div className="min-h-screen bg-page">
            <ColegioNav />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Cursos</h1>
                            <p className="text-sm text-muted">Gestiona los cursos de tu colegio.</p>
                        </div>
                        <Button onClick={() => router.push("/dashboard/colegio/cursos/nuevo")}>
                            Nuevo curso
                        </Button>
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
                                Cargando cursos...
                            </div>
                        ) : error ? (
                            <ErrorState title="No pudimos cargar los cursos" description={error} onRetry={cargar} />
                        ) : cursos.length === 0 ? (
                            <EmptyState
                                title="No hay cursos registrados"
                                description="Crea el primer curso para comenzar a gestionar alumnos."
                                action={
                                    <Button onClick={() => router.push("/dashboard/colegio/cursos/nuevo")}>
                                        Crear curso
                                    </Button>
                                }
                            />
                        ) : (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-slate-200 dark:border-slate-800">
                                        <tr className="text-subtle">
                                            <th className="pb-3 font-medium">Nombre</th>
                                            <th className="pb-3 font-medium">Grado</th>
                                            <th className="pb-3 font-medium">Año lectivo</th>
                                            <th className="pb-3 font-medium">Estado</th>
                                            <th className="pb-3 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                                                            onClick={() => router.push(`/dashboard/colegio/cursos/${curso.id}`)}
                                                        >
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            variant={curso.estado === "activo" ? "danger" : "secondary"}
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
        </div>
    );
}
