"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/modules/MetricCard";
import { MiniList } from "@/components/modules/MiniList";
import { ChartCard } from "@/components/modules/ChartCard";
import { BarChart } from "@/components/modules/BarChart";
import { DonutChart } from "@/components/modules/DonutChart";
import { formatCategoria } from "@/lib/labels";

type Contacto = {
    id: string;
    identificador: string;
    plataforma: { id: string; nombre: string; clave: string };
    etiqueta: string | null;
    activo: boolean;
    estado: "sinReportes" | "enRevision" | "clasificado";
    totalReportes: number;
};

type DetalleContacto = {
    identificador: string;
    plataforma: { id: string; nombre: string; clave: string };
    estado: Contacto["estado"];
    tieneReportes: boolean;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    primerReporte?: string | null;
    ultimoReporte?: string | null;
    plataformas?: { id: string; nombre: string; clave: string; total: number }[];
    categorias?: { categoria: string; total: number }[];
    ubicaciones?: { pais: string; ciudad: string; total: number }[];
    timeline?: { mes: string; total: number }[];
    mensaje?: string;
};

type VistaAgregada =
    | { insuficiente: true; motivo: string; contactosConReportes?: number; totalReportes?: number }
    | {
          insuficiente: false;
          totalReportes: number;
          contactosConReportes: number;
          porPais: { pais: string; total: number }[];
          porCiudad: { ciudad: string; pais: string; total: number }[];
          porCategoria: { categoria: string; total: number }[];
          timeline: { mes: string; total: number }[];
      };

const estadoLabels: Record<Contacto["estado"], string> = {
    sinReportes: "Sin reportes",
    enRevision: "En revisión",
    clasificado: "Clasificado",
};

const estadoColors: Record<Contacto["estado"], string> = {
    sinReportes: "bg-emerald-500",
    enRevision: "bg-amber-500",
    clasificado: "bg-rose-500",
};

export default function CirculoConfianzaPage() {
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [resumen, setResumen] = useState({ sinReportes: 0, enRevision: 0, clasificado: 0, activos: 0, inhabilitados: 0 });
    const [agregado, setAgregado] = useState<VistaAgregada | null>(null);
    const [detalle, setDetalle] = useState<DetalleContacto | null>(null);
    const [preferencias, setPreferencias] = useState({ notificacionesCirculo: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ identificador: "", plataformaId: "", etiqueta: "" });
    const [plataformas, setPlataformas] = useState<{ id: string; nombre: string }[]>([]);
    const [submitting, setSubmitting] = useState(false);

    async function cargarDatos() {
        setLoading(true);
        setError("");
        try {
            const [contactosRes, agregadoRes, prefsRes, platsRes] = await Promise.all([
                fetch("/api/circulo-confianza"),
                fetch("/api/circulo-confianza/agregado"),
                fetch("/api/circulo-confianza/preferencias"),
                fetch("/api/plataformas"),
            ]);

            if (!contactosRes.ok) throw new Error("Error cargando contactos");
            if (!agregadoRes.ok) throw new Error("Error cargando vista agregada");

            const contactosData = await contactosRes.json();
            setContactos(contactosData.contactos);
            setResumen(contactosData.resumen);
            setAgregado(await agregadoRes.json());
            setPreferencias(await prefsRes.json());
            setPlataformas((await platsRes.json()).plataformas || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error cargando datos");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargarDatos();
    }, []);

    async function agregarContacto(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch("/api/circulo-confianza", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || "Error agregando contacto");
            }
            setForm({ identificador: "", plataformaId: "", etiqueta: "" });
            await cargarDatos();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error agregando contacto");
        } finally {
            setSubmitting(false);
        }
    }

    async function toggleActivo(contacto: Contacto) {
        try {
            const res = await fetch(`/api/circulo-confianza/${contacto.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !contacto.activo }),
            });
            if (!res.ok) throw new Error("Error actualizando contacto");
            await cargarDatos();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error actualizando contacto");
        }
    }

    async function guardarEtiqueta(contacto: Contacto, etiqueta: string) {
        try {
            const res = await fetch(`/api/circulo-confianza/${contacto.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ etiqueta }),
            });
            if (!res.ok) throw new Error("Error actualizando etiqueta");
            await cargarDatos();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error actualizando etiqueta");
        }
    }

    async function toggleNotificaciones() {
        try {
            const res = await fetch("/api/circulo-confianza/preferencias", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificacionesCirculo: !preferencias.notificacionesCirculo }),
            });
            if (!res.ok) throw new Error("Error actualizando preferencias");
            setPreferencias(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error actualizando preferencias");
        }
    }

    async function verDetalle(contacto: Contacto) {
        try {
            const res = await fetch(`/api/circulo-confianza/${contacto.id}`);
            if (!res.ok) throw new Error("Error cargando detalle");
            setDetalle(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error cargando detalle");
        }
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
                <div className="space-y-4">
                    <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">Círculo de Confianza</h1>
                    <p className="mt-1 text-sm text-muted">
                        Vigilá los identificadores cercanos a tu hijo. Solo vos ves tus contactos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={cargarDatos}
                        className="rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                    >
                        Actualizar
                    </button>
                    <Link
                        href="/dashboard-publico"
                        className="rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                    >
                        Panorama nacional
                    </Link>
                </div>
            </div>

            {error && (
                <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}

            {/* Resumen */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard label="Sin reportes" value={resumen.sinReportes} sub={resumen.activos > 0 ? "activos" : undefined} />
                <MetricCard label="En revisión" value={resumen.enRevision} />
                <MetricCard label="Clasificados" value={resumen.clasificado} />
                <MetricCard label="Contactos activos" value={resumen.activos} />
            </div>

            {/* Preferencias */}
            <section className="mb-6 rounded-2xl glass p-4">
                <label className="flex cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={preferencias.notificacionesCirculo}
                        onChange={toggleNotificaciones}
                        className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm text-body">
                        Recibir emails ciegos cuando haya novedades en mi Círculo de Confianza
                    </span>
                </label>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Lista de contactos */}
                <section className="lg:col-span-1">
                    <ChartCard title="Mis contactos" subtitle={`${resumen.activos} activos · ${resumen.inhabilitados} inhabilitados`}>
                        <form onSubmit={agregarContacto} className="mb-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Identificador (número o nick)"
                                value={form.identificador}
                                onChange={(e) => setForm({ ...form, identificador: e.target.value })}
                                className="w-full rounded-xl glass-input px-3 py-2 text-sm"
                                required
                                minLength={3}
                                maxLength={100}
                            />
                            <select
                                value={form.plataformaId}
                                onChange={(e) => setForm({ ...form, plataformaId: e.target.value })}
                                className="w-full rounded-xl glass-input px-3 py-2 text-sm"
                                required
                            >
                                <option value="">Plataforma</option>
                                {plataformas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Etiqueta (ej: tío Carlos)"
                                value={form.etiqueta}
                                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                                className="w-full rounded-xl glass-input px-3 py-2 text-sm"
                                maxLength={100}
                            />
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 disabled:opacity-50"
                            >
                                {submitting ? "Agregando..." : "Agregar contacto"}
                            </button>
                        </form>

                        <div className="space-y-2">
                            {contactos.length === 0 && <p className="text-sm text-muted">No tenés contactos registrados.</p>}
                            {contactos.map((c) => (
                                <div
                                    key={c.id}
                                    className={`rounded-xl border p-3 transition ${c.activo ? "border-slate-200 dark:border-slate-800" : "border-slate-100 bg-slate-50/50 dark:border-slate-800/50 dark:bg-slate-900/30 opacity-70"}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <button
                                            onClick={() => verDetalle(c)}
                                            className="flex-1 text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${estadoColors[c.estado]}`} />
                                                <span className="font-medium text-body">{c.identificador}</span>
                                            </div>
                                            <p className="text-xs text-muted">
                                                {c.plataforma.nombre}
                                                {c.etiqueta ? ` · ${c.etiqueta}` : ""}
                                                {c.totalReportes > 0 ? ` · ${c.totalReportes} reporte(s)` : ""}
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => toggleActivo(c)}
                                            className="text-xs text-subtle hover:text-body"
                                            title={c.activo ? "Inhabilitar" : "Habilitar"}
                                        >
                                            {c.activo ? "Inhab." : "Hab."}
                                        </button>
                                    </div>
                                    {c.activo && (
                                        <input
                                            type="text"
                                            defaultValue={c.etiqueta || ""}
                                            onBlur={(e) => {
                                                if (e.target.value !== (c.etiqueta || "")) {
                                                    guardarEtiqueta(c, e.target.value);
                                                }
                                            }}
                                            placeholder="Etiqueta"
                                            className="mt-2 w-full rounded-lg bg-transparent px-2 py-1 text-xs text-muted focus:bg-white/50 dark:focus:bg-slate-800/50"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                </section>

                {/* Vista agregada y detalle */}
                <section className="space-y-6 lg:col-span-2">
                    {detalle ? (
                        <ChartCard title={`Detalle: ${detalle.identificador}`} subtitle={detalle.plataforma.nombre}>
                            <button
                                onClick={() => setDetalle(null)}
                                className="mb-3 text-sm text-subtle hover:text-body"
                            >
                                ← Volver a la vista agregada
                            </button>
                            {detalle.tieneReportes ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                        <MetricCard label="Total reportes" value={detalle.totalReportes || 0} />
                                        <MetricCard label="Autenticados" value={detalle.reportesAutenticados || 0} />
                                        <MetricCard label="Anónimos" value={detalle.reportesAnonimos || 0} />
                                        <MetricCard
                                            label="Estado"
                                            value={estadoLabels[detalle.estado]}
                                        />
                                    </div>
                                    {detalle.categorias && detalle.categorias.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Categorías</h3>
                                            <MiniList
                                                items={detalle.categorias.map((c) => ({
                                                    label: formatCategoria(c.categoria),
                                                    count: c.total,
                                                }))}
                                                empty="Sin categorías"
                                            />
                                        </div>
                                    )}
                                    {detalle.ubicaciones && detalle.ubicaciones.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Ubicaciones agregadas</h3>
                                            <MiniList
                                                items={detalle.ubicaciones.map((u) => ({
                                                    label: `${u.ciudad}, ${u.pais}`,
                                                    count: u.total,
                                                }))}
                                                empty="Sin ubicaciones"
                                            />
                                        </div>
                                    )}
                                    {detalle.timeline && detalle.timeline.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Timeline mensual</h3>
                                            <BarChart
                                                data={detalle.timeline.map((t) => ({ label: t.mes, value: t.total }))}
                                                ariaLabel="Timeline de reportes por mes"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted">{detalle.mensaje}</p>
                            )}
                        </ChartCard>
                    ) : (
                        <>
                            {agregado && agregado.insuficiente ? (
                                <ChartCard title="Vista agregada" subtitle="Datos insuficientes">
                                    <p className="text-sm text-muted">{agregado.motivo}</p>
                                </ChartCard>
                            ) : agregado && !agregado.insuficiente ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                        <MetricCard label="Reportes de mi círculo" value={agregado.totalReportes} />
                                        <MetricCard label="Contactos con reportes" value={agregado.contactosConReportes} />
                                        <MetricCard label="Países" value={agregado.porPais.length} />
                                        <MetricCard label="Ciudades" value={agregado.porCiudad.length} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                        <ChartCard title="Por país" subtitle="Reportes de mis contactos">
                                            <MiniList
                                                items={agregado.porPais.map((p) => ({ label: p.pais, count: p.total }))}
                                                empty="Sin datos"
                                            />
                                        </ChartCard>
                                        <ChartCard title="Por categoría" subtitle="Reportes de mis contactos">
                                            <DonutChart
                                                data={agregado.porCategoria.map((c) => ({
                                                    label: formatCategoria(c.categoria),
                                                    value: c.total,
                                                }))}
                                                ariaLabel="Distribución por categoría"
                                            />
                                        </ChartCard>
                                    </div>
                                    <ChartCard title="Por ciudad / departamento" subtitle="Datos agregados por ciudad. No incluye direcciones exactas.">
                                        {agregado.porCiudad.length === 0 ? (
                                            <p className="text-sm text-muted">Sin datos geográficos</p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                                <MiniList
                                                    items={agregado.porCiudad.map((c) => ({
                                                        label: `${c.ciudad}, ${c.pais}`,
                                                        count: c.total,
                                                    }))}
                                                    empty="Sin datos"
                                                />
                                                <BarChart
                                                    data={agregado.porCiudad.slice(0, 5).map((c) => ({
                                                        label: c.ciudad,
                                                        value: c.total,
                                                    }))}
                                                    ariaLabel="Top ciudades"
                                                />
                                            </div>
                                        )}
                                    </ChartCard>
                                    {agregado.timeline.length > 0 && (
                                        <ChartCard title="Timeline" subtitle="Reportes de mis contactos por mes">
                                            <BarChart
                                                data={agregado.timeline.map((t) => ({ label: t.mes, value: t.total }))}
                                                ariaLabel="Timeline mensual"
                                            />
                                        </ChartCard>
                                    )}
                                </>
                            ) : null}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
