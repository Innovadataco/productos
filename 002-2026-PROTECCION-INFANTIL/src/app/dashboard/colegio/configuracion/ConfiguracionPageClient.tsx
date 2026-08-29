"use client";

import { useCallback, useEffect, useState } from "react";
import { Alerta } from "@/components/ui/Alerta";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";

/**
 * SPEC-149 (US4, FR-007) — Configuración de avisos por email del colegio.
 * Los 4 tipos con toggle, email destino y umbrales, todo con la terminología
 * §3 ("avisos", "te avisamos") y CERO jerga (nunca "idempotencia", "digest",
 * "cola" ni "preferencia técnica"). 100% tokens, tap targets ≥ 48px.
 * Consume GET/PATCH /api/colegio/preferencias-avisos (upsert por tipo).
 */

type TipoEvento = "REPORTE_NUEVO" | "UMBRAL_CURSO" | "ESTUDIANTE_REPETIDO" | "RESUMEN_SEMANAL";

interface Preferencia {
    tipoEvento: TipoEvento;
    habilitado: boolean;
    emailDestino: string | null;
    emailEfectivo: string | null;
    umbral: number | null;
    ventanaDias: number | null;
}

interface TextoTipo {
    titulo: string;
    descripcion: string;
    etiquetaUmbral?: string;
    etiquetaVentana?: string;
}

const TEXTOS: Record<TipoEvento, TextoTipo> = {
    REPORTE_NUEVO: {
        titulo: "Reporte nuevo",
        descripcion: "Te avisamos cuando llega un reporte nuevo sobre tu colegio, el mismo día.",
    },
    UMBRAL_CURSO: {
        titulo: "Umbral por curso",
        descripcion: "Te avisamos cuando un curso de tu colegio acumula varios reportes en pocos días.",
        etiquetaUmbral: "Avisar a partir de (reportes)",
        etiquetaVentana: "En un lapso de (días)",
    },
    ESTUDIANTE_REPETIDO: {
        titulo: "Estudiante con reportes repetidos",
        descripcion: "Te avisamos cuando un mismo estudiante acumula reportes, aunque sea en perfiles distintos.",
        etiquetaUmbral: "Avisar a partir de (reportes)",
        etiquetaVentana: "En un lapso de (días)",
    },
    RESUMEN_SEMANAL: {
        titulo: "Resumen del lunes",
        descripcion: "Cada lunes por la mañana te enviamos el resumen de la semana. Si fue una semana tranquila, también te lo contamos.",
    },
};

const ORDEN: TipoEvento[] = ["REPORTE_NUEVO", "UMBRAL_CURSO", "ESTUDIANTE_REPETIDO", "RESUMEN_SEMANAL"];

type Mensaje = { type: "success" | "error"; text: string } | null;

interface FormTipo {
    habilitado: boolean;
    emailDestino: string;
    umbral: string;
    ventanaDias: string;
}

export default function ConfiguracionPageClient() {
    const [emailPorDefecto, setEmailPorDefecto] = useState("");
    const [forms, setForms] = useState<Record<TipoEvento, FormTipo> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState<Mensaje>(null);
    const [guardando, setGuardando] = useState<TipoEvento | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/colegio/preferencias-avisos", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEmailPorDefecto(data.emailPorDefecto || "");
                const nuevos = {} as Record<TipoEvento, FormTipo>;
                for (const item of (data.items || []) as Preferencia[]) {
                    nuevos[item.tipoEvento] = {
                        habilitado: item.habilitado,
                        emailDestino: item.emailDestino ?? "",
                        umbral: item.umbral ? String(item.umbral) : "",
                        ventanaDias: item.ventanaDias ? String(item.ventanaDias) : "",
                    };
                }
                setForms(nuevos);
            } else if (res.status === 403) {
                setError(data?.error?.message || "El servicio del colegio no está vigente");
            } else {
                setError(data?.error?.message || "Error cargando la configuración");
            }
        } catch {
            setError("Error de red cargando la configuración");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    function actualizar(tipo: TipoEvento, cambios: Partial<FormTipo>) {
        setForms((prev) => (prev ? { ...prev, [tipo]: { ...prev[tipo], ...cambios } } : prev));
    }

    async function guardar(tipo: TipoEvento) {
        if (!forms) return;
        const form = forms[tipo];
        setGuardando(tipo);
        setMensaje(null);
        try {
            const body: Record<string, unknown> = {
                tipoEvento: tipo,
                habilitado: form.habilitado,
                emailDestino: form.emailDestino.trim() ? form.emailDestino.trim() : null,
            };
            if (TEXTOS[tipo].etiquetaUmbral) {
                const umbral = parseInt(form.umbral, 10);
                const ventana = parseInt(form.ventanaDias, 10);
                body.umbral = Number.isNaN(umbral) ? null : umbral;
                body.ventanaDias = Number.isNaN(ventana) ? null : ventana;
            }
            const res = await fetch("/api/colegio/preferencias-avisos", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMensaje({ type: "success", text: `Aviso «${TEXTOS[tipo].titulo}» guardado. Rige desde el próximo evento.` });
                await cargar();
            } else {
                // 400: el endpoint ya manda el mensaje humano (§4.6).
                setMensaje({ type: "error", text: data?.error?.message || "No pudimos guardar el aviso" });
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red guardando el aviso" });
        } finally {
            setGuardando(null);
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-3xl space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-body">Configuración</h1>
                        <p className="text-sm text-muted">
                            Elige qué avisos te enviamos por email y a qué dirección. Te avisamos pocas veces al
                            día; si hay más novedades, llegan en el resumen del lunes.
                        </p>
                    </div>

                    {mensaje && (
                        <Alerta tono={mensaje.type === "error" ? "error" : "exito"} role="status" className="p-4">
                            {mensaje.text}
                        </Alerta>
                    )}

                    {loading ? (
                        <GlassCard>
                            <div className="flex items-center gap-3 text-muted">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/15 border-t-accent" />
                                Cargando configuración...
                            </div>
                        </GlassCard>
                    ) : error ? (
                        <ErrorState title="No pudimos cargar la configuración" description={error} onRetry={cargar} />
                    ) : forms ? (
                        <div className="space-y-4">
                            {ORDEN.map((tipo) => {
                                const texto = TEXTOS[tipo];
                                const form = forms[tipo];
                                return (
                                    <GlassCard key={tipo} className="space-y-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h2 className="text-lg font-semibold text-body">{texto.titulo}</h2>
                                                <p className="text-sm text-muted">{texto.descripcion}</p>
                                            </div>
                                            <Button
                                                variant={form.habilitado ? "primary" : "outline"}
                                                className="min-h-12 shrink-0 px-4"
                                                aria-pressed={form.habilitado}
                                                onClick={() => actualizar(tipo, { habilitado: !form.habilitado })}
                                            >
                                                {form.habilitado ? "Activado" : "Desactivado"}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Input
                                                label="Enviar a"
                                                type="email"
                                                placeholder={emailPorDefecto ? `Vacío = ${emailPorDefecto}` : "Vacío = tu email de acceso"}
                                                value={form.emailDestino}
                                                onChange={(e) => actualizar(tipo, { emailDestino: e.target.value })}
                                            />
                                            {texto.etiquetaUmbral && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Input
                                                        label={texto.etiquetaUmbral}
                                                        type="number"
                                                        min={1}
                                                        max={100}
                                                        value={form.umbral}
                                                        onChange={(e) => actualizar(tipo, { umbral: e.target.value })}
                                                    />
                                                    <Input
                                                        label={texto.etiquetaVentana ?? ""}
                                                        type="number"
                                                        min={1}
                                                        max={90}
                                                        value={form.ventanaDias}
                                                        onChange={(e) => actualizar(tipo, { ventanaDias: e.target.value })}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <Button
                                                className="min-h-12"
                                                isLoading={guardando === tipo}
                                                onClick={() => guardar(tipo)}
                                            >
                                                Guardar
                                            </Button>
                                        </div>
                                    </GlassCard>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
}
