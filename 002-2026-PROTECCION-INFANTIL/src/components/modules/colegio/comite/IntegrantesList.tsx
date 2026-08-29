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
            <h2 className="text-xl font-semibold text-body">Integrantes del comité</h2>
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
                {integrantes.map((integrante) => (
                    <div key={integrante.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium text-body">
                                {integrante.nombres} {integrante.apellidos}
                            </p>
                            <p className="text-sm text-muted">
                                {integrante.cargo} · {integrante.tipoIdentificacion} {integrante.numeroIdentificacion}
                            </p>
                            <p className="text-sm text-muted">{integrante.email}</p>
                        </div>
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
                ))}
            </div>
        </section>
    );
}
