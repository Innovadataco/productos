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

type Alumno = {
    id: string;
    nombre: string;
    estado: string;
    cursoId: string;
};

type Curso = {
    id: string;
    nombre: string;
};

type Identificador = {
    id: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    plataforma: { id: string; clave: string; nombre: string } | null;
    etiquetaRelacion: string;
    estado: string;
};

type Plataforma = { id: string; clave: string; nombre: string };

type Mensaje = { type: "success" | "error"; text: string } | null;

const etiquetaOptions = [
    { value: "ALUMNO", label: "Alumno" },
    { value: "MADRE", label: "Madre" },
    { value: "PADRE", label: "Padre" },
    { value: "PRIMO", label: "Primo" },
    { value: "TUTOR", label: "Tutor" },
    { value: "OTRO", label: "Otro" },
];

export default function AlumnoDetallePageClient({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [alumnoId, setAlumnoId] = useState<string | null>(null);
    const [alumno, setAlumno] = useState<Alumno | null>(null);
    const [curso, setCurso] = useState<Curso | null>(null);
    const [identificadores, setIdentificadores] = useState<Identificador[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nuevo, setNuevo] = useState({ tipo: "", valor: "", plataformaId: "", etiquetaRelacion: "ALUMNO" });

    useEffect(() => {
        params.then((p) => {
            setAlumnoId(p.id);
            cargar(p.id);
        });
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((data) => setPlataformas(data.plataformas || []))
            .catch(() => {});
    }, [params]);

    async function cargar(id: string) {
        setLoading(true);
        setError("");
        try {
            const [resAlumno, resIdentificadores] = await Promise.all([
                fetch(`/api/colegio/alumnos/${id}`, { credentials: "include" }),
                fetch(`/api/colegio/alumnos/${id}/identificadores`, { credentials: "include" }),
            ]);
            const dataAlumno = await resAlumno.json().catch(() => ({}));
            const dataIdentificadores = await resIdentificadores.json().catch(() => ({}));

            if (resAlumno.ok && dataAlumno.alumno) {
                setAlumno(dataAlumno.alumno);
                const resCurso = await fetch(`/api/colegio/cursos/${dataAlumno.alumno.cursoId}`, { credentials: "include" });
                const dataCurso = await resCurso.json().catch(() => ({}));
                if (resCurso.ok && dataCurso.curso) {
                    setCurso(dataCurso.curso);
                }
            } else if (resAlumno.status === 404 || resAlumno.status === 403) {
                setError(dataAlumno?.error?.message || "No tienes acceso a este alumno");
                setLoading(false);
                return;
            }

            if (resIdentificadores.ok) {
                setIdentificadores(dataIdentificadores.identificadores || []);
            }
        } catch {
            setError("Error de red cargando el alumno");
        } finally {
            setLoading(false);
        }
    }

    async function agregarIdentificador() {
        if (!alumnoId || !nuevo.tipo.trim() || !nuevo.valor.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const payload: Record<string, unknown> = {
                tipo: nuevo.tipo.trim(),
                valor: nuevo.valor.trim(),
                etiquetaRelacion: nuevo.etiquetaRelacion,
            };
            if (nuevo.plataformaId) payload.plataformaId = nuevo.plataformaId;

            const res = await fetch(`/api/colegio/alumnos/${alumnoId}/identificadores`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalOpen(false);
                setNuevo({ tipo: "", valor: "", plataformaId: "", etiquetaRelacion: "ALUMNO" });
                setMessage({ type: "success", text: "Identificador agregado" });
                if (alumnoId) await cargar(alumnoId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error agregando identificador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red agregando identificador" });
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstadoIdentificador(identificador: Identificador) {
        const nuevoEstado = identificador.estado === "activo" ? "inactivo" : "activo";
        try {
            const res = await fetch(`/api/colegio/identificadores/${identificador.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Identificador ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                if (alumnoId) await cargar(alumnoId);
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
                                onClick={() => router.push(`/dashboard/colegio/cursos/${alumno?.cursoId || ""}`)}
                                className="mb-2"
                            >
                                ← Volver al curso
                            </Button>
                            <h1 className="text-2xl font-bold text-body">{alumno?.nombre || "Alumno"}</h1>
                            {curso && <p className="text-sm text-muted">{curso.nombre}</p>}
                        </div>
                        <Button onClick={() => setModalOpen(true)}>Nuevo identificador</Button>
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
                        <ErrorState title="No pudimos cargar el alumno" description={error} onRetry={() => alumnoId && cargar(alumnoId)} />
                    ) : alumno ? (
                        <GlassCard>
                            <h2 className="text-lg font-semibold text-body">Identificadores</h2>
                            {identificadores.length === 0 ? (
                                <EmptyState
                                    title="No hay identificadores"
                                    description="Agrega un identificador para usar en futuras alertas."
                                    action={
                                        <Button onClick={() => setModalOpen(true)}>Agregar identificador</Button>
                                    }
                                />
                            ) : (
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-slate-200 dark:border-slate-800">
                                            <tr className="text-subtle">
                                                <th className="pb-3 font-medium">Valor</th>
                                                <th className="pb-3 font-medium">Tipo</th>
                                                <th className="pb-3 font-medium">Plataforma</th>
                                                <th className="pb-3 font-medium">Relación</th>
                                                <th className="pb-3 font-medium">Estado</th>
                                                <th className="pb-3 font-medium text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {identificadores.map((identificador) => (
                                                <tr key={identificador.id} className="align-top">
                                                    <td className="py-3 pr-3 font-medium text-body">{identificador.valor}</td>
                                                    <td className="py-3 pr-3 text-muted">{identificador.tipo}</td>
                                                    <td className="py-3 pr-3 text-muted">{identificador.plataforma?.nombre || "—"}</td>
                                                    <td className="py-3 pr-3 text-muted">
                                                        {etiquetaOptions.find((e) => e.value === identificador.etiquetaRelacion)?.label || identificador.etiquetaRelacion}
                                                    </td>
                                                    <td className="py-3 pr-3">
                                                        <Badge variant={identificador.estado === "activo" ? "success" : "neutral"}>
                                                            {identificador.estado === "activo" ? "Activo" : "Inactivo"}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <Button
                                                            variant={identificador.estado === "activo" ? "danger" : "secondary"}
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => toggleEstadoIdentificador(identificador)}
                                                        >
                                                            {identificador.estado === "activo" ? "Desactivar" : "Activar"}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </GlassCard>
                    ) : null}
                </div>
            </main>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Agregar identificador">
                <div className="space-y-4">
                    <Input
                        label="Tipo"
                        required
                        maxLength={50}
                        value={nuevo.tipo}
                        onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}
                        placeholder="Ej. teléfono, email, nick"
                    />
                    <Input
                        label="Valor"
                        required
                        maxLength={255}
                        value={nuevo.valor}
                        onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })}
                        placeholder="Ej. +573001234567"
                    />
                    <Select
                        label="Plataforma"
                        options={[
                            { value: "", label: "Ninguna / General" },
                            ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
                        ]}
                        value={nuevo.plataformaId}
                        onChange={(e) => setNuevo({ ...nuevo, plataformaId: e.target.value })}
                    />
                    <Select
                        label="Relación"
                        required
                        options={etiquetaOptions}
                        value={nuevo.etiquetaRelacion}
                        onChange={(e) => setNuevo({ ...nuevo, etiquetaRelacion: e.target.value })}
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={agregarIdentificador} isLoading={saving}>
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
