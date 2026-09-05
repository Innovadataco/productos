"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { DetalleSolicitudComiteDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    solicitudId: string;
    puedeResolver: boolean;
}

interface EstadoAnalisis {
    analisis: string | null;
    analisisActualizadoEn: string | null;
    analisisPor: { id: string; nombre: string | null; apellidos: string | null } | null;
    recomendacionInformeEn: string | null;
    recomendacionPor: { id: string; nombre: string | null; apellidos: string | null } | null;
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
    // SPEC-380 (PR A · C4): análisis persistente del comité + recomendación al
    // rector. Se lee de `/analisis` (endpoint separado que también sirve al
    // rector en su vista de lectura).
    const [analisisEstado, setAnalisisEstado] = useState<EstadoAnalisis | null>(null);
    const [analisisTexto, setAnalisisTexto] = useState("");
    const [analisisMensaje, setAnalisisMensaje] = useState<string | null>(null);
    const [analisisError, setAnalisisError] = useState<string | null>(null);
    const [analisisSaving, setAnalisisSaving] = useState(false);
    const [recomendando, setRecomendando] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [resDetalle, resAnalisis] = await Promise.all([
                fetch(`/api/colegio/comite/solicitudes/${solicitudId}`),
                fetch(`/api/colegio/comite/solicitudes/${solicitudId}/analisis`),
            ]);
            const dataDetalle = await resDetalle.json();
            if (!resDetalle.ok) {
                setError(dataDetalle.error?.message || "Error al cargar el caso");
                return;
            }
            setDetalle(dataDetalle);
            if (resAnalisis.ok) {
                const dataAnalisis = (await resAnalisis.json()) as EstadoAnalisis;
                setAnalisisEstado(dataAnalisis);
                setAnalisisTexto(dataAnalisis.analisis ?? "");
            }
        } catch {
            setError("Error de red al cargar el caso");
        } finally {
            setLoading(false);
        }
    }, [solicitudId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function guardarAnalisis(event: React.FormEvent) {
        event.preventDefault();
        setAnalisisSaving(true);
        setAnalisisMensaje(null);
        setAnalisisError(null);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes/${solicitudId}/analisis`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: analisisTexto.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAnalisisError(data.error?.message || "No pudimos guardar el análisis.");
                return;
            }
            setAnalisisEstado(data as EstadoAnalisis);
            setAnalisisTexto((data.analisis as string | null) ?? "");
            setAnalisisMensaje("Análisis guardado.");
        } catch {
            setAnalisisError("Error de red al guardar el análisis.");
        } finally {
            setAnalisisSaving(false);
        }
    }

    async function recomendarInforme() {
        setRecomendando(true);
        setAnalisisMensaje(null);
        setAnalisisError(null);
        try {
            const res = await fetch(`/api/colegio/comite/solicitudes/${solicitudId}/recomendar-informe`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) {
                setAnalisisError(data.error?.message || "No pudimos enviar la recomendación.");
                return;
            }
            setAnalisisEstado((prev) => (prev ? { ...prev, ...data } : prev));
            setAnalisisMensaje("Recomendación enviada al rector.");
        } catch {
            setAnalisisError("Error de red al enviar la recomendación.");
        } finally {
            setRecomendando(false);
        }
    }

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

            {/* SPEC-380 (PR A · C4): análisis persistente del comité +
                "Recomendar generar informe al rector". El comité edita;
                el rector lee (mismo panel, sin botones). Nunca rojo — la
                recomendación se ve como una nota ámbar. */}
            <section className="rounded-2xl glass p-6" aria-labelledby="analisis-comite-title">
                <h2 id="analisis-comite-title" className="text-lg font-semibold text-body">
                    Análisis del comité
                </h2>
                {analisisEstado?.recomendacionInformeEn && (
                    <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-50/60 p-3 text-sm text-body dark:bg-amber-950/20">
                        <p className="font-medium">Recomendación al rector · enviada.</p>
                        <p className="mt-1 text-muted">
                            El comité recomendó al rector emitir el informe del caso el{" "}
                            {new Date(analisisEstado.recomendacionInformeEn).toLocaleString("es-CO", {
                                timeZone: "America/Bogota",
                            })}
                            {analisisEstado.recomendacionPor && (
                                <>
                                    {" · "}
                                    {analisisEstado.recomendacionPor.nombre ?? ""}{" "}
                                    {analisisEstado.recomendacionPor.apellidos ?? ""}
                                </>
                            )}
                            . La decisión y la firma siguen siendo del rector.
                        </p>
                    </div>
                )}

                {puedeResolver && solicitud.estado === "PENDIENTE" ? (
                    <form onSubmit={guardarAnalisis} className="mt-4 space-y-3">
                        <textarea
                            maxLength={8000}
                            value={analisisTexto}
                            onChange={(e) => setAnalisisTexto(e.target.value)}
                            placeholder="Escriba el análisis del comité — lo que estudió, lo que preocupa, lo que se recomienda…"
                            className="min-h-[160px] w-full rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" isLoading={analisisSaving} disabled={analisisSaving || !analisisTexto.trim()}>
                                {analisisSaving ? "Guardando…" : "Guardar análisis"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={recomendarInforme}
                                isLoading={recomendando}
                                // La recomendación necesita un análisis guardado y no
                                // reenvía si ya se hizo (el endpoint también lo bloquea).
                                disabled={
                                    recomendando ||
                                    !analisisEstado?.analisis ||
                                    !!analisisEstado?.recomendacionInformeEn
                                }
                            >
                                {analisisEstado?.recomendacionInformeEn
                                    ? "Recomendación ya enviada"
                                    : "Recomendar generar informe al rector"}
                            </Button>
                        </div>
                        {analisisEstado?.analisisActualizadoEn && (
                            <p className="text-xs text-muted">
                                Última edición:{" "}
                                {new Date(analisisEstado.analisisActualizadoEn).toLocaleString("es-CO", {
                                    timeZone: "America/Bogota",
                                })}
                                {analisisEstado.analisisPor && (
                                    <>
                                        {" · "}
                                        {analisisEstado.analisisPor.nombre ?? ""}{" "}
                                        {analisisEstado.analisisPor.apellidos ?? ""}
                                    </>
                                )}
                            </p>
                        )}
                        {analisisMensaje && (
                            <p className="text-xs text-muted" role="status">
                                {analisisMensaje}
                            </p>
                        )}
                        {analisisError && (
                            <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">
                                {analisisError}
                            </p>
                        )}
                    </form>
                ) : analisisEstado?.analisis ? (
                    <div className="mt-4">
                        <p className="whitespace-pre-wrap text-sm text-body">{analisisEstado.analisis}</p>
                        {analisisEstado.analisisActualizadoEn && (
                            <p className="mt-2 text-xs text-muted">
                                Registrado por{" "}
                                {analisisEstado.analisisPor?.nombre ?? ""}{" "}
                                {analisisEstado.analisisPor?.apellidos ?? ""} · última edición{" "}
                                {new Date(analisisEstado.analisisActualizadoEn).toLocaleString("es-CO", {
                                    timeZone: "America/Bogota",
                                })}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-muted">
                        El comité aún no ha escrito su análisis.
                    </p>
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
                                placeholder="Escriba la decisión documentada del comité…"
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
