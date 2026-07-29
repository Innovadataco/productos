"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Padre = {
    id: string;
    email: string;
    nombre: string | null;
    estado: "activo" | "inactivo" | "bloqueado";
    debeCambiarPassword: boolean;
    creadoEn: string;
    ultimaSesion: string | null;
    reportes: number;
};

type Paginacion = { page: number; pageSize: number; total: number; totalPages: number };

type Mensaje = { type: "success" | "error"; text: string } | null;

const PAGE_SIZE = 25;

function fechaCorta(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default function PadresPageClient() {
    const [items, setItems] = useState<Padre[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [qActiva, setQActiva] = useState("");
    const [page, setPage] = useState(1);
    const [message, setMessage] = useState<Mensaje>(null);
    const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
    const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

    const cargar = useCallback(async (pagina: number, q: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
            if (q) params.set("q", q);
            const res = await fetch(`/api/admin/padres?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setItems(data.items || []);
                setPaginacion(data.pagination || { page: pagina, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
                setMessage(null);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando las cuentas" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando las cuentas" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargar(page, qActiva);
    }, [cargar, page, qActiva]);

    function buscar(e: React.FormEvent) {
        e.preventDefault();
        setPasswordTemporal(null);
        setMessage(null);
        setPage(1);
        setQActiva(busqueda.trim());
    }

    function limpiarBusqueda() {
        setBusqueda("");
        setPage(1);
        setQActiva("");
    }

    async function restablecerPassword(padre: Padre) {
        setMessage(null);
        setPasswordTemporal(null);
        setAccionEnCurso(padre.id);
        try {
            const res = await fetch(`/api/admin/padres/${padre.id}/restablecer-password`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setPasswordTemporal(data.passwordTemporal || null);
                setMessage({ type: "success", text: data.mensaje || `Contraseña restablecida para ${padre.email}` });
                await cargar(page, qActiva);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error restableciendo la contraseña" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red restableciendo la contraseña" });
        } finally {
            setAccionEnCurso(null);
        }
    }

    async function alternarEstado(padre: Padre) {
        setMessage(null);
        setPasswordTemporal(null);
        setAccionEnCurso(padre.id);
        const activo = padre.estado === "activo";
        try {
            const res = await fetch(
                activo ? `/api/admin/padres/${padre.id}` : `/api/admin/padres/${padre.id}/reactivar`,
                { method: activo ? "DELETE" : "POST", credentials: "include" }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: activo ? "Cuenta desactivada" : "Cuenta reactivada" });
                await cargar(page, qActiva);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando la cuenta" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando la cuenta" });
        } finally {
            setAccionEnCurso(null);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Cuentas de padres</h1>
                <p className="text-sm text-muted">
                    Soporte de credenciales de usuarios finales: restablecer contraseñas y activar o desactivar cuentas.
                </p>
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
                    <p className="mt-2 text-xs opacity-80">
                        El usuario debe iniciar sesión con esta contraseña y cambiarla de inmediato. No se volverá a mostrar.
                    </p>
                </div>
            )}

            <GlassCard>
                <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <Input
                            label="Buscar por email o nombre"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Ej.: nombre@correo.com"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit">Buscar</Button>
                        {qActiva && (
                            <Button type="button" variant="outline" onClick={limpiarBusqueda}>
                                Limpiar
                            </Button>
                        )}
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                {loading ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando cuentas...
                    </div>
                ) : items.length === 0 ? (
                    <EmptyState
                        title={qActiva ? "Sin resultados para la búsqueda" : "No hay cuentas de padres registradas"}
                        description={
                            qActiva
                                ? "Prueba con otro email o nombre."
                                : "Las cuentas se crean cuando un usuario se registra desde el formulario público."
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 dark:border-slate-800">
                                    <tr className="text-subtle">
                                        <th className="pb-3 font-medium">Nombre</th>
                                        <th className="pb-3 font-medium">Email</th>
                                        <th className="pb-3 font-medium">Estado</th>
                                        <th className="pb-3 font-medium">Registro</th>
                                        <th className="pb-3 font-medium">Última sesión</th>
                                        <th className="pb-3 font-medium">Reportes</th>
                                        <th className="pb-3 font-medium text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {items.map((padre) => (
                                        <tr key={padre.id} className="align-top">
                                            <td className="py-3 pr-3 text-body">
                                                <div className="flex items-center gap-2">
                                                    {padre.nombre || "—"}
                                                    {padre.debeCambiarPassword && (
                                                        <Badge variant="warning" className="text-[10px]">
                                                            Debe cambiar contraseña
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 text-muted">{padre.email}</td>
                                            <td className="py-3 pr-3">
                                                <Badge variant={padre.estado === "activo" ? "success" : "neutral"}>
                                                    {padre.estado === "activo" ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-3 text-muted">{fechaCorta(padre.creadoEn)}</td>
                                            <td className="py-3 pr-3 text-muted">{fechaCorta(padre.ultimaSesion)}</td>
                                            <td className="py-3 pr-3 text-muted">{padre.reportes}</td>
                                            <td className="py-3 text-right">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="px-3 py-1.5 text-xs"
                                                        disabled={accionEnCurso === padre.id}
                                                        onClick={() => restablecerPassword(padre)}
                                                    >
                                                        Restablecer contraseña
                                                    </Button>
                                                    <Button
                                                        variant={padre.estado === "activo" ? "danger" : "secondary"}
                                                        className="px-3 py-1.5 text-xs"
                                                        disabled={accionEnCurso === padre.id}
                                                        onClick={() => alternarEstado(padre)}
                                                    >
                                                        {padre.estado === "activo" ? "Desactivar" : "Reactivar"}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm text-muted">
                            <span>
                                Página {paginacion.page} de {Math.max(paginacion.totalPages, 1)} · {paginacion.total} cuentas
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="px-3 py-1.5 text-xs"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    className="px-3 py-1.5 text-xs"
                                    disabled={page >= paginacion.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </GlassCard>
        </div>
    );
}
