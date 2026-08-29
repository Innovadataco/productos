"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { Textarea } from "@/components/ui/Textarea";

interface PlanItem {
    id: string;
    nombre: string;
    tipoTitular: "COLEGIO" | "PADRE";
    duracion: "MES_1" | "MES_2" | "MES_3" | "MES_6" | "MES_12";
    anio: number;
    precioBaseCOP: number | null;
    esFreemium: boolean;
    usosMaximosPorCliente: number | null;
    activo: boolean;
    descripcion: string | null;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

const duraciones = [
    { value: "MES_1", label: "1 mes" },
    { value: "MES_2", label: "2 meses" },
    { value: "MES_3", label: "3 meses" },
    { value: "MES_6", label: "6 meses" },
    { value: "MES_12", label: "12 meses" },
];

const roles = [
    { value: "PADRE", label: "Padre" },
    { value: "COLEGIO", label: "Colegio" },
];

function formatoCOP(valor: number | null): string {
    if (valor === null || valor === undefined) return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export function PlanesAdminCRUD() {
    const [items, setItems] = useState<PlanItem[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editing, setEditing] = useState<PlanItem | null>(null);
    const [filtroRol, setFiltroRol] = useState<string>("");
    const [filtroAnio, setFiltroAnio] = useState<string>("");
    const formRef = useRef<HTMLFormElement>(null);

    const [form, setForm] = useState({
        nombre: "",
        precioBaseCOP: "",
        duracion: "MES_3",
        tipoTitular: "PADRE" as "COLEGIO" | "PADRE",
        descripcion: "",
        activo: true,
        usosMaximosPorCliente: "",
        esFreemium: false,
    });

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set("page", String(pagination.page));
        params.set("pageSize", String(pagination.pageSize));
        if (filtroRol) params.set("tipoTitular", filtroRol);
        if (filtroAnio) params.set("anio", filtroAnio);
        return params.toString();
    }, [pagination.page, pagination.pageSize, filtroRol, filtroAnio]);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/pagos/planes?${queryParams}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message ?? "Error al cargar planes");
                return;
            }
            setItems(data.items);
            setPagination(data.pagination);
        } catch {
            setError("Error de red al cargar planes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryParams]);

    function resetForm() {
        setForm({
            nombre: "",
            precioBaseCOP: "",
            duracion: "MES_3",
            tipoTitular: "PADRE",
            descripcion: "",
            activo: true,
            usosMaximosPorCliente: "",
            esFreemium: false,
        });
        setEditing(null);
    }

    function editar(plan: PlanItem) {
        setEditing(plan);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        setForm({
            nombre: plan.nombre,
            precioBaseCOP: plan.precioBaseCOP === null ? "" : String(plan.precioBaseCOP),
            duracion: plan.duracion,
            tipoTitular: plan.tipoTitular,
            descripcion: plan.descripcion ?? "",
            activo: plan.activo,
            usosMaximosPorCliente: plan.usosMaximosPorCliente === null ? "" : String(plan.usosMaximosPorCliente),
            esFreemium: plan.esFreemium,
        });
    }

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const body = {
            nombre: form.nombre,
            precioBaseCOP: Number(form.precioBaseCOP),
            // SPEC-289 (002-PI-189 · Fase 1): sin hardcode USD; el schema Zod
            // resuelve el default a 0 (pagosPlanCreateSchema).
            duracion: form.duracion,
            tipoTitular: form.tipoTitular,
            descripcion: form.descripcion || undefined,
            activo: form.activo,
            usosMaximosPorCliente: form.usosMaximosPorCliente ? Number(form.usosMaximosPorCliente) : null,
            esFreemium: form.esFreemium,
        };

        const url = editing ? `/api/admin/pagos/planes/${editing.id}` : "/api/admin/pagos/planes";
        const method = editing ? "PATCH" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message ?? "Error al guardar el plan");
                return;
            }
            setSuccess(editing ? "Plan actualizado" : "Plan creado");
            resetForm();
            await cargar();
        } catch {
            setError("Error de red al guardar el plan");
        }
    }

    async function desactivar(plan: PlanItem) {
        if (!window.confirm(`¿Desactivar el plan "${plan.nombre}"?`)) return;
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(`/api/admin/pagos/planes/${plan.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message ?? "Error al desactivar el plan");
                return;
            }
            setSuccess("Plan desactivado");
            await cargar();
        } catch {
            setError("Error de red al desactivar el plan");
        }
    }

    return (
        <div className="space-y-6">
            {error && <Alerta tono="error">{error}</Alerta>}
            {success && <Alerta tono="exito">{success}</Alerta>}

            <GlassCard>
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="md:w-48">
                        <Select
                            label="Rol destino"
                            options={[{ value: "", label: "Todos" }, ...roles]}
                            value={filtroRol}
                            onChange={(e) => {
                                setFiltroRol(e.target.value);
                                setPagination((p) => ({ ...p, page: 1 }));
                            }}
                        />
                    </div>
                    <div className="md:w-40">
                        <Input
                            label="Año"
                            type="number"
                            value={filtroAnio}
                            onChange={(e) => {
                                setFiltroAnio(e.target.value);
                                setPagination((p) => ({ ...p, page: 1 }));
                            }}
                            placeholder="Ej: 2026"
                        />
                    </div>
                    <div className="flex-1" />
                    <Button onClick={() => { resetForm(); }}>Crear plan</Button>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="mb-4 text-base font-semibold text-body">
                    {editing ? "Editar plan" : "Nuevo plan"}
                </h3>
                <form ref={formRef} onSubmit={guardar} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Input
                        label="Nombre"
                        required
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                    <div>
                        <Input
                            label="Precio COP"
                            type="number"
                            required
                            min={0}
                            value={form.precioBaseCOP}
                            disabled={form.esFreemium}
                            onChange={(e) => setForm({ ...form, precioBaseCOP: e.target.value })}
                        />
                        {form.esFreemium && (
                            <p className="mt-1 text-xs text-muted">Los planes freemium siempre tienen precio 0.</p>
                        )}
                    </div>
                    <Select
                        label="Duración"
                        options={duraciones}
                        value={form.duracion}
                        onChange={(e) => setForm({ ...form, duracion: e.target.value as typeof form.duracion })}
                    />
                    <Select
                        label="Rol destino"
                        options={roles}
                        value={form.tipoTitular}
                        onChange={(e) => setForm({ ...form, tipoTitular: e.target.value as typeof form.tipoTitular })}
                    />
                    <Input
                        label="Usos máximos por cliente"
                        type="number"
                        min={1}
                        value={form.usosMaximosPorCliente}
                        onChange={(e) => setForm({ ...form, usosMaximosPorCliente: e.target.value })}
                        placeholder="Solo para freemium"
                    />
                    <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 text-sm text-body">
                            <input
                                type="checkbox"
                                checked={form.activo}
                                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                                className="h-4 w-4 rounded border-tinta/20"
                            />
                            Activo
                        </label>
                        <label className="flex items-center gap-2 text-sm text-body">
                            <input
                                type="checkbox"
                                checked={form.esFreemium}
                                onChange={(e) => {
                                    const esFreemium = e.target.checked;
                                    setForm({
                                        ...form,
                                        esFreemium,
                                        precioBaseCOP: esFreemium ? "0" : form.precioBaseCOP,
                                    });
                                }}
                                className="h-4 w-4 rounded border-tinta/20"
                            />
                            Freemium
                        </label>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <Textarea
                            label="Descripción"
                            value={form.descripcion}
                            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-2 md:col-span-2 lg:col-span-3">
                        <Button type="submit" isLoading={loading}>
                            {editing ? "Guardar cambios" : "Crear plan"}
                        </Button>
                        {editing && (
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-tinta/5 dark:bg-tinta/10">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted">Nombre</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Rol</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Duración</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Año</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Precio COP</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Freemium</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Estado</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                            {items.map((plan) => (
                                <tr key={plan.id} className={`hover:bg-tinta/5 dark:hover:bg-tinta/10${editing?.id === plan.id ? " ring-2 ring-inset ring-cielo" : ""}`}>
                                    <td className="px-4 py-3 font-medium text-body">{plan.nombre}</td>
                                    <td className="px-4 py-3">{plan.tipoTitular}</td>
                                    <td className="px-4 py-3">{plan.duracion}</td>
                                    <td className="px-4 py-3">{plan.anio}</td>
                                    <td className="px-4 py-3">{formatoCOP(plan.precioBaseCOP)}</td>
                                    <td className="px-4 py-3">{plan.esFreemium ? "Sí" : "No"}</td>
                                    <td className="px-4 py-3">
                                        <span className={plan.activo ? "text-pino" : "text-rubi"}>
                                            {plan.activo ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => editar(plan)}>
                                                Editar
                                            </Button>
                                            {plan.activo && (
                                                <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => desactivar(plan)}>
                                                    Desactivar
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted">
                                        No hay planes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm text-muted">
                        <span>
                            Página {pagination.page} de {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={pagination.page <= 1}
                                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
