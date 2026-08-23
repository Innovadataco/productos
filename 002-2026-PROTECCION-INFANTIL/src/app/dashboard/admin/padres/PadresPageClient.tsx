"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { fechaCorta } from "@/lib/format/fecha";

type Padre = {
    id: string;
    email: string;
    nombre: string | null;
    estado: "activo" | "inactivo" | "bloqueado";
    debeCambiarPassword: boolean;
    creadoEn: string;
    ultimaSesion: string | null;
    reportes: number;
    inicioServicio: string | null;
    finServicio: string | null;
};

type Paginacion = { page: number; pageSize: number; total: number; totalPages: number };

type Mensaje = { type: "success" | "error"; text: string } | null;

type VigenciaEdit = { padre: Padre; inicio: string; fin: string } | null;

const PAGE_SIZE = 25;

function aFechaInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fechaInputAISO(valor: string): string | null {
    if (!valor) return null;
    // Medianoche LOCAL del día elegido (el servidor normaliza a medianoche local).
    return new Date(`${valor}T00:00:00`).toISOString();
}

function estadoVigencia(padre: Padre): { label: string; variant: "success" | "warning" | "neutral" } {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (padre.inicioServicio && new Date(padre.inicioServicio) > hoy) {
        return { label: "No iniciada", variant: "warning" };
    }
    if (padre.finServicio) {
        const fin = new Date(padre.finServicio);
        fin.setHours(0, 0, 0, 0);
        if (fin < hoy) return { label: "Vencida", variant: "warning" };
    }
    if (padre.inicioServicio || padre.finServicio) return { label: "Vigente", variant: "success" };
    return { label: "Sin definir", variant: "neutral" };
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
    const [vigenciaEdit, setVigenciaEdit] = useState<VigenciaEdit>(null);

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

    function abrirVigencia(padre: Padre) {
        setMessage(null);
        setVigenciaEdit({
            padre,
            inicio: aFechaInput(padre.inicioServicio),
            fin: aFechaInput(padre.finServicio),
        });
    }

    async function guardarVigencia() {
        if (!vigenciaEdit) return;
        const { padre, inicio, fin } = vigenciaEdit;
        if (inicio && fin && fin <= inicio) {
            setMessage({ type: "error", text: "La fecha de fin debe ser posterior a la fecha de inicio" });
            return;
        }
        setAccionEnCurso(padre.id);
        try {
            const res = await fetch(`/api/admin/padres/${padre.id}/vigencia`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inicioServicio: fechaInputAISO(inicio),
                    finServicio: fechaInputAISO(fin),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Vigencia actualizada para ${padre.email}` });
                setVigenciaEdit(null);
                await cargar(page, qActiva);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error actualizando la vigencia" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando la vigencia" });
        } finally {
            setAccionEnCurso(null);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Cuentas de padres</h1>
                <p className="text-sm text-muted">
                    Soporte de credenciales de usuarios finales: restablecer contraseñas, activar o desactivar cuentas
                    y gestionar la ventana de servicio (vigencia) de cada cliente.
                </p>
            </div>

            {message && (
                <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">
                    {message.text}
                </Alerta>
            )}

            {passwordTemporal && (
                <Alerta tono="advertencia" role="status" className="border border-amber-200 p-4 dark:border-amber-800">
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
                </Alerta>
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
                    <Cargando inline texto="Cargando cuentas..." className="py-8" />
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
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Nombre</th>
                                    <th className="pb-3 font-medium">Email</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Vigencia</th>
                                    <th className="pb-3 font-medium">Registro</th>
                                    <th className="pb-3 font-medium">Última sesión</th>
                                    <th className="pb-3 font-medium">Reportes</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {items.map((padre) => {
                                    const vigencia = estadoVigencia(padre);
                                    return (
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
                                            <td className="py-3 pr-3">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant={vigencia.variant}>{vigencia.label}</Badge>
                                                    {(padre.inicioServicio || padre.finServicio) && (
                                                        <span className="text-xs text-subtle">
                                                            {fechaCorta(padre.inicioServicio)} → {fechaCorta(padre.finServicio)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 text-muted">{fechaCorta(padre.creadoEn)}</td>
                                            <td className="py-3 pr-3 text-muted">{fechaCorta(padre.ultimaSesion)}</td>
                                            <td className="py-3 pr-3 text-muted">{padre.reportes}</td>
                                            <td className="py-3 text-right">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Link
                                                        href={`/dashboard/admin/padres/${padre.id}/circulo`}
                                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-body hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                    >
                                                        Ver círculo
                                                    </Link>
                                                    <Button
                                                        variant="outline"
                                                        className="px-3 py-1.5 text-xs"
                                                        disabled={accionEnCurso === padre.id}
                                                        onClick={() => abrirVigencia(padre)}
                                                    >
                                                            Vigencia
                                                    </Button>
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
                                    );
                                })}
                            </TablaBody>
                        </Tabla>
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

            {vigenciaEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl glass p-6">
                        <h2 className="text-lg font-bold text-body">Ventana de servicio</h2>
                        <p className="mt-1 text-sm text-muted">{vigenciaEdit.padre.email}</p>
                        <p className="mt-2 text-xs text-subtle">
                            Sin fechas = acceso permitido (sin vigencia definida). Al vencer la fecha de fin, la cuenta
                            pierde acceso pero sus reportes e información se conservan.
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                                label="Inicio del servicio"
                                type="date"
                                value={vigenciaEdit.inicio}
                                onChange={(e) => setVigenciaEdit({ ...vigenciaEdit, inicio: e.target.value })}
                            />
                            <Input
                                label="Fin del servicio"
                                type="date"
                                min={vigenciaEdit.inicio || undefined}
                                value={vigenciaEdit.fin}
                                onChange={(e) => setVigenciaEdit({ ...vigenciaEdit, fin: e.target.value })}
                            />
                        </div>
                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => setVigenciaEdit(null)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                disabled={accionEnCurso === vigenciaEdit.padre.id}
                                onClick={() => setVigenciaEdit({ ...vigenciaEdit, inicio: "", fin: "" })}
                            >
                                Quitar vigencia
                            </Button>
                            <Button
                                type="button"
                                className="px-3 py-1.5 text-xs"
                                disabled={accionEnCurso === vigenciaEdit.padre.id}
                                onClick={guardarVigencia}
                            >
                                Guardar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
