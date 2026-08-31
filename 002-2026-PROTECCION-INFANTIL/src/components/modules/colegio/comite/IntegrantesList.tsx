"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { IntegranteComiteDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    integrantesIniciales: IntegranteComiteDto[];
}

const TIPOS_IDENTIFICACION = [
    { value: "CEDULA_CIUDADANIA", label: "Cédula de ciudadanía" },
    { value: "CEDULA_EXTRANJERIA", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
] as const;

// SPEC-319 §2.3: fecha con hora en formato DD-MM-AAAA HH:MM (hora Colombia).
function formatearFechaHora(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "—";
    const partes = new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(fecha);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
    return `${p("day")}-${p("month")}-${p("year")} ${p("hour")}:${p("minute")}`;
}

export function IntegrantesList({ integrantesIniciales }: Props) {
    const [integrantes, setIntegrantes] = useState<IntegranteComiteDto[]>(integrantesIniciales);
    const [form, setForm] = useState({
        nombres: "",
        apellidos: "",
        tipoIdentificacion: "CEDULA_CIUDADANIA",
        numeroIdentificacion: "",
        email: "",
        cargo: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // SPEC-319 §2.3: edición inline de un integrante (endpoint PATCH ya existente).
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        nombres: "",
        apellidos: "",
        tipoIdentificacion: "CEDULA_CIUDADANIA",
        numeroIdentificacion: "",
        email: "",
        cargo: "",
    });
    const [editLoading, setEditLoading] = useState(false);

    // SPEC-319 §2.3: contador total y activos.
    const total = integrantes.length;
    const activos = integrantes.filter((i) => i.estado === "ACTIVO").length;

    function abrirEdicion(integrante: IntegranteComiteDto) {
        setError(null);
        setEditandoId(integrante.id);
        setEditForm({
            nombres: integrante.nombres,
            apellidos: integrante.apellidos,
            tipoIdentificacion: integrante.tipoIdentificacion,
            numeroIdentificacion: integrante.numeroIdentificacion,
            email: integrante.email,
            cargo: integrante.cargo ?? "",
        });
    }

    async function guardarEdicion(event: React.FormEvent) {
        event.preventDefault();
        if (!editandoId) return;
        setEditLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/comite/integrantes/${editandoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al editar integrante");
                return;
            }
            setIntegrantes((prev) => prev.map((i) => (i.id === editandoId ? data.integrante : i)));
            setEditandoId(null);
        } catch {
            setError("Error de red al editar integrante");
        } finally {
            setEditLoading(false);
        }
    }

    async function agregarIntegrante(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/colegio/comite/integrantes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al agregar integrante");
                return;
            }
            setIntegrantes((prev) => [data.integrante, ...prev]);
            setForm({
                nombres: "",
                apellidos: "",
                tipoIdentificacion: "CEDULA_CIUDADANIA",
                numeroIdentificacion: "",
                email: "",
                cargo: "",
            });
        } catch {
            setError("Error de red al agregar integrante");
        } finally {
            setLoading(false);
        }
    }

    async function cambiarEstado(integrante: IntegranteComiteDto) {
        const nuevoEstado = integrante.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
        const res = await fetch(`/api/colegio/comite/integrantes/${integrante.id}/estado`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error?.message || "Error al cambiar el estado");
            return;
        }
        setIntegrantes((prev) =>
            prev.map((i) => (i.id === integrante.id ? data.integrante : i))
        );
    }

    return (
        <section className="rounded-2xl glass p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold text-body">Integrantes del comité</h2>
                {/* SPEC-319 §2.3: contador total y activos */}
                <p className="text-sm font-medium text-muted">
                    {total} {total === 1 ? "integrante" : "integrantes"} · {activos} {activos === 1 ? "activo" : "activos"}
                </p>
            </div>
            <p className="mt-2 text-sm text-muted">
                Documenta quiénes conforman el Comité de Convivencia. No reciben login individual.
            </p>

            <form onSubmit={agregarIntegrante} className="mt-6 grid gap-4 sm:grid-cols-2">
                <input
                    required
                    placeholder="Nombres"
                    value={form.nombres}
                    onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                />
                <input
                    required
                    placeholder="Apellidos"
                    value={form.apellidos}
                    onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                />
                <select
                    value={form.tipoIdentificacion}
                    onChange={(e) => setForm((f) => ({ ...f, tipoIdentificacion: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                >
                    {TIPOS_IDENTIFICACION.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
                <input
                    required
                    placeholder="Número de identificación"
                    value={form.numeroIdentificacion}
                    onChange={(e) => setForm((f) => ({ ...f, numeroIdentificacion: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                />
                <input
                    required
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                />
                <input
                    required
                    placeholder="Cargo (p. ej. Rector, Psicólogo)"
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                />
                <div className="sm:col-span-2">
                    {error && <p className="mb-2 text-sm text-estado-rubi">{error}</p>}
                    <Button type="submit" isLoading={loading}>
                        {loading ? "Guardando…" : "Agregar integrante"}
                    </Button>
                </div>
            </form>

            <div className="mt-8 divide-y divide-tinta/10">
                {integrantes.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted">Aún no hay integrantes registrados.</p>
                )}
                {integrantes.map((integrante) =>
                    editandoId === integrante.id ? (
                        // SPEC-319 §2.3: edición inline
                        <form key={integrante.id} onSubmit={guardarEdicion} className="grid gap-3 py-4 sm:grid-cols-2">
                            <input
                                required
                                aria-label="Nombres"
                                placeholder="Nombres"
                                value={editForm.nombres}
                                onChange={(e) => setEditForm((f) => ({ ...f, nombres: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            <input
                                required
                                aria-label="Apellidos"
                                placeholder="Apellidos"
                                value={editForm.apellidos}
                                onChange={(e) => setEditForm((f) => ({ ...f, apellidos: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            <select
                                aria-label="Tipo de identificación"
                                value={editForm.tipoIdentificacion}
                                onChange={(e) => setEditForm((f) => ({ ...f, tipoIdentificacion: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            >
                                {TIPOS_IDENTIFICACION.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                required
                                aria-label="Número de identificación"
                                placeholder="Número de identificación"
                                value={editForm.numeroIdentificacion}
                                onChange={(e) => setEditForm((f) => ({ ...f, numeroIdentificacion: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            <input
                                required
                                type="email"
                                aria-label="Email"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            <input
                                required
                                aria-label="Cargo"
                                placeholder="Cargo"
                                value={editForm.cargo}
                                onChange={(e) => setEditForm((f) => ({ ...f, cargo: e.target.value }))}
                                className="rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            />
                            <div className="flex gap-2 sm:col-span-2">
                                <Button type="submit" isLoading={editLoading}>
                                    {editLoading ? "Guardando…" : "Guardar cambios"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setEditandoId(null)}
                                    className="rounded-xl px-4 py-2 text-sm font-semibold text-muted ring-1 ring-tinta/20 transition hover:bg-tinta/5"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div key={integrante.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-body">
                                        {integrante.nombres} {integrante.apellidos}
                                    </p>
                                    {/* SPEC-319 §2.3: estado ACTIVO/INACTIVO explícito por fila (no solo por el color del botón) */}
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                                            integrante.estado === "ACTIVO"
                                                ? "bg-pino/10 text-estado-pino ring-pino/30"
                                                : "bg-tinta/10 text-muted ring-tinta/20"
                                        }`}
                                    >
                                        {integrante.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted">
                                    {integrante.cargo} · {integrante.tipoIdentificacion} {integrante.numeroIdentificacion}
                                </p>
                                <p className="text-sm text-muted">{integrante.email}</p>
                                {/* SPEC-319 §2.3: fecha con hora DD-MM-AAAA HH:MM (COT) */}
                                <p className="text-xs text-subtle">Desde {formatearFechaHora(integrante.fechaInicio)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => abrirEdicion(integrante)}
                                    className="rounded-xl px-4 py-2 text-sm font-semibold text-body ring-1 ring-tinta/20 transition hover:bg-tinta/5"
                                >
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => cambiarEstado(integrante)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                                        integrante.estado === "ACTIVO"
                                            ? "bg-rubi/10 text-estado-rubi ring-rubi/30 hover:bg-rubi/20"
                                            : "bg-pino/10 text-estado-pino ring-pino/30 hover:bg-pino/20"
                                    }`}
                                >
                                    {integrante.estado === "ACTIVO" ? "Inactivar" : "Reactivar"}
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </section>
    );
}
