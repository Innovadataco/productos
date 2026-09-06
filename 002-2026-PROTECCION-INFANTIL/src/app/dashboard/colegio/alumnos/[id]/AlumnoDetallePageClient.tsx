"use client";

import { useEffect, useState } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { relativoHumano } from "@/lib/colegio/fechas-humano";
import SeccionAcudientes from "./SeccionAcudientes";

type Estudiante = {
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

/** SPEC-150 (US3): marca de observación especial con actores legibles (ficha). */
type ObservacionVista = {
    id: string;
    activa: boolean;
    motivo: string | null;
    creadaPor: string;
    createdAt: string;
    desactivadaEn: string | null;
    desactivadaPor: string | null;
};

type EstadoObservacion = { activa: ObservacionVista | null; historial: ObservacionVista[] };

type Mensaje = { type: "success" | "error"; text: string } | null;

const etiquetaOptions = [
    { value: "ESTUDIANTE", label: "Estudiante" },
    { value: "MADRE", label: "Madre" },
    { value: "PADRE", label: "Padre" },
    { value: "PRIMO", label: "Primo" },
    { value: "TUTOR", label: "Tutor" },
    { value: "OTRO", label: "Otro" },
];

export default function AlumnoDetallePageClient({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [estudianteId, setEstudianteId] = useState<string | null>(null);
    const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
    const [curso, setCurso] = useState<Curso | null>(null);
    const [identificadores, setIdentificadores] = useState<Identificador[]>([]);
    const [observacion, setObservacion] = useState<EstadoObservacion | null>(null);
    const [togglingObservacion, setTogglingObservacion] = useState(false);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nuevo, setNuevo] = useState({ valor: "", plataformaId: "", etiquetaRelacion: "ESTUDIANTE" });

    useEffect(() => {
        params.then((p) => {
            setEstudianteId(p.id);
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
            const [resEstudiante, resIdentificadores, resObservacion] = await Promise.all([
                fetch(`/api/colegio/alumnos/${id}`, { credentials: "include" }),
                fetch(`/api/colegio/alumnos/${id}/identificadores`, { credentials: "include" }),
                fetch(`/api/colegio/alumnos/${id}/observacion`, { credentials: "include" }),
            ]);
            const dataEstudiante = await resEstudiante.json().catch(() => ({}));
            const dataIdentificadores = await resIdentificadores.json().catch(() => ({}));
            const dataObservacion = await resObservacion.json().catch(() => ({}));

            if (resEstudiante.ok && dataEstudiante.alumno) {
                setEstudiante(dataEstudiante.alumno);
                const resCurso = await fetch(`/api/colegio/cursos/${dataEstudiante.alumno.cursoId}`, { credentials: "include" });
                const dataCurso = await resCurso.json().catch(() => ({}));
                if (resCurso.ok && dataCurso.curso) {
                    setCurso(dataCurso.curso);
                }
            } else if (resEstudiante.status === 404 || resEstudiante.status === 403) {
                setError(dataEstudiante?.error?.message || "No tiene acceso a este estudiante");
                setLoading(false);
                return;
            }

            if (resIdentificadores.ok) {
                setIdentificadores(dataIdentificadores.identificadores || []);
            }

            if (resObservacion.ok && dataObservacion.observacion) {
                setObservacion(dataObservacion.observacion);
            }
        } catch {
            setError("Error de red cargando el estudiante");
        } finally {
            setLoading(false);
        }
    }

    async function agregarIdentificador() {
        if (!estudianteId || !nuevo.valor.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const payload: Record<string, unknown> = {
                valor: nuevo.valor.trim(),
                etiquetaRelacion: nuevo.etiquetaRelacion,
            };
            if (nuevo.plataformaId) payload.plataformaId = nuevo.plataformaId;

            const res = await fetch(`/api/colegio/alumnos/${estudianteId}/identificadores`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalOpen(false);
                setNuevo({ valor: "", plataformaId: "", etiquetaRelacion: "ESTUDIANTE" });
                setMessage({ type: "success", text: "Identificador agregado" });
                if (estudianteId) await cargar(estudianteId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error agregando identificador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red agregando identificador" });
        } finally {
            setSaving(false);
        }
    }

    // SPEC-150 (US3): estrella de observación especial — POST marca (idempotente),
    // DELETE desmarca (soft delete: la fila y el historial se conservan).
    async function toggleObservacion() {
        if (!estudianteId || !observacion) return;
        setTogglingObservacion(true);
        setMessage(null);
        const activa = observacion.activa;
        try {
            const res = await fetch(`/api/colegio/alumnos/${estudianteId}/observacion`, {
                method: activa ? "DELETE" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                ...(activa ? {} : { body: JSON.stringify({}) }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({
                    type: "success",
                    text: activa
                        ? "Observación especial retirada"
                        : "Estudiante marcado en observación especial: le avisaremos al primer reporte",
                });
                if (estudianteId) await cargar(estudianteId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando la observación" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando la observación" });
        } finally {
            setTogglingObservacion(false);
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
                if (estudianteId) await cargar(estudianteId);
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
                                onClick={() => router.push(`/dashboard/colegio/cursos/${estudiante?.cursoId || ""}`)}
                                className="mb-2"
                            >
                                ← Volver al curso
                            </Button>
                            <h1 className="text-2xl font-bold text-body">{estudiante?.nombre || "Estudiante"}</h1>
                            {curso && <p className="text-sm text-muted">{curso.nombre}</p>}
                        </div>
                        <Button onClick={() => setModalOpen(true)}>Nuevo identificador</Button>
                    </div>

                    {message && (
                        <div
                            className={`rounded-xl p-4 text-sm ${
                                message.type === "error"
                                    ? "bg-rubi/10 text-estado-rubi dark:bg-rubi/20"
                                    : "bg-pino/10 text-estado-pino dark:bg-pino/20"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <SkeletonLista />
                    ) : error ? (
                        <ErrorState title="No pudimos cargar el estudiante" description={error} onRetry={() => estudianteId && cargar(estudianteId)} />
                    ) : estudiante ? (
                        <div className="space-y-6">
                            {/* SPEC-150 (US3): observación especial — estado (desde
                                cuándo y por quién), historial visible y el mismo toggle
                                de la tabla del curso. */}
                            <GlassCard>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-body">Observación especial</h2>
                                        <p className="mt-1 text-sm text-muted">
                                            Los estudiantes en observación especial generan aviso al primer reporte.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={
                                            observacion?.activa
                                                ? "Quitar de observación especial"
                                                : "Marcar en observación especial"
                                        }
                                        aria-pressed={Boolean(observacion?.activa)}
                                        disabled={togglingObservacion || !observacion}
                                        onClick={toggleObservacion}
                                        className={`inline-flex min-h-12 min-w-12 items-center justify-center self-start rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pino disabled:opacity-50 sm:self-auto ${
                                            observacion?.activa ? "text-estado-ambar" : "text-subtle hover:text-estado-ambar"
                                        }`}
                                    >
                                        <Star
                                            aria-hidden="true"
                                            className="h-6 w-6"
                                            fill={observacion?.activa ? "currentColor" : "none"}
                                        />
                                    </button>
                                </div>

                                {observacion?.activa ? (
                                    <div className="mt-4">
                                        <Badge variant="warning">En observación especial</Badge>
                                        <p className="mt-2 text-sm text-body">
                                            Marcada {relativoHumano(new Date(observacion.activa.createdAt))} por{" "}
                                            {observacion.activa.creadaPor}.
                                        </p>
                                        {observacion.activa.motivo ? (
                                            <p className="mt-1 text-sm text-muted">Motivo: {observacion.activa.motivo}</p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <p className="mt-4 text-sm text-muted">Sin observación especial activa.</p>
                                )}

                                {observacion && observacion.historial.some((o) => !o.activa) ? (
                                    <div className="mt-4 border-t border-tinta/15 pt-4">
                                        <h3 className="text-sm font-semibold text-body">Historial</h3>
                                        <ul className="mt-2 space-y-2">
                                            {observacion.historial
                                                .filter((o) => !o.activa)
                                                .map((o) => (
                                                    <li key={o.id} className="text-sm text-muted">
                                                        Marcada {relativoHumano(new Date(o.createdAt))} por {o.creadaPor}
                                                        {o.desactivadaEn
                                                            ? `; retirada ${relativoHumano(new Date(o.desactivadaEn))} por ${o.desactivadaPor ?? "usuario no disponible"}`
                                                            : ""}
                                                        .{o.motivo ? ` Motivo: ${o.motivo}` : ""}
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </GlassCard>

                            <GlassCard>
                                <h2 className="text-lg font-semibold text-body">Identificadores</h2>
                                {identificadores.length === 0 ? (
                                    <EmptyState
                                        title="No hay identificadores"
                                        description="Agregue un identificador para usar en futuras alertas."
                                        action={
                                            <Button onClick={() => setModalOpen(true)}>Agregar identificador</Button>
                                        }
                                    />
                                ) : (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-tinta/15">
                                                <tr className="text-subtle">
                                                    <th className="pb-3 font-medium">Valor</th>
                                                    <th className="pb-3 font-medium">Tipo</th>
                                                    <th className="pb-3 font-medium">Plataforma</th>
                                                    <th className="pb-3 font-medium">Relación</th>
                                                    <th className="pb-3 font-medium">Estado</th>
                                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-tinta/10">
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

                            <SeccionAcudientes estudianteId={estudianteId!} />
                        </div>
                    ) : null}
                </div>
            </main>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Agregar identificador">
                <div className="space-y-4">
                    <Input
                        label="Valor"
                        required
                        maxLength={255}
                        value={nuevo.valor}
                        onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })}
                        placeholder="Ej. +573001234567, correo@dominio.com o nick"
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
