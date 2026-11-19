"use client";

import { useEffect, useState } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { relativoHumano } from "@/lib/colegio/fechas-humano";
import { destinoVolverEstudiante } from "@/lib/colegio/volver-estudiante";
import SeccionAcudientes from "./SeccionAcudientes";
import {
    IdentificadoresParaAlertas,
    type ApiIdentificadores,
    type DatosIdentificador,
} from "@/components/modules/colegio/identificadores/IdentificadoresParaAlertas";

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

export default function AlumnoDetallePageClient({
    params,
    desde,
}: {
    params: Promise<{ id: string }>;
    /** SPEC-931: origen de la navegación (`?desde=estudiantes`) → a dónde vuelve «← Volver». */
    desde?: string | string[] | undefined;
}) {
    const router = useRouter();
    const [estudianteId, setEstudianteId] = useState<string | null>(null);
    const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
    const [curso, setCurso] = useState<Curso | null>(null);
    const [identificadores, setIdentificadores] = useState<Identificador[]>([]);
    const [observacion, setObservacion] = useState<EstadoObservacion | null>(null);
    const [togglingObservacion, setTogglingObservacion] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);

    useEffect(() => {
        params.then((p) => {
            setEstudianteId(p.id);
            cargar(p.id);
        });
    }, [params]);

    // SPEC-932: recarga SOLO los identificadores, sin pasar a skeleton — el componente no se desmonta y conserva
    // su mensaje de éxito tras guardar.
    async function recargarIdentificadores(id: string) {
        try {
            const res = await fetch(`/api/colegio/alumnos/${id}/identificadores`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setIdentificadores(data.identificadores || []);
        } catch {
            // la próxima carga completa lo reintenta; el guardado ya se confirmó en el componente
        }
    }

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

    // SPEC-932 · adaptador del estudiante. El alta NO acepta `plataformaId: null` (se omite); la edición sí (limpia).
    function cuerpoEstudiante(d: DatosIdentificador, edicion: boolean): Record<string, unknown> {
        return {
            valor: d.valor,
            ...(d.plataformaId ? { plataformaId: d.plataformaId } : edicion ? { plataformaId: null } : {}),
            ...(d.etiquetaRelacion ? { etiquetaRelacion: d.etiquetaRelacion } : {}),
            ...(d.confirmarCompartido ? { confirmarCompartido: true } : {}),
        };
    }
    const enviar = (url: string, method: "POST" | "PATCH", body: unknown) =>
        fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const apiIdentificadores: ApiIdentificadores = {
        crear: (d) => enviar(`/api/colegio/alumnos/${estudianteId}/identificadores`, "POST", cuerpoEstudiante(d, false)),
        editar: (i, d) => enviar(`/api/colegio/identificadores/${i.id}`, "PATCH", cuerpoEstudiante(d, true)),
        cambiarEstado: (i, estado) => enviar(`/api/colegio/identificadores/${i.id}/estado`, "PATCH", estado),
    };

    // SPEC-931: «← Volver» regresa a donde el usuario venía (listado de estudiantes o curso).
    const volver = destinoVolverEstudiante(desde, estudiante);

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Button
                                variant="outline"
                                onClick={() => router.push(volver.href)}
                                className="mb-2"
                            >
                                {volver.etiqueta}
                            </Button>
                            <h1 className="text-2xl font-bold text-body">{estudiante?.nombre || "Estudiante"}</h1>
                            {curso && <p className="text-sm text-muted">{curso.nombre}</p>}
                        </div>
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

                            {/* SPEC-932: el patrón ÚNICO (FORMA SPEC-931 §2.2) — gana «Editar», conserva «Relación». */}
                            <IdentificadoresParaAlertas
                                identificadores={identificadores}
                                api={apiIdentificadores}
                                onCambio={() => (estudianteId ? recargarIdentificadores(estudianteId) : undefined)}
                                relacion={{ opciones: etiquetaOptions, porDefecto: "ESTUDIANTE" }}
                            />

                            <SeccionAcudientes estudianteId={estudianteId!} />
                        </div>
                    ) : null}
                </div>
            </main>

        </div>
    );
}
