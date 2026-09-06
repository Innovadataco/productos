"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { Alerta } from "@/components/ui/Alerta";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PlantillaItem } from "./types";
import { CANAL_LABELS } from "./types";

function safeJsonStringify(value: unknown): string {
    if (value === undefined || value === null) return "{}";
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "{}";
    }
}

function safeJsonParse(value: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function PlantillasTab() {
    const [plantillas, setPlantillas] = useState<PlantillaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [editando, setEditando] = useState<PlantillaItem | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [enviandoPreview, setEnviandoPreview] = useState(false);

    const [form, setForm] = useState({
        asunto: "",
        cuerpoMarkdown: "",
        variablesSchema: "{}",
        activa: true,
    });

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/notificaciones/plantillas", { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error cargando plantillas");
            setPlantillas(body.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function abrirEditor(plantilla: PlantillaItem) {
        setEditando(plantilla);
        setForm({
            asunto: plantilla.asunto ?? "",
            cuerpoMarkdown: plantilla.cuerpoMarkdown,
            variablesSchema: safeJsonStringify(plantilla.variablesSchema),
            activa: plantilla.activa,
        });
        setMensaje(null);
        setError(null);
    }

    function cerrarEditor() {
        setEditando(null);
    }

    async function guardar() {
        if (!editando) return;
        const variablesSchema = safeJsonParse(form.variablesSchema);
        if (variablesSchema === null) {
            setError("El schema de variables debe ser un objeto JSON válido.");
            return;
        }

        setGuardando(true);
        setError(null);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/notificaciones/plantillas/${encodeURIComponent(editando.clave)}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    asunto: form.asunto,
                    cuerpoMarkdown: form.cuerpoMarkdown,
                    variablesSchema,
                    activa: form.activa,
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error al guardar");
            setMensaje("Plantilla actualizada correctamente.");
            setPlantillas((prev) =>
                prev.map((p) =>
                    p.clave === body.clave
                        ? { ...p, asunto: body.asunto, cuerpoMarkdown: body.cuerpoMarkdown, variablesSchema: body.variablesSchema, activa: body.activa, version: body.version }
                        : p
                )
            );
            cerrarEditor();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setGuardando(false);
        }
    }

    async function enviarPreview() {
        if (!editando) return;
        setEnviandoPreview(true);
        setError(null);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/notificaciones/plantillas/${encodeURIComponent(editando.clave)}`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error al enviar preview");
            setMensaje("Preview enviado a tu correo.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setEnviandoPreview(false);
        }
    }

    return (
        <div className="space-y-5">
            <GlassCard>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Plantillas del motor</h2>
                    <p className="text-sm text-muted">Edite el asunto, cuerpo Markdown y variables de cada plantilla.</p>
                </div>
                {mensaje && <Alerta tono="exito" className="mb-4">{mensaje}</Alerta>}
                {error && !editando && <Alerta tono="error" className="mb-4">{error}</Alerta>}

                {loading ? (
                    <Cargando texto="Cargando plantillas..." />
                ) : plantillas.length === 0 ? (
                    <EmptyState title="Sin plantillas" description="No se encontraron plantillas configuradas." />
                ) : (
                    <div className="space-y-3">
                        {plantillas.map((p) => (
                            <div
                                key={p.clave}
                                className="flex items-center justify-between rounded-xl border border-tinta/10 bg-papel/40 p-4"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-body">{p.clave}</span>
                                        <Badge variant={p.activa ? "success" : "neutral"}>{p.activa ? "Activa" : "Inactiva"}</Badge>
                                        <span className="text-xs text-muted">{CANAL_LABELS[p.canal]}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted">v{p.version} · {p.asunto ?? "Sin asunto"}</p>
                                </div>
                                <Button variant="outline" onClick={() => abrirEditor(p)}>
                                    Editar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <Modal isOpen={!!editando} onClose={cerrarEditor} title={`Editar plantilla: ${editando?.clave}`} size="xl">
                <div className="space-y-4">
                    {error && editando && <Alerta tono="error">{error}</Alerta>}
                    {mensaje && editando && <Alerta tono="exito">{mensaje}</Alerta>}
                    <Input
                        label="Asunto"
                        value={form.asunto}
                        onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))}
                        placeholder="Asunto del email"
                    />
                    <Textarea
                        label="Cuerpo Markdown"
                        value={form.cuerpoMarkdown}
                        onChange={(e) => setForm((f) => ({ ...f, cuerpoMarkdown: e.target.value }))}
                        rows={10}
                        placeholder="Cuerpo en Markdown con variables {{nombre}}"
                    />
                    <Textarea
                        label="Schema de variables (JSON)"
                        value={form.variablesSchema}
                        onChange={(e) => setForm((f) => ({ ...f, variablesSchema: e.target.value }))}
                        rows={6}
                        placeholder='{"nombre": {"type": "string"}}'
                    />
                    <label className="flex items-center gap-3 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={form.activa}
                            onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
                            className="h-4 w-4 rounded border-tinta/30 text-ambar focus:ring-ambar"
                        />
                        Plantilla activa
                    </label>
                    <div className="flex flex-wrap justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={cerrarEditor}>
                            Cancelar
                        </Button>
                        <Button variant="outline" isLoading={enviandoPreview} onClick={() => void enviarPreview()}>
                            Enviar preview
                        </Button>
                        <Button isLoading={guardando} onClick={() => void guardar()}>
                            Guardar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
