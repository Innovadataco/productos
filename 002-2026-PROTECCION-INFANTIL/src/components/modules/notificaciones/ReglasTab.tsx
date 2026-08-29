"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { Alerta } from "@/components/ui/Alerta";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ReglaItem } from "./types";
import { CANAL_LABELS } from "./types";

const CANAL_OPTIONS = [
    { value: "EMAIL", label: "Email" },
    { value: "IN_APP", label: "In-app" },
];

export function ReglasTab() {
    const [reglas, setReglas] = useState<ReglaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [editando, setEditando] = useState<ReglaItem | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [confirmacion, setConfirmacion] = useState<{ evento: string; programadas: number } | null>(null);

    const [form, setForm] = useState({
        offset: "",
        canal: "EMAIL" as "EMAIL" | "IN_APP",
        plantillaClave: "",
        obligatoria: false,
        activa: true,
    });

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/notificaciones/reglas", { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error cargando reglas");
            setReglas(body.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function abrirEditor(regla: ReglaItem) {
        setEditando(regla);
        setForm({
            offset: regla.offset,
            canal: regla.canal,
            plantillaClave: regla.plantillaClave,
            obligatoria: regla.obligatoria,
            activa: regla.activa,
        });
        setMensaje(null);
        setError(null);
        setConfirmacion(null);
    }

    function cerrarEditor() {
        setEditando(null);
        setConfirmacion(null);
    }

    async function guardar(forzar = false) {
        if (!editando) return;

        setGuardando(true);
        setError(null);
        setMensaje(null);
        setConfirmacion(null);
        try {
            const res = await fetch(`/api/admin/notificaciones/reglas/${editando.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offset: form.offset,
                    canal: form.canal,
                    plantillaClave: form.plantillaClave,
                    obligatoria: form.obligatoria,
                    activa: form.activa,
                    ...(forzar ? { confirmRecalcular: true } : {}),
                }),
            });
            const body = await res.json().catch(() => ({}));

            if (res.status === 409 && body?.requiereConfirmacion) {
                setConfirmacion({ evento: body.evento, programadas: body.programadas });
                setGuardando(false);
                return;
            }

            if (!res.ok) throw new Error(body?.error?.message || "Error al guardar");

            setMensaje(body.recalculadas > 0 ? `Regla actualizada. Se recalcularon ${body.recalculadas} programaciones.` : "Regla actualizada correctamente.");
            setReglas((prev) =>
                prev.map((r) =>
                    r.id === body.id
                        ? {
                            ...r,
                            offset: body.offset,
                            canal: body.canal,
                            plantillaClave: body.plantillaClave,
                            obligatoria: body.obligatoria,
                            activa: body.activa,
                        }
                        : r
                )
            );
            cerrarEditor();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="space-y-5">
            <GlassCard>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Reglas de disparo</h2>
                    <p className="text-sm text-muted">
                        Configurá offset, canal, plantilla y obligatoriedad de cada regla. Cambiar el offset de una regla activa recalcula las programaciones futuras.
                    </p>
                </div>
                {mensaje && <Alerta tono="exito" className="mb-4">{mensaje}</Alerta>}
                {error && !editando && <Alerta tono="error" className="mb-4">{error}</Alerta>}

                {loading ? (
                    <Cargando texto="Cargando reglas..." />
                ) : reglas.length === 0 ? (
                    <EmptyState title="Sin reglas" description="No se encontraron reglas configuradas." />
                ) : (
                    <div className="space-y-3">
                        {reglas.map((r) => (
                            <div
                                key={r.id}
                                className="flex flex-col gap-3 rounded-xl border border-tinta/10 bg-papel/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-body">{r.evento}</span>
                                        <Badge variant={r.activa ? "success" : "neutral"}>{r.activa ? "Activa" : "Inactiva"}</Badge>
                                        {r.obligatoria && <Badge variant="info">Obligatoria</Badge>}
                                    </div>
                                    <p className="mt-1 text-xs text-muted">
                                        {CANAL_LABELS[r.canal]} · offset {r.offset} · plantilla {r.plantillaClave} · {r.programadas} programadas
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => abrirEditor(r)}>
                                    Editar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <Modal isOpen={!!editando} onClose={cerrarEditor} title={`Editar regla: ${editando?.evento}`} size="lg">
                <div className="space-y-4">
                    {error && editando && <Alerta tono="error">{error}</Alerta>}
                    {mensaje && editando && <Alerta tono="exito">{mensaje}</Alerta>}

                    {confirmacion ? (
                        <div className="space-y-4">
                            <Alerta tono="advertencia">
                                Cambiar el offset recalculará {confirmacion.programadas} programaciones futuras para el evento{" "}
                                <strong>{confirmacion.evento}</strong>.
                            </Alerta>
                            <div className="flex flex-wrap justify-end gap-3">
                                <Button variant="ghost" onClick={() => setConfirmacion(null)}>
                                    Volver
                                </Button>
                                <Button isLoading={guardando} onClick={() => void guardar(true)}>
                                    Confirmar recálculo
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Input
                                label="Offset"
                                value={form.offset}
                                onChange={(e) => setForm((f) => ({ ...f, offset: e.target.value }))}
                                placeholder="+1d, -2h, +30m"
                            />
                            <Select
                                label="Canal"
                                options={CANAL_OPTIONS}
                                value={form.canal}
                                onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value as "EMAIL" | "IN_APP" }))}
                            />
                            <Input
                                label="Clave de plantilla"
                                value={form.plantillaClave}
                                onChange={(e) => setForm((f) => ({ ...f, plantillaClave: e.target.value }))}
                            />
                            <label className="flex items-center gap-3 text-sm text-body">
                                <input
                                    type="checkbox"
                                    checked={form.obligatoria}
                                    onChange={(e) => setForm((f) => ({ ...f, obligatoria: e.target.checked }))}
                                    className="h-4 w-4 rounded border-tinta/30 text-ambar focus:ring-ambar"
                                />
                                Obligatoria
                            </label>
                            <label className="flex items-center gap-3 text-sm text-body">
                                <input
                                    type="checkbox"
                                    checked={form.activa}
                                    onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
                                    className="h-4 w-4 rounded border-tinta/30 text-ambar focus:ring-ambar"
                                />
                                Activa
                            </label>
                            <div className="flex flex-wrap justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={cerrarEditor}>
                                    Cancelar
                                </Button>
                                <Button isLoading={guardando} onClick={() => void guardar(false)}>
                                    Guardar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}
