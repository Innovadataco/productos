"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MetricCard } from "@/components/modules/MetricCard";
import { MiniList } from "@/components/modules/MiniList";
import { ChartCard } from "@/components/modules/ChartCard";
import { BarChart } from "@/components/modules/BarChart";
import { DonutChart } from "@/components/modules/DonutChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatEstadoCirculo } from "@/lib/reporte-estados-usuario";
import { formatPlataforma } from "@/lib/plataforma";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { PuntoMapa } from "@/components/modules/MapaUbicaciones";

const MapaUbicaciones = dynamic(
    () => import("@/components/modules/MapaUbicaciones").then((mod) => mod.MapaUbicaciones),
    { ssr: false }
);

type Plataforma = { id: string; nombre: string; clave: string };

type Identificador = {
    id: string;
    valor: string;
    tipo: string | null;
    plataforma: Plataforma | null;
    activo: boolean;
};

type Estado = "sinReportes" | "enRevision" | "clasificado";

type Contacto = {
    id: string;
    etiqueta: string | null;
    nota: string | null;
    activo: boolean;
    estado: Estado;
    totalReportes: number;
    identificadores: Identificador[];
};

type IdentificadorDetalle = Identificador & {
    estado: Estado;
    totalReportes: number;
};

type GrupoCategoria = {
    clave: string;
    nombre: string;
    orden: number;
    total: number;
};

type UbicacionAgregada = {
    pais: string;
    ciudad: string;
    lat: number | null;
    lng: number | null;
    total: number;
};

type Agregado = {
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
    primerReporte: string | null;
    ultimoReporte: string | null;
    plataformas: { id: string; nombre: string; clave: string; total: number }[];
    categorias: { categoria: string; total: number }[];
    porGrupoCategoria: GrupoCategoria[];
    ubicaciones: UbicacionAgregada[];
    timeline: { mes: string; total: number }[];
};

type DetalleContacto = {
    id: string;
    etiqueta: string | null;
    nota: string | null;
    activo: boolean;
    estado: Estado;
    totalReportes: number;
    identificadores: IdentificadorDetalle[];
    agregado: Agregado | null;
    mensaje?: string;
};

type VistaAgregada =
    | { insuficiente: true; motivo: string; contactosConReportes?: number; totalReportes?: number }
    | {
          insuficiente: false;
          totalReportes: number;
          contactosConReportes: number;
          porPais: { pais: string; total: number }[];
          porCiudad: UbicacionAgregada[];
          porCategoria: { categoria: string; total: number }[];
          porGrupoCategoria: GrupoCategoria[];
          timeline: { mes: string; total: number }[];
      };

const estadoBadgeVariant: Record<Estado, import("@/components/ui/Badge").BadgeVariant> = {
    sinReportes: "success",
    enRevision: "warning",
    clasificado: "danger",
};

export default function CirculoConfianzaPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [resumen, setResumen] = useState({
        sinReportes: 0,
        enRevision: 0,
        clasificado: 0,
        activos: 0,
        inhabilitados: 0,
    });
    const [agregado, setAgregado] = useState<VistaAgregada | null>(null);
    const [detalle, setDetalle] = useState<DetalleContacto | null>(null);
    const [preferencias, setPreferencias] = useState({ notificacionesCirculo: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [form, setForm] = useState<{
        etiqueta: string;
        nota: string;
        identificadores: { valor: string; tipo: string; plataformaId: string }[];
    }>({
        etiqueta: "",
        nota: "",
        identificadores: [{ valor: "", tipo: "", plataformaId: "" }],
    });
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const opcionesPlataforma = [
        { value: "", label: "Plataforma" },
        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
    ];

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
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        if (["ADMIN", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION"].includes(user.rol)) {
            const target =
                user.rol === "COMITE_VALIDACION"
                    ? "/dashboard/admin/comite"
                    : user.rol === "OPERADOR"
                      ? "/dashboard/admin/operadores"
                      : "/dashboard/admin";
            router.push(target);
            return;
        }
        cargarDatos();
    }, [authLoading, user, router]);

    async function agregarContacto(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const identificadores = form.identificadores
                .filter((i) => i.valor.trim() !== "")
                .map((i) => ({
                    valor: i.valor.trim(),
                    tipo: i.tipo.trim() || undefined,
                    plataformaId: i.plataformaId || undefined,
                }));

            if (identificadores.length === 0) {
                throw new Error("Agrega al menos un identificador");
            }

            const res = await fetch("/api/circulo-confianza", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    etiqueta: form.etiqueta.trim() || undefined,
                    nota: form.nota.trim() || undefined,
                    identificadores,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || "Error agregando contacto");
            }
            setForm({ etiqueta: "", nota: "", identificadores: [{ valor: "", tipo: "", plataformaId: "" }] });
            await cargarDatos();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error agregando contacto");
        } finally {
            setSubmitting(false);
        }
    }

    function agregarFilaIdentificador() {
        setForm((prev) => ({
            ...prev,
            identificadores: [...prev.identificadores, { valor: "", tipo: "", plataformaId: "" }],
        }));
    }

    function quitarFilaIdentificador(index: number) {
        setForm((prev) => ({
            ...prev,
            identificadores: prev.identificadores.filter((_, i) => i !== index),
        }));
    }

    function actualizarIdentificador(index: number, campo: keyof typeof form.identificadores[0], valor: string) {
        setForm((prev) => ({
            ...prev,
            identificadores: prev.identificadores.map((i, idx) =>
                idx === index ? { ...i, [campo]: valor } : i
            ),
        }));
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

    if (authLoading || loading) {
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
                        Vigila los identificadores cercanos a tu hijo. Solo tú ves tus contactos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cargarDatos}>
                        Actualizar
                    </Button>
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

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard label="Sin reportes" value={resumen.sinReportes} sub={resumen.activos > 0 ? "activos" : undefined} />
                <MetricCard label="En proceso" value={resumen.enRevision} />
                <MetricCard label="Verificado" value={resumen.clasificado} />
                <MetricCard label="Contactos activos" value={resumen.activos} />
            </div>

            <GlassCard className="mb-6">
                <label className="flex cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={preferencias.notificacionesCirculo}
                        onChange={toggleNotificaciones}
                        className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm text-body">
                        Recibir un aviso por email cuando alguno de los contactos de mi Círculo de Confianza aparezca en un reporte.
                    </span>
                </label>
            </GlassCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="lg:col-span-1">
                    <ChartCard title="Mis contactos" subtitle={`${resumen.activos} activos · ${resumen.inhabilitados} inhabilitados`}>
                        <form onSubmit={agregarContacto} className="mb-4 space-y-3">
                            <Input
                                label="Etiqueta (ej: tío Carlos)"
                                placeholder="Nombre o etiqueta del contacto"
                                value={form.etiqueta}
                                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                                maxLength={100}
                            />
                            <Input
                                label="Nota (opcional)"
                                placeholder="Observación privada"
                                value={form.nota}
                                onChange={(e) => setForm({ ...form, nota: e.target.value })}
                                maxLength={1000}
                            />

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-body">Identificadores</p>
                                {form.identificadores.map((i, idx) => (
                                    <div key={idx} className="rounded-xl glass-input p-2 space-y-2">
                                        <Input
                                            placeholder="Valor (número o nick)"
                                            value={i.valor}
                                            onChange={(e) => actualizarIdentificador(idx, "valor", e.target.value)}
                                            minLength={1}
                                            maxLength={100}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Tipo (opcional)"
                                                value={i.tipo}
                                                onChange={(e) => actualizarIdentificador(idx, "tipo", e.target.value)}
                                                maxLength={50}
                                            />
                                            <Select
                                                options={opcionesPlataforma}
                                                value={i.plataformaId}
                                                onChange={(e) => actualizarIdentificador(idx, "plataformaId", e.target.value)}
                                            />
                                        </div>
                                        {form.identificadores.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="w-full text-xs"
                                                onClick={() => quitarFilaIdentificador(idx)}
                                            >
                                                Quitar identificador
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full text-sm"
                                    onClick={agregarFilaIdentificador}
                                >
                                    Agregar otro identificador
                                </Button>
                            </div>

                            <Button type="submit" isLoading={submitting} className="w-full">
                                Agregar contacto
                            </Button>
                        </form>

                        <div className="space-y-2">
                            {contactos.length === 0 && <p className="text-sm text-muted">No tienes contactos registrados.</p>}
                            {contactos.map((c) => (
                                <div
                                    key={c.id}
                                    className={`rounded-xl border p-3 transition ${c.activo ? "border-slate-200 dark:border-slate-800" : "border-slate-100 bg-slate-50/50 dark:border-slate-800/50 dark:bg-slate-900/30 opacity-70"}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <button onClick={() => verDetalle(c)} className="flex-1 text-left">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant={estadoBadgeVariant[c.estado]}>{formatEstadoCirculo(c.estado)}</Badge>
                                                <span className="font-medium text-body">{c.etiqueta || "Sin etiqueta"}</span>
                                            </div>
                                            <p className="text-xs text-muted">
                                                {c.identificadores.length} identificador(es)
                                                {c.totalReportes > 0 ? ` · ${c.totalReportes} reporte(s)` : ""}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {c.identificadores.map((i) => (
                                                    <span key={i.id} className="text-xs text-subtle">
                                                        {i.valor}
                                                        {i.plataforma ? ` (${formatPlataforma(i.plataforma.nombre, null, i.plataforma.clave)})` : ""}
                                                    </span>
                                                ))}
                                            </div>
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
                                        <Input
                                            defaultValue={c.etiqueta || ""}
                                            onBlur={(e) => {
                                                if (e.target.value !== (c.etiqueta || "")) {
                                                    guardarEtiqueta(c, e.target.value);
                                                }
                                            }}
                                            placeholder="Etiqueta"
                                            className="mt-2 rounded-lg bg-transparent px-2 py-1 text-xs text-muted focus:bg-white/50 dark:focus:bg-slate-800/50"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                </section>

                <section className="space-y-6 lg:col-span-2">
                    {detalle ? (
                        <ChartCard
                            title={`Detalle: ${detalle.etiqueta || "Sin etiqueta"}`}
                            subtitle={detalle.activo ? "Contacto activo" : "Contacto inhabilitado"}
                        >
                            <button
                                onClick={() => setDetalle(null)}
                                className="mb-3 text-sm text-subtle hover:text-body"
                            >
                                ← Volver a la vista agregada
                            </button>

                            <div className="mb-4 space-y-2">
                                <h3 className="text-sm font-semibold text-body">Identificadores</h3>
                                {detalle.identificadores.map((i) => (
                                    <div
                                        key={i.id}
                                        className="flex items-center justify-between rounded-xl glass-input px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm text-body font-medium">{i.valor}</span>
                                            {i.tipo && <Badge variant="neutral">{i.tipo}</Badge>}
                                            {i.plataforma && (
                                                <Badge variant="info">
                                                    {formatPlataforma(i.plataforma.nombre, null, i.plataforma.clave)}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted">
                                            <Badge variant={estadoBadgeVariant[i.estado]}>{formatEstadoCirculo(i.estado)}</Badge>
                                            {i.totalReportes > 0 && (
                                                <span>{i.totalReportes} reporte(s)</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {detalle.agregado ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                        <MetricCard label="Total reportes" value={detalle.agregado.totalReportes} />
                                        <MetricCard label="Autenticados" value={detalle.agregado.reportesAutenticados} />
                                        <MetricCard label="Anónimos" value={detalle.agregado.reportesAnonimos} />
                                        <MetricCard label="Estado" value={formatEstadoCirculo(detalle.estado)} />
                                    </div>
                                    {detalle.agregado.porGrupoCategoria.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Categorías</h3>
                                            <DonutChart
                                                data={detalle.agregado.porGrupoCategoria.map((g) => ({
                                                    label: g.nombre,
                                                    value: g.total,
                                                }))}
                                                ariaLabel="Distribución por categoría"
                                            />
                                        </div>
                                    )}
                                    {detalle.agregado.ubicaciones.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Ubicaciones aproximadas</h3>
                                            <p className="mb-3 text-xs text-subtle">
                                                Ciudades con reportes. Sin direcciones exactas ni datos personales.
                                            </p>
                                            <MapaUbicaciones
                                                puntos={detalle.agregado.ubicaciones
                                                    .filter((u): u is UbicacionAgregada & { lat: number; lng: number } =>
                                                        typeof u.lat === "number" && typeof u.lng === "number"
                                                    )
                                                    .map((u) => ({
                                                        lat: u.lat,
                                                        lng: u.lng,
                                                        label: `${u.ciudad}, ${u.pais}`,
                                                        total: u.total,
                                                    }))}
                                            />
                                        </div>
                                    )}
                                    {detalle.agregado.timeline.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold text-body">Timeline mensual</h3>
                                            <BarChart
                                                data={detalle.agregado.timeline.map((t) => ({ label: t.mes, value: t.total }))}
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
                                                data={agregado.porGrupoCategoria.map((g) => ({
                                                    label: g.nombre,
                                                    value: g.total,
                                                }))}
                                                ariaLabel="Distribución por categoría"
                                            />
                                        </ChartCard>
                                    </div>
                                    <ChartCard title="Por ciudad / departamento" subtitle="Datos agregados por ciudad. No incluye direcciones exactas.">
                                        {agregado.porCiudad.length === 0 ? (
                                            <p className="text-sm text-muted">Sin datos geográficos</p>
                                        ) : (
                                            <MapaUbicaciones
                                                puntos={agregado.porCiudad
                                                    .filter((u): u is UbicacionAgregada & { lat: number; lng: number } =>
                                                        typeof u.lat === "number" && typeof u.lng === "number"
                                                    )
                                                    .map((u) => ({
                                                        lat: u.lat,
                                                        lng: u.lng,
                                                        label: `${u.ciudad}, ${u.pais}`,
                                                        total: u.total,
                                                    }))}
                                            />
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
