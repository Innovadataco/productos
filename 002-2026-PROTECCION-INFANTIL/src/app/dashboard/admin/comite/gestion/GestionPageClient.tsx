"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Perfil = {
    cupoMaximo: number | null;
    esRevisorDeApelaciones: boolean;
    esComite: boolean;
    notasInternas: string | null;
    creadoPorId: string;
    ultimoEmailNotificacionEn: string | null;
};

type CuentaComite = {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    estado: "activo" | "inactivo";
    debeCambiarPassword: boolean;
    tenantId: string | null;
    perfil: Perfil | null;
    casosAbiertos: number;
    casosTotales: number;
};

type Integrante = {
    id: string;
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    email: string;
    fechaInicio: string;
    fechaFin: string | null;
    estado: "ACTIVO" | "INACTIVO";
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const tiposIdentificacion = [
    { value: "CEDULA_CIUDADANIA", label: "Cédula de ciudadanía" },
    { value: "CEDULA_EXTRANJERIA", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
];

const estadosIntegrante = [
    { value: "ACTIVO", label: "Activo" },
    { value: "INACTIVO", label: "Inactivo" },
];

const initialCuentaForm = { email: "", nombre: "" };
const initialIntegranteForm = {
    nombres: "",
    apellidos: "",
    tipoIdentificacion: "CEDULA_CIUDADANIA",
    numeroIdentificacion: "",
    email: "",
    fechaInicio: new Date().toISOString().split("T")[0],
    estado: "ACTIVO" as "ACTIVO" | "INACTIVO",
};

export default function GestionPageClient() {
    const [cuenta, setCuenta] = useState<CuentaComite | null>(null);
    const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
    const [loadingCuenta, setLoadingCuenta] = useState(true);
    const [loadingIntegrantes, setLoadingIntegrantes] = useState(false);
    const [message, setMessage] = useState<Mensaje>(null);
    const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
    const [cuentaForm, setCuentaForm] = useState(initialCuentaForm);
    const [savingCuenta, setSavingCuenta] = useState(false);
    const [integranteForm, setIntegranteForm] = useState(initialIntegranteForm);
    const [editingIntegranteId, setEditingIntegranteId] = useState<string | null>(null);
    const [savingIntegrante, setSavingIntegrante] = useState(false);

    const hayCuenta = Boolean(cuenta);

    const cargarIntegrantes = useCallback(async (comiteId: string) => {
        setLoadingIntegrantes(true);
        try {
            const res = await fetch(`/api/admin/comite/integrantes?comiteId=${encodeURIComponent(comiteId)}`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setIntegrantes(data.integrantes || []);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando integrantes" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando integrantes" });
        } finally {
            setLoadingIntegrantes(false);
        }
    }, []);

    const cargarCuenta = useCallback(async () => {
        setLoadingCuenta(true);
        try {
            const res = await fetch("/api/admin/operadores", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const comite = (data.operadores || []).find((o: CuentaComite) => o.rol === "COMITE_VALIDACION");
                setCuenta(comite || null);
                if (comite) {
                    await cargarIntegrantes(comite.id);
                }
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando cuenta del comité" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando cuenta del comité" });
        } finally {
            setLoadingCuenta(false);
        }
    }, [cargarIntegrantes]);

    useEffect(() => {
        cargarCuenta();
    }, [cargarCuenta]);

    const resumen = useMemo(() => {
        const activos = integrantes.filter((i) => i.estado === "ACTIVO").length;
        const inactivos = integrantes.length - activos;
        return { total: integrantes.length, activos, inactivos };
    }, [integrantes]);

    async function crearCuenta(e: React.FormEvent) {
        e.preventDefault();
        setSavingCuenta(true);
        setMessage(null);
        setPasswordTemporal(null);
        try {
            const res = await fetch("/api/admin/operadores", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: cuentaForm.email,
                    nombre: cuentaForm.nombre,
                    rol: "COMITE_VALIDACION",
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCuentaForm(initialCuentaForm);
                setPasswordTemporal(data.passwordTemporal || null);
                setMessage({ type: "success", text: data.mensaje || "Cuenta del comité creada" });
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error creando la cuenta del comité" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red creando la cuenta del comité" });
        } finally {
            setSavingCuenta(false);
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
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error regenerando la contraseña" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red regenerando la contraseña" });
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
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error reenviando el email" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red reenviando el email" });
        }
    }

    async function reactivarCuenta(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}/reactivar`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Cuenta del comité reactivada" });
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error reactivando la cuenta" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red reactivando la cuenta" });
        }
    }

    async function desactivarCuenta(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Cuenta del comité desactivada" });
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error desactivando la cuenta" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red desactivando la cuenta" });
        }
    }

    async function actualizarNombreCuenta(id: string, nombre: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/operadores/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Nombre de la cuenta actualizado" });
                await cargarCuenta();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando el nombre" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando el nombre" });
        }
    }

    async function guardarIntegrante(e: React.FormEvent) {
        e.preventDefault();
        if (!cuenta) return;
        setSavingIntegrante(true);
        setMessage(null);
        try {
            const payload = {
                comiteId: cuenta.id,
                nombres: integranteForm.nombres,
                apellidos: integranteForm.apellidos,
                tipoIdentificacion: integranteForm.tipoIdentificacion,
                numeroIdentificacion: integranteForm.numeroIdentificacion,
                email: integranteForm.email,
                fechaInicio: new Date(integranteForm.fechaInicio).toISOString(),
            };

            const url = editingIntegranteId
                ? `/api/admin/comite/integrantes/${editingIntegranteId}`
                : "/api/admin/comite/integrantes";
            const method = editingIntegranteId ? "PATCH" : "POST";
            const body = editingIntegranteId
                ? { ...payload, estado: integranteForm.estado }
                : payload;

            const res = await fetch(url, {
                method,
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setIntegranteForm(initialIntegranteForm);
                setEditingIntegranteId(null);
                setMessage({ type: "success", text: editingIntegranteId ? "Integrante actualizado" : "Integrante registrado" });
                await cargarIntegrantes(cuenta.id);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error guardando el integrante" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red guardando el integrante" });
        } finally {
            setSavingIntegrante(false);
        }
    }

    async function inactivarIntegrante(id: string) {
        if (!cuenta) return;
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/comite/integrantes/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: "Integrante inactivado" });
                await cargarIntegrantes(cuenta.id);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error inactivando el integrante" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red inactivando el integrante" });
        }
    }

    function iniciarEdicion(integrante: Integrante) {
        setEditingIntegranteId(integrante.id);
        setIntegranteForm({
            nombres: integrante.nombres,
            apellidos: integrante.apellidos,
            tipoIdentificacion: integrante.tipoIdentificacion,
            numeroIdentificacion: integrante.numeroIdentificacion,
            email: integrante.email,
            fechaInicio: integrante.fechaInicio.split("T")[0],
            estado: integrante.estado,
        });
    }

    function cancelarEdicion() {
        setEditingIntegranteId(null);
        setIntegranteForm(initialIntegranteForm);
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Comité de Validación</h1>
                <p className="text-sm text-muted">Gestiona la cuenta del comité y sus integrantes.</p>
            </div>

            {message && (
                <div
                    className={`rounded-xl p-4 text-sm ${
                        message.type === "error"
                            ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                            : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    }`}
                >
                    {message.text}
                </div>
            )}

            {passwordTemporal && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Contraseña temporal (muéstrela una vez)</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="rounded-lg bg-white/60 px-3 py-1.5 font-mono text-base dark:bg-slate-900/60">
                            {passwordTemporal}
                        </code>
                        <Button
                            type="button"
                            variant="outline"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => navigator.clipboard.writeText(passwordTemporal)}
                        >
                            Copiar
                        </Button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">
                        El comité debe usar esta contraseña para iniciar sesión. No se volverá a mostrar.
                    </p>
                </div>
            )}

            {loadingCuenta ? (
                <div className="flex items-center gap-3 py-8 text-muted">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                    Cargando cuenta del comité...
                </div>
            ) : !hayCuenta ? (
                <GlassCard>
                    <h2 className="text-lg font-semibold text-body">Crear cuenta del comité</h2>
                    <p className="text-sm text-muted">Se genera una contraseña temporal y se envía por email.</p>
                    <form onSubmit={crearCuenta} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Input
                            label="Email"
                            type="email"
                            required
                            value={cuentaForm.email}
                            onChange={(e) => setCuentaForm((f) => ({ ...f, email: e.target.value }))}
                        />
                        <Input
                            label="Nombre del comité"
                            required
                            value={cuentaForm.nombre}
                            onChange={(e) => setCuentaForm((f) => ({ ...f, nombre: e.target.value }))}
                        />
                        <div className="flex items-end">
                            <Button type="submit" isLoading={savingCuenta} className="w-full">
                                Crear cuenta del comité
                            </Button>
                        </div>
                    </form>
                </GlassCard>
            ) : (
                <>
                    <CuentaComiteCard
                        cuenta={cuenta!}
                        onRegenerarPassword={() => regenerarPassword(cuenta!.id)}
                        onReenviarEmail={() => reenviarEmail(cuenta!.id)}
                        onActivar={() => reactivarCuenta(cuenta!.id)}
                        onDesactivar={() => desactivarCuenta(cuenta!.id)}
                        onActualizarNombre={(nombre) => actualizarNombreCuenta(cuenta!.id, nombre)}
                    />

                    <section className="space-y-4" aria-labelledby="comite-resumen-title">
                        <h2 id="comite-resumen-title" className="text-lg font-semibold text-body">Resumen</h2>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ResumenCard label="Total integrantes" value={resumen.total} />
                            <ResumenCard label="Activos" value={resumen.activos} variant="success" />
                            <ResumenCard label="Inactivos" value={resumen.inactivos} variant="neutral" />
                        </div>
                    </section>

                    <section className="space-y-4" aria-labelledby="comite-integrante-title">
                        <GlassCard>
                            <h2 id="comite-integrante-title" className="text-lg font-semibold text-body">
                                {editingIntegranteId ? "Editar integrante" : "Nuevo integrante"}
                            </h2>
                        <p className="text-sm text-muted">
                            Los datos del integrante son privados. El número de identificación se guarda cifrado.
                        </p>
                        <form onSubmit={guardarIntegrante} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Input
                                label="Nombres"
                                required
                                value={integranteForm.nombres}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, nombres: e.target.value }))}
                            />
                            <Input
                                label="Apellidos"
                                required
                                value={integranteForm.apellidos}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, apellidos: e.target.value }))}
                            />
                            <Select
                                label="Tipo de identificación"
                                options={tiposIdentificacion}
                                value={integranteForm.tipoIdentificacion}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, tipoIdentificacion: e.target.value }))}
                            />
                            <Input
                                label="Número de identificación"
                                required
                                value={integranteForm.numeroIdentificacion}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, numeroIdentificacion: e.target.value }))}
                            />
                            <Input
                                label="Email"
                                type="email"
                                required
                                value={integranteForm.email}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, email: e.target.value }))}
                            />
                            <Input
                                label="Fecha de inicio"
                                type="date"
                                required
                                value={integranteForm.fechaInicio}
                                onChange={(e) => setIntegranteForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                            />
                            {editingIntegranteId && (
                                <Select
                                    label="Estado"
                                    options={estadosIntegrante}
                                    value={integranteForm.estado}
                                    onChange={(e) =>
                                        setIntegranteForm((f) => ({ ...f, estado: e.target.value as "ACTIVO" | "INACTIVO" }))
                                    }
                                />
                            )}
                            <div className="flex items-end gap-2">
                                {editingIntegranteId && (
                                    <Button type="button" variant="outline" onClick={cancelarEdicion} className="w-full">
                                        Cancelar
                                    </Button>
                                )}
                                <Button type="submit" isLoading={savingIntegrante} className="w-full">
                                    {editingIntegranteId ? "Guardar cambios" : "Registrar integrante"}
                                </Button>
                            </div>
                        </form>
                    </GlassCard>
                    </section>

                    <section className="space-y-4" aria-labelledby="comite-listado-title">
                        <GlassCard>
                            <h2 id="comite-listado-title" className="text-lg font-semibold text-body">Integrantes del comité</h2>
                            {loadingIntegrantes ? (
                                <div className="flex items-center gap-3 py-8 text-muted">
                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                    Cargando integrantes...
                                </div>
                            ) : integrantes.length === 0 ? (
                                <EmptyState
                                    title="No hay integrantes registrados"
                                    description="Registra los integrantes que formarán parte del comité de validación."
                                />
                            ) : (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-slate-200 dark:border-slate-800">
                                        <tr className="text-subtle">
                                            <th className="pb-3 font-medium">Nombres</th>
                                            <th className="pb-3 font-medium">Apellidos</th>
                                            <th className="pb-3 font-medium">Identificación</th>
                                            <th className="pb-3 font-medium">Email</th>
                                            <th className="pb-3 font-medium">Inicio</th>
                                            <th className="pb-3 font-medium">Estado</th>
                                            <th className="pb-3 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {integrantes.map((integrante) => (
                                            <tr key={integrante.id} className="align-top">
                                                <td className="py-3 pr-3 text-body">{integrante.nombres}</td>
                                                <td className="py-3 pr-3 text-body">{integrante.apellidos}</td>
                                                <td className="py-3 pr-3 text-muted">
                                                    {labelTipoIdentificacion(integrante.tipoIdentificacion)} · {integrante.numeroIdentificacion}
                                                </td>
                                                <td className="py-3 pr-3 text-muted">{integrante.email}</td>
                                                <td className="py-3 pr-3 text-muted">
                                                    {new Date(integrante.fechaInicio).toLocaleDateString("es-CO")}
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <Badge variant={integrante.estado === "ACTIVO" ? "success" : "neutral"}>
                                                        {integrante.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            className="px-3 py-1.5 text-xs"
                                                            onClick={() => iniciarEdicion(integrante)}
                                                        >
                                                            Editar
                                                        </Button>
                                                        {integrante.estado === "ACTIVO" && (
                                                            <Button
                                                                variant="danger"
                                                                className="px-3 py-1.5 text-xs"
                                                                onClick={() => inactivarIntegrante(integrante.id)}
                                                            >
                                                                Inactivar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                    </section>
                </>
            )}
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
            <p className="mt-1 text-2xl font-bold text-body">{value}</p>
        </GlassCard>
    );
}

function CuentaComiteCard({
    cuenta,
    onRegenerarPassword,
    onReenviarEmail,
    onActivar,
    onDesactivar,
    onActualizarNombre,
}: {
    cuenta: CuentaComite;
    onRegenerarPassword: () => void;
    onReenviarEmail: () => void;
    onActivar: () => void;
    onDesactivar: () => void;
    onActualizarNombre: (nombre: string) => void;
}) {
    const [editando, setEditando] = useState(false);
    const [nombre, setNombre] = useState(cuenta.nombre || "");

    return (
        <GlassCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-body">Cuenta del comité</h2>
                    <div className="flex items-center gap-2">
                        {editando ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    className="rounded-lg px-2 py-1 text-sm text-body glass-input"
                                />
                                <Button
                                    variant="outline"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => {
                                        onActualizarNombre(nombre);
                                        setEditando(false);
                                    }}
                                >
                                    Guardar
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => {
                                        setNombre(cuenta.nombre || "");
                                        setEditando(false);
                                    }}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-body font-medium">{cuenta.nombre || "—"}</span>
                                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditando(true)}>
                                    Editar nombre
                                </Button>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-muted">{cuenta.email}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cuenta.estado === "activo" ? "success" : "neutral"}>
                            {cuenta.estado === "activo" ? "Activo" : "Inactivo"}
                        </Badge>
                        {cuenta.debeCambiarPassword && (
                            <Badge variant="warning" className="text-[10px]">
                                Debe cambiar contraseña
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onRegenerarPassword}>
                        Regenerar contraseña
                    </Button>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={onReenviarEmail}>
                        Reenviar email
                    </Button>
                    {cuenta.estado === "activo" ? (
                        <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={onDesactivar}>
                            Desactivar
                        </Button>
                    ) : (
                        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onActivar}>
                            Reactivar
                        </Button>
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

function labelTipoIdentificacion(value: string) {
    return tiposIdentificacion.find((t) => t.value === value)?.label || value;
}
