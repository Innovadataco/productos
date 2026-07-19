"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { OperadoresSubNav } from "../components/OperadoresSubNav";

type Perfil = {
    cupoMaximo: number;
    esRevisorDeApelaciones: boolean;
    notasInternas: string | null;
    creadoPorId: string;
};

type Operador = {
    id: string;
    email: string;
    nombre: string | null;
    estado: "activo" | "inactivo";
    debeCambiarPassword: boolean;
    tenantId: string | null;
    perfil: Perfil | null;
    casosAbiertos: number;
    casosTotales: number;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const initialForm = {
    email: "",
    nombre: "",
    cupoMaximo: "10",
    esRevisorDeApelaciones: false,
    notasInternas: "",
};

export default function AdminOperadoresGestionPage() {
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<Mensaje>(null);
    const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<Operador & Perfil>>({});

    async function cargar() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/operadores", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setOperadores(data.operadores || []);
                setMessage(null);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando operadores" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando operadores" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    const resumen = useMemo(() => {
        const activos = operadores.filter((o) => o.estado === "activo").length;
        const inactivos = operadores.length - activos;
        const casosAbiertos = operadores.reduce((acc, o) => acc + o.casosAbiertos, 0);
        const revisores = operadores.filter((o) => o.perfil?.esRevisorDeApelaciones && o.estado === "activo").length;
        return { total: operadores.length, activos, inactivos, casosAbiertos, revisores };
    }, [operadores]);

    async function crear(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/operadores", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: form.email,
                    nombre: form.nombre,
                    cupoMaximo: Number(form.cupoMaximo),
                    esRevisorDeApelaciones: form.esRevisorDeApelaciones,
                    notasInternas: form.notasInternas,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setForm(initialForm);
                setPasswordTemporal(data.passwordTemporal || null);
                setMessage({ type: "success", text: data.mensaje || "Operador creado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error creando operador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red creando operador" });
        } finally {
            setSaving(false);
        }
    }

    async function regenerarPassword(id: string) {
        setMessage(null);
        setPasswordTemporal(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}/regenerar-password`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setPasswordTemporal(data.passwordTemporal || null);
                setMessage({ type: "success", text: data.mensaje || "Contraseña regenerada" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error regenerando contraseña" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red regenerando contraseña" });
        }
    }

    async function reenviarEmail(id: string) {
        setMessage(null);
        setPasswordTemporal(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}/reenviar-email`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setPasswordTemporal(data.passwordTemporal || null);
                setMessage({ type: "success", text: data.mensaje || "Email reenviado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error reenviando email" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red reenviando email" });
        }
    }

    async function guardarEdicion(id: string) {
        setSaving(true);
        setMessage(null);
        try {
            const payload: Record<string, unknown> = {};
            if (editValues.nombre !== undefined) payload.nombre = editValues.nombre;
            if (editValues.estado !== undefined) payload.estado = editValues.estado;
            if (editValues.cupoMaximo !== undefined) payload.cupoMaximo = editValues.cupoMaximo;
            if (editValues.esRevisorDeApelaciones !== undefined) payload.esRevisorDeApelaciones = editValues.esRevisorDeApelaciones;
            if (editValues.notasInternas !== undefined) payload.notasInternas = editValues.notasInternas;

            const res = await fetch(`/api/admin/operadores/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEditingId(null);
                setEditValues({});
                setMessage({ type: "success", text: "Operador actualizado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando operador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando operador" });
        } finally {
            setSaving(false);
        }
    }

    async function reactivar(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}/reactivar`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Operador reactivado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error reactivando operador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red reactivando operador" });
        }
    }

    async function desactivar(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Operador desactivado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error desactivando operador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red desactivando operador" });
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Operadores de casos</h1>
                <p className="text-sm text-muted">Crea, edita y activa los operadores que atenderán la cola de revisión manual y apelaciones.</p>
            </div>

            <OperadoresSubNav />

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

            {passwordTemporal && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Contraseña temporal (muéstrela una vez)</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="rounded-lg bg-white/60 px-3 py-1.5 font-mono text-base dark:bg-slate-900/60">{passwordTemporal}</code>
                        <Button
                            type="button"
                            variant="outline"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => navigator.clipboard.writeText(passwordTemporal)}
                        >
                            Copiar
                        </Button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">El operador debe usar esta contraseña para iniciar sesión. No se volverá a mostrar.</p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <ResumenCard label="Total" value={resumen.total} />
                <ResumenCard label="Activos" value={resumen.activos} variant="success" />
                <ResumenCard label="Inactivos" value={resumen.inactivos} variant="neutral" />
                <ResumenCard label="Casos abiertos" value={resumen.casosAbiertos} variant="warning" />
                <ResumenCard label="Revisores apelaciones" value={resumen.revisores} variant="info" />
            </div>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Nuevo operador</h2>
                <p className="text-sm text-muted">Se genera una contraseña temporal y se envía por email.</p>
                <form onSubmit={crear} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                        label="Email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <Input
                        label="Nombre"
                        required
                        value={form.nombre}
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                    <Input
                        label="Cupo máximo"
                        type="number"
                        min={1}
                        max={200}
                        required
                        value={form.cupoMaximo}
                        onChange={(e) => setForm((f) => ({ ...f, cupoMaximo: e.target.value }))}
                    />
                    <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 text-sm text-body">
                            <input
                                type="checkbox"
                                checked={form.esRevisorDeApelaciones}
                                onChange={(e) => setForm((f) => ({ ...f, esRevisorDeApelaciones: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                            />
                            Revisor de apelaciones
                        </label>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                        <Input
                            label="Notas internas"
                            value={form.notasInternas}
                            onChange={(e) => setForm((f) => ({ ...f, notasInternas: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" isLoading={saving} className="w-full">
                            Crear operador
                        </Button>
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Listado</h2>
                {loading ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando operadores...
                    </div>
                ) : operadores.length === 0 ? (
                    <p className="py-6 text-sm text-muted">No hay operadores registrados.</p>
                ) : (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Nombre</th>
                                    <th className="pb-3 font-medium">Email</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Cupo</th>
                                    <th className="pb-3 font-medium">Casos</th>
                                    <th className="pb-3 font-medium">Apelaciones</th>
                                    <th className="pb-3 font-medium">Notas</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {operadores.map((op) => (
                                    <tr key={op.id} className="align-top">
                                        {editingId === op.id ? (
                                            <EditableRow
                                                op={op}
                                                values={editValues}
                                                setValues={setEditValues}
                                                onSave={() => guardarEdicion(op.id)}
                                                onCancel={() => {
                                                    setEditingId(null);
                                                    setEditValues({});
                                                }}
                                                saving={saving}
                                            />
                                        ) : (
                                            <ReadOnlyRow
                                                op={op}
                                                onEdit={() => {
                                                    setEditingId(op.id);
                                                    setEditValues({
                                                        nombre: op.nombre || "",
                                                        estado: op.estado,
                                                        cupoMaximo: op.perfil?.cupoMaximo ?? 10,
                                                        esRevisorDeApelaciones: op.perfil?.esRevisorDeApelaciones ?? false,
                                                        notasInternas: op.perfil?.notasInternas || "",
                                                    });
                                                }}
                                                onToggle={() =>
                                                    op.estado === "activo" ? desactivar(op.id) : reactivar(op.id)
                                                }
                                                onRegenerarPassword={() => regenerarPassword(op.id)}
                                                onReenviarEmail={() => reenviarEmail(op.id)}
                                            />
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

function ResumenCard({
    label,
    value,
    variant = "default",
}: {
    label: string;
    value: number;
    variant?: "default" | "success" | "neutral" | "warning" | "info";
}) {
    return (
        <GlassCard className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className={`mt-1 text-2xl font-bold text-body`}>{value}</p>
        </GlassCard>
    );
}

function ReadOnlyRow({
    op,
    onEdit,
    onToggle,
    onRegenerarPassword,
    onReenviarEmail,
}: {
    op: Operador;
    onEdit: () => void;
    onToggle: () => void;
    onRegenerarPassword: () => void;
    onReenviarEmail: () => void;
}) {
    return (
        <>
            <td className="py-3 pr-3 text-body">
                <div className="flex items-center gap-2">
                    {op.nombre || "—"}
                    {op.debeCambiarPassword && (
                        <Badge variant="warning" className="text-[10px]">
                            Debe cambiar contraseña
                        </Badge>
                    )}
                </div>
            </td>
            <td className="py-3 pr-3 text-muted">{op.email}</td>
            <td className="py-3 pr-3">
                <Badge variant={op.estado === "activo" ? "success" : "neutral"}>
                    {op.estado === "activo" ? "Activo" : "Inactivo"}
                </Badge>
            </td>
            <td className="py-3 pr-3 text-muted">{op.perfil?.cupoMaximo ?? "—"}</td>
            <td className="py-3 pr-3 text-muted">
                {op.casosAbiertos} / {op.casosTotales}
            </td>
            <td className="py-3 pr-3 text-muted">{op.perfil?.esRevisorDeApelaciones ? "Sí" : "No"}</td>
            <td className="py-3 pr-3 text-muted max-w-[200px] truncate" title={op.perfil?.notasInternas || undefined}>
                {op.perfil?.notasInternas || "—"}
            </td>
            <td className="py-3 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onEdit}>
                        Editar
                    </Button>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onRegenerarPassword}>
                        Regenerar pass
                    </Button>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onReenviarEmail}>
                        Reenviar email
                    </Button>
                    <Button
                        variant={op.estado === "activo" ? "danger" : "secondary"}
                        className="px-3 py-1.5 text-xs"
                        onClick={onToggle}
                    >
                        {op.estado === "activo" ? "Desactivar" : "Reactivar"}
                    </Button>
                </div>
            </td>
        </>
    );
}

function EditableRow({
    op,
    values,
    setValues,
    onSave,
    onCancel,
    saving,
}: {
    op: Operador;
    values: Partial<Operador & Perfil>;
    setValues: (v: Partial<Operador & Perfil>) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    return (
        <>
            <td className="py-3 pr-3">
                <input
                    type="text"
                    value={values.nombre || ""}
                    onChange={(e) => setValues({ ...values, nombre: e.target.value })}
                    className="w-full rounded-lg px-2 py-1 text-sm text-body glass-input"
                />
            </td>
            <td className="py-3 pr-3 text-muted">{op.email}</td>
            <td className="py-3 pr-3">
                <select
                    value={values.estado}
                    onChange={(e) => setValues({ ...values, estado: e.target.value as "activo" | "inactivo" })}
                    className="rounded-lg px-2 py-1 text-sm text-body glass-input"
                >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                </select>
            </td>
            <td className="py-3 pr-3">
                <input
                    type="number"
                    min={1}
                    max={200}
                    value={values.cupoMaximo}
                    onChange={(e) => setValues({ ...values, cupoMaximo: Number(e.target.value) })}
                    className="w-20 rounded-lg px-2 py-1 text-sm text-body glass-input"
                />
            </td>
            <td className="py-3 pr-3 text-muted">
                {op.casosAbiertos} / {op.casosTotales}
            </td>
            <td className="py-3 pr-3">
                <select
                    value={values.esRevisorDeApelaciones ? "true" : "false"}
                    onChange={(e) => setValues({ ...values, esRevisorDeApelaciones: e.target.value === "true" })}
                    className="rounded-lg px-2 py-1 text-sm text-body glass-input"
                >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                </select>
            </td>
            <td className="py-3 pr-3">
                <input
                    type="text"
                    value={values.notasInternas || ""}
                    onChange={(e) => setValues({ ...values, notasInternas: e.target.value })}
                    className="w-full rounded-lg px-2 py-1 text-sm text-body glass-input"
                />
            </td>
            <td className="py-3 text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button className="px-3 py-1.5 text-xs" onClick={onSave} isLoading={saving}>
                        Guardar
                    </Button>
                </div>
            </td>
        </>
    );
}
