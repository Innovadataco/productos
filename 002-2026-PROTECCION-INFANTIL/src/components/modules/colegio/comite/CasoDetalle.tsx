"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { DetalleSolicitudComiteDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    solicitudId: string;
    puedeResolver: boolean;
}

export function CasoDetalle({ solicitudId, puedeResolver }: Props) {
    const [detalle, setDetalle] = useState<DetalleSolicitudComiteDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nuevaNota, setNuevaNota] = useState("");
    const [resolucion, setResolucion] = useState("");
    // SPEC-319 §2.4: integrante que firma el cierre (cuenta compartida).
    const [firmanteId, setFirmanteId] = useState("");
    const [accionLoading, setAccionLoading] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes/${solicitudId}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al cargar el caso");
                return;
            }
            setDetalle(data);
        } catch {
            setError("Error de red al cargar el caso");
        } finally {
            setLoading(false);
        }
    }, [solicitudId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function agregarNota(event: React.FormEvent) {
        event.preventDefault();
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes/${solicitudId}/notas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: nuevaNota.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al agregar la nota");
                return;
            }
            setNuevaNota("");
            await cargar();
        } catch {
            setError("Error de red al agregar la nota");
        } finally {
            setAccionLoading(false);
        }
    }

    async function resolver(event: React.FormEvent) {
        event.preventDefault();
        setAccionLoading(true);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes/${solicitudId}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolucion: resolucion.trim(), integranteFirmanteId: firmanteId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al resolver el caso");
                return;
            }
            setResolucion("");
            await cargar();
        } catch {
            setError("Error de red al resolver el caso");
        } finally {
            setAccionLoading(false);
        }
    }

    if (loading) return <p className="p-8 text-sm text-muted">Cargando caso…</p>;
    if (error) return <p className="p-8 text-sm text-estado-rubi">{error}</p>;
    if (!detalle) return <p className="p-8 text-sm text-muted">Caso no encontrado.</p>;

    const { solicitud, caso } = detalle;

    return (
        <div className="space-y-8 p-6 md:p-10">
            <div>
                <h1 className="text-2xl font-bold text-body">{solicitud.numero}</h1>
                <p className="mt-1 text-muted">
                    Estado: <span className="font-medium text-body">{solicitud.estado}</span> · Escalado el{" "}
                    {new Date(solicitud.creadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                </p>
            </div>

            <section className="rounded-2xl glass p-6">
                <h2 className="text-lg font-semibold text-body">Resumen del caso</h2>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Sujeto</dt>
                        <dd className="text-body">{caso.alerta.sujetoNombre}</dd>
                    </div>
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Relación</dt>
                        <dd className="text-body">{caso.alerta.sujetoRelacion}</dd>
                    </div>
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Curso</dt>
                        <dd className="text-body">{caso.alerta.curso ? `${caso.alerta.curso.nombre} ${caso.alerta.curso.grado ?? ""}`.trim() : "No aplica"}</dd>
                    </div>
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Plataforma</dt>
                        <dd className="text-body">{caso.alerta.plataforma ?? "No registrada"}</dd>
                    </div>
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Categoría</dt>
                        <dd className="text-body">{caso.alerta.categoria ?? "Sin categoría"}</dd>
                    </div>
                    <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Estado de la alerta</dt>
                        <dd className="text-body">{caso.alerta.estado}</dd>
                    </div>
                </dl>
                <div className="mt-4">
                    <dt className="text-xs uppercase tracking-wide text-muted">Motivo del escalamiento</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-body">{solicitud.motivo}</dd>
                </div>
                {solicitud.resolucion && (
                    <div className="mt-4 rounded-xl bg-pino/10 p-4 ring-1 ring-pino/30">
                        <dt className="text-xs uppercase tracking-wide text-muted">Resolución del comité</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-body">{solicitud.resolucion}</dd>
                    </div>
                )}
            </section>

            <section className="rounded-2xl glass p-6">
                <h2 className="text-lg font-semibold text-body">Línea de tiempo</h2>
                <ol className="mt-4 space-y-3">
                    {caso.timeline.map((hito) => (
                        <li key={hito.tipo} className="flex items-start gap-3">
                            <span
                                className={`mt-1 h-2 w-2 rounded-full ${
                                    hito.estado === "cumplido" ? "bg-pino" : "bg-tinta/20"
                                }`}
                            />
                            <div>
                                <p className="text-sm font-medium text-body">{hito.detalle}</p>
                                {hito.fecha && <p className="text-xs text-muted">{new Date(hito.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>}
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="rounded-2xl glass p-6">
                <h2 className="text-lg font-semibold text-body">Bitácora</h2>
                {caso.seguimiento.notas.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Aún no hay notas.</p>
                ) : (
                    <ul className="mt-4 space-y-4">
                        {caso.seguimiento.notas.map((nota) => (
                            <li key={nota.id} className="rounded-xl border border-tinta/10 p-4">
                                <p className="text-sm text-body">{nota.texto}</p>
                                <p className="mt-1 text-xs text-muted">
                                    {nota.autor} · {new Date(nota.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
                <form onSubmit={agregarNota} className="mt-4 space-y-3">
                    <textarea
                        required
                        maxLength={1000}
                        value={nuevaNota}
                        onChange={(e) => setNuevaNota(e.target.value)}
                        placeholder="Registrar lo actuado…"
                        className="min-h-[80px] w-full rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                    />
                    <Button type="submit" isLoading={accionLoading}>
                        {accionLoading ? "Guardando…" : "Agregar nota"}
                    </Button>
                </form>
            </section>

            {puedeResolver && solicitud.estado === "PENDIENTE" && (
                <section className="rounded-2xl glass p-6">
                    <h2 className="text-lg font-semibold text-body">Cerrar caso con decisión</h2>
                    {detalle.integrantesActivos.length === 0 ? (
                        // SPEC-319 §2.4 (FR-019): sin integrantes activos no se puede firmar.
                        <p className="mt-4 text-sm text-estado-rubi">
                            No hay integrantes activos del comité para firmar el cierre. Agrega o activa un integrante
                            antes de cerrar el caso.
                        </p>
                    ) : (
                        <form onSubmit={resolver} className="mt-4 space-y-3">
                            <textarea
                                required
                                maxLength={4000}
                                value={resolucion}
                                onChange={(e) => setResolucion(e.target.value)}
                                placeholder="Escribe la decisión documentada del comité…"
                                className="min-h-[120px] w-full rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            {/* SPEC-319 §2.4: quién firma el cierre (integrante activo) */}
                            <div>
                                <label htmlFor="firmante" className="block text-sm font-medium text-body">
                                    Integrante que firma el cierre
                                </label>
                                <select
                                    id="firmante"
                                    required
                                    value={firmanteId}
                                    onChange={(e) => setFirmanteId(e.target.value)}
                                    className="mt-1 w-full rounded-xl glass-input px-4 py-2 text-sm text-body ring-accent-input"
                                >
                                    <option value="" disabled>
                                        Selecciona un integrante…
                                    </option>
                                    {detalle.integrantesActivos.map((i) => (
                                        <option key={i.id} value={i.id}>
                                            {i.nombres} {i.apellidos}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button type="submit" isLoading={accionLoading} disabled={!firmanteId}>
                                {accionLoading ? "Cerrando…" : "Cerrar caso"}
                            </Button>
                        </form>
                    )}
                </section>
            )}
        </div>
    );
}
