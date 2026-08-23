"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { DetalleCaso } from "@/lib/colegio/seguimiento";
import { TimelineCaso } from "@/components/modules/colegio/seguimiento/TimelineCaso";
import { PendientesCaso } from "@/components/modules/colegio/seguimiento/PendientesCaso";
import { BitacoraCaso } from "@/components/modules/colegio/seguimiento/BitacoraCaso";

/**
 * SPEC-159 (FR-005) — Detalle del caso: resumen visible (estudiante, curso,
 * plataforma, tipo de identificador — NUNCA el valor del identificador ni el
 * texto del reporte, I-28/I-29), línea de tiempo, "lo que falta por hacer" y
 * bitácora. Los datos llegan del servidor (UNA llamada); tras cada mutación,
 * `router.refresh()` los recarga.
 */

const ESTADO_LABELS: Record<string, string> = {
    nueva: "Nueva",
    vista: "Vista",
    gestionada: "Gestionada",
};

const ESTADO_VARIANTS: Record<string, "default" | "warning" | "success" | "neutral"> = {
    nueva: "default",
    vista: "warning",
    gestionada: "success",
};

interface CasoDetalleClientProps {
    caso: DetalleCaso;
}

const TIPO_SUJETO_LABELS: Record<string, string> = {
    ESTUDIANTE: "Estudiante",
    PROFESOR: "Profesor",
    ACUDIENTE: "Acudiente",
};

export default function CasoDetalleClient({ caso }: CasoDetalleClientProps) {
    const { alerta } = caso;

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-3xl space-y-6">
                    <header>
                        <Link
                            href="/dashboard/colegio/alertas"
                            className="inline-flex min-h-12 items-center rounded-lg text-sm font-semibold text-accent transition hover:underline"
                        >
                            ← Volver a alertas
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold text-body">Seguimiento del caso</h1>
                            <Badge variant={ESTADO_VARIANTS[alerta.estado] || "neutral"}>
                                {ESTADO_LABELS[alerta.estado] || alerta.estado}
                            </Badge>
                        </div>
                    </header>

                    <section aria-label="Resumen del caso" className="glass rounded-[var(--radio-card)] p-6 sm:p-8">
                        <h2 className="titular-seccion text-body">Resumen del caso</h2>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="microetiqueta">Tipo de sujeto</dt>
                                <dd className="mt-0.5 text-body">{TIPO_SUJETO_LABELS[alerta.tipoSujeto] ?? alerta.tipoSujeto}</dd>
                            </div>
                            <div>
                                <dt className="microetiqueta">{alerta.tipoSujeto === "ESTUDIANTE" ? "Estudiante" : "Nombre"}</dt>
                                <dd className="mt-0.5 text-body">{alerta.sujetoNombre}</dd>
                            </div>
                            {alerta.curso && (
                                <div>
                                    <dt className="microetiqueta">Curso</dt>
                                    <dd className="mt-0.5 text-body">
                                        {alerta.curso.nombre}
                                        {alerta.curso.grado ? ` (${alerta.curso.grado})` : ""}
                                    </dd>
                                </div>
                            )}
                            {alerta.sujetoRelacion && (
                                <div>
                                    <dt className="microetiqueta">
                                        {alerta.tipoSujeto === "ESTUDIANTE" ? "Relación" : "Rol / parentesco"}
                                    </dt>
                                    <dd className="mt-0.5 text-body capitalize">{alerta.sujetoRelacion.toLowerCase()}</dd>
                                </div>
                            )}
                            <div>
                                <dt className="microetiqueta">Plataforma</dt>
                                <dd className="mt-0.5 text-body">{alerta.plataforma ?? "Sin plataforma registrada"}</dd>
                            </div>
                            <div>
                                <dt className="microetiqueta">Tipo de identificador</dt>
                                <dd className="mt-0.5 text-body capitalize">{alerta.tipoIdentificador.toLowerCase()}</dd>
                            </div>
                            <div>
                                <dt className="microetiqueta">Categoría del reporte</dt>
                                <dd className="mt-0.5 text-body">{alerta.categoria ?? "Sin clasificar"}</dd>
                            </div>
                            <div>
                                <dt className="microetiqueta">Recibida el</dt>
                                <dd className="mt-0.5 text-body">
                                    {new Date(alerta.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium",
                                        timeStyle: "short",
                                    })}
                                </dd>
                            </div>
                        </dl>
                        <p className="cuerpo mt-4 text-muted">
                            Por seguridad nunca mostramos el contenido del reporte ni quién lo hizo.
                        </p>
                    </section>

                    <PendientesCaso pendientes={caso.pendientes} alertaId={alerta.id} />
                    <TimelineCaso hitos={caso.timeline} />
                    <BitacoraCaso alertaId={alerta.id} notas={caso.seguimiento.notas} />
                </div>
            </main>
        </div>
    );
}
