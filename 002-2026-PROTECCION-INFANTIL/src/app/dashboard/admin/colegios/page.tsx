"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type Pais = { id: string; nombre: string };
type Ciudad = { id: string; nombre: string; paisId?: string };
type AdminUsuario = { id: string; email: string; nombre: string | null; estado: string };
type Colegio = {
    id: string;
    nombre: string;
    paisId: string;
    pais: Pais;
    departamentoId?: string | null;
    departamento?: Pais | null;
    ciudadId: string;
    ciudad: Ciudad;
    direccion?: string | null;
    representanteLegalNombre: string;
    representanteLegalIdentificacion?: string | null;
    representanteLegalEmail?: string | null;
    representanteLegalTelefono?: string | null;
    inicioServicio: string;
    finServicio: string;
    tipoPeriodo: "MENSUAL" | "SEMESTRAL" | "ANUAL";
    estado: "activo" | "inactivo";
    admin: AdminUsuario;
    tenantId: string;
};

type ColegioFormEdit = {
    nombre?: string;
    paisId?: string;
    ciudadId?: string;
    representanteLegalNombre?: string;
    representanteLegalEmail?: string;
    representanteLegalTelefono?: string;
    inicioServicio?: string;
    finServicio?: string;
    tipoPeriodo?: "MENSUAL" | "SEMESTRAL" | "ANUAL";
    estado?: "activo" | "inactivo";
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const tipoPeriodoLabels: Record<string, string> = {
    MENSUAL: "Mensual",
    SEMESTRAL: "Semestral",
    ANUAL: "Anual",
};

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function toDatetimeLocal(iso: string) {
    try {
        const d = new Date(iso);
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().slice(0, 16);
    } catch {
        return "";
    }
}

export default function AdminColegiosPage() {
    const router = useRouter();
    const [colegios, setColegios] = useState<Colegio[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<ColegioFormEdit>({});
    const [paises, setPaises] = useState<Pais[]>([]);
    const [ciudades, setCiudades] = useState<Ciudad[]>([]);
    const [saving, setSaving] = useState(false);

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/colegios", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setColegios(data.colegios || []);
                setMessage(null);
            } else {
                setError(data?.error?.message || "Error cargando colegios");
            }
        } catch {
            setError("Error de red cargando colegios");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    useEffect(() => {
        fetch("/api/paises", { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((data) => setPaises(data.paises || []))
            .catch(() => {});
    }, []);

    async function cargarCiudades(paisId: string) {
        if (!paisId) {
            setCiudades([]);
            return;
        }
        try {
            const res = await fetch(`/api/ciudades?paisId=${encodeURIComponent(paisId)}`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCiudades(data.ciudades || []);
            } else {
                setCiudades([]);
            }
        } catch {
            setCiudades([]);
        }
    }

    async function toggleEstado(colegio: Colegio) {
        const nuevoEstado = colegio.estado === "activo" ? "inactivo" : "activo";
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/colegios/${colegio.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Colegio ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        } finally {
            setSaving(false);
        }
    }

    function iniciarEdicion(colegio: Colegio) {
        setEditingId(colegio.id);
        setEditForm({
            nombre: colegio.nombre,
            paisId: colegio.paisId,
            ciudadId: colegio.ciudadId,
            representanteLegalNombre: colegio.representanteLegalNombre,
            representanteLegalEmail: colegio.representanteLegalEmail || "",
            representanteLegalTelefono: colegio.representanteLegalTelefono || "",
            inicioServicio: toDatetimeLocal(colegio.inicioServicio),
            finServicio: toDatetimeLocal(colegio.finServicio),
            tipoPeriodo: colegio.tipoPeriodo,
            estado: colegio.estado,
        });
        cargarCiudades(colegio.paisId);
    }

    async function guardarEdicion(id: string) {
        if (!editForm.nombre || !editForm.paisId || !editForm.ciudadId || !editForm.representanteLegalNombre) {
            setMessage({ type: "error", text: "Completa los campos requeridos" });
            return;
        }
        if (editForm.inicioServicio && editForm.finServicio && editForm.finServicio <= editForm.inicioServicio) {
            setMessage({ type: "error", text: "La fecha de fin debe ser posterior al inicio" });
            return;
        }

        setSaving(true);
        setMessage(null);
        const payload: Record<string, unknown> = {
            nombre: editForm.nombre,
            paisId: editForm.paisId,
            ciudadId: editForm.ciudadId,
            representanteLegalNombre: editForm.representanteLegalNombre,
            representanteLegalEmail: editForm.representanteLegalEmail || null,
            representanteLegalTelefono: editForm.representanteLegalTelefono || null,
            inicioServicio: editForm.inicioServicio,
            finServicio: editForm.finServicio,
            tipoPeriodo: editForm.tipoPeriodo,
            estado: editForm.estado,
        };

        try {
            const res = await fetch(`/api/admin/colegios/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEditingId(null);
                setEditForm({});
                setMessage({ type: "success", text: "Colegio actualizado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando colegio" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando colegio" });
        } finally {
            setSaving(false);
        }
    }

    const resumen = useMemo(() => {
        const activos = colegios.filter((c) => c.estado === "activo").length;
        const inactivos = colegios.length - activos;
        return { total: colegios.length, activos, inactivos };
    }, [colegios]);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">Colegios</h1>
                    <p className="text-sm text-muted">Gestiona las instituciones educativas y sus administradores.</p>
                </div>
                <Button onClick={() => router.push("/dashboard/admin/colegios/nuevo")}>
                    Nuevo colegio
                </Button>
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

            <section className="space-y-4" aria-labelledby="colegios-resumen-title">
                <h2 id="colegios-resumen-title" className="text-lg font-semibold text-body">
                    Resumen
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    <GlassCard className="p-4">
                        <p className="text-xs text-muted">Total</p>
                        <p className="mt-1 text-2xl font-bold text-body">{resumen.total}</p>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <p className="text-xs text-muted">Activos</p>
                        <p className="mt-1 text-2xl font-bold text-body">{resumen.activos}</p>
                    </GlassCard>
                    <GlassCard className="p-4">
                        <p className="text-xs text-muted">Inactivos</p>
                        <p className="mt-1 text-2xl font-bold text-body">{resumen.inactivos}</p>
                    </GlassCard>
                </div>
            </section>

            <section aria-labelledby="colegios-listado-title">
                <GlassCard>
                    <h2 id="colegios-listado-title" className="text-lg font-semibold text-body">
                        Listado
                    </h2>
                    {loading ? (
                        <div className="flex items-center gap-3 py-8 text-muted">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                            Cargando colegios...
                        </div>
                    ) : error ? (
                        <ErrorState title="No pudimos cargar los colegios" description={error} onRetry={cargar} />
                    ) : colegios.length === 0 ? (
                        <EmptyState
                            title="No hay colegios registrados"
                            description="Crea el primer colegio para comenzar a gestionar instituciones."
                        />
                    ) : (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 dark:border-slate-800">
                                    <tr className="text-subtle">
                                        <th className="pb-3 font-medium">Nombre</th>
                                        <th className="pb-3 font-medium">Ciudad / País</th>
                                        <th className="pb-3 font-medium">Representante legal</th>
                                        <th className="pb-3 font-medium">Estado</th>
                                        <th className="pb-3 font-medium">Vigencia</th>
                                        <th className="pb-3 font-medium text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {colegios.map((colegio) => (
                                        <Fragment key={colegio.id}>
                                            <tr className="align-top">
                                                <td className="py-3 pr-3 font-medium text-body">{colegio.nombre}</td>
                                                <td className="py-3 pr-3 text-muted">
                                                    {colegio.ciudad?.nombre || "—"}, {colegio.pais?.nombre || "—"}
                                                </td>
                                                <td className="py-3 pr-3 text-muted">
                                                    <div>{colegio.representanteLegalNombre}</div>
                                                    {colegio.representanteLegalEmail && (
                                                        <div className="text-xs text-subtle">{colegio.representanteLegalEmail}</div>
                                                    )}
                                                    {colegio.representanteLegalTelefono && (
                                                        <div className="text-xs text-subtle">{colegio.representanteLegalTelefono}</div>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <Badge variant={colegio.estado === "activo" ? "success" : "neutral"}>
                                                        {colegio.estado === "activo" ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pr-3 text-muted">
                                                    <div className="text-xs">{formatDate(colegio.inicioServicio)}</div>
                                                    <div className="text-xs">→ {formatDate(colegio.finServicio)}</div>
                                                    <div className="mt-1 text-xs font-medium text-subtle">
                                                        {tipoPeriodoLabels[colegio.tipoPeriodo]}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => iniciarEdicion(colegio)}
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant={colegio.estado === "activo" ? "danger" : "secondary"}
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => toggleEstado(colegio)}
                                                            isLoading={saving}
                                                        >
                                                            {colegio.estado === "activo" ? "Desactivar" : "Activar"}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {editingId === colegio.id && (
                                                <EditRow
                                                    values={editForm}
                                                    setValues={setEditForm}
                                                    paises={paises}
                                                    ciudades={ciudades}
                                                    onLoadCiudades={cargarCiudades}
                                                    onSave={() => guardarEdicion(colegio.id)}
                                                    onCancel={() => {
                                                        setEditingId(null);
                                                        setEditForm({});
                                                    }}
                                                    saving={saving}
                                                />
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassCard>
            </section>
        </div>
    );
}

function EditRow({
    values,
    setValues,
    paises,
    ciudades,
    onLoadCiudades,
    onSave,
    onCancel,
    saving,
}: {
    values: ColegioFormEdit;
    setValues: (v: ColegioFormEdit) => void;
    paises: Pais[];
    ciudades: Ciudad[];
    onLoadCiudades: (paisId: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    return (
        <tr>
            <td colSpan={6} className="py-3">
                <div className="glass rounded-2xl p-4">
                    <h3 className="mb-4 text-sm font-semibold text-body">Editar colegio</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Input
                            label="Nombre"
                            required
                            value={values.nombre || ""}
                            onChange={(e) => setValues({ ...values, nombre: e.target.value })}
                        />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-body">
                                País <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={values.paisId || ""}
                                onChange={(e) => {
                                    const paisId = e.target.value;
                                    setValues({ ...values, paisId, ciudadId: "" });
                                    onLoadCiudades(paisId);
                                }}
                                className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                            >
                                <option value="">Selecciona país</option>
                                {paises.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-body">
                                Ciudad <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={values.ciudadId || ""}
                                onChange={(e) => setValues({ ...values, ciudadId: e.target.value })}
                                className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                            >
                                <option value="">Selecciona ciudad</option>
                                {ciudades.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Input
                            label="Representante legal"
                            required
                            value={values.representanteLegalNombre || ""}
                            onChange={(e) => setValues({ ...values, representanteLegalNombre: e.target.value })}
                        />
                        <Input
                            label="Email representante"
                            type="email"
                            value={values.representanteLegalEmail || ""}
                            onChange={(e) => setValues({ ...values, representanteLegalEmail: e.target.value })}
                        />
                        <Input
                            label="Teléfono representante"
                            value={values.representanteLegalTelefono || ""}
                            onChange={(e) => setValues({ ...values, representanteLegalTelefono: e.target.value })}
                        />
                        <Input
                            label="Inicio servicio"
                            type="datetime-local"
                            required
                            value={values.inicioServicio || ""}
                            onChange={(e) => setValues({ ...values, inicioServicio: e.target.value })}
                        />
                        <Input
                            label="Fin servicio"
                            type="datetime-local"
                            required
                            value={values.finServicio || ""}
                            onChange={(e) => setValues({ ...values, finServicio: e.target.value })}
                        />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-body">Tipo de periodo</label>
                            <select
                                value={values.tipoPeriodo || ""}
                                onChange={(e) =>
                                    setValues({ ...values, tipoPeriodo: e.target.value as ColegioFormEdit["tipoPeriodo"] })
                                }
                                className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                            >
                                <option value="MENSUAL">Mensual</option>
                                <option value="SEMESTRAL">Semestral</option>
                                <option value="ANUAL">Anual</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-body">Estado</label>
                            <select
                                value={values.estado || ""}
                                onChange={(e) => setValues({ ...values, estado: e.target.value as ColegioFormEdit["estado"] })}
                                className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                            >
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                            <Button variant="outline" onClick={onCancel} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={onSave} isLoading={saving}>
                                Guardar cambios
                            </Button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
}
