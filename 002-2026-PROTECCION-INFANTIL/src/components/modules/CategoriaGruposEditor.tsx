"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GRUPOS_CATEGORIA_FALLBACK, type CategoriaGrupo } from "@/lib/categoria-grupos";

const CATEGORIAS_INTERNAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "SPAM",
];

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
};

function claveSlug(nombre: string) {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_+|_+$)/g, "");
}

export function CategoriaGruposEditor() {
    const [grupos, setGrupos] = useState<CategoriaGrupo[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [nuevoGrupo, setNuevoGrupo] = useState("");
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);
    useEffect(() => {
        fetch("/api/config/parametros/ui.grupos_categoria", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                try {
                    const parsed = JSON.parse(data.parametro?.valor || "{}");
                    if (Array.isArray(parsed.grupos) && parsed.grupos.length > 0) {
                        setGrupos(parsed.grupos);
                    } else {
                        setGrupos(structuredClone(GRUPOS_CATEGORIA_FALLBACK));
                    }
                } catch {
                    setGrupos(structuredClone(GRUPOS_CATEGORIA_FALLBACK));
                }
                setDirty(false);
                setLoading(false);
            })
            .catch(() => {
                setGrupos(structuredClone(GRUPOS_CATEGORIA_FALLBACK));
                setDirty(false);
                setLoading(false);
            });
    }, []);

    const asignadas = useMemo(() => new Set(grupos.flatMap((g) => g.categorias)), [grupos]);
    const disponibles = useMemo(
        () => CATEGORIAS_INTERNAS.filter((c) => !asignadas.has(c)).filter((c) => c !== "SPAM"),
        [asignadas]
    );

    async function guardar() {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/config/parametros/ui.grupos_categoria", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: JSON.stringify({ grupos }) }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || "Error guardando");
            }
            setDirty(false);
            setMessage({ type: "success", text: "Grupos de categoría guardados." });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error";
            setMessage({ type: "error", text: msg });
        } finally {
            setSaving(false);
        }
    }

    function agregarCategoria(grupoClave: string, categoria: string) {
        if (!categoria) return;
        setGrupos((prev) => {
            const nuevos = prev.map((g) =>
                g.clave === grupoClave ? { ...g, categorias: [...g.categorias, categoria] } : g
            );
            // La categoría podría estar en otro grupo: la quitamos de todos los demás.
            const limpios = nuevos.map((g) =>
                g.clave === grupoClave ? g : { ...g, categorias: g.categorias.filter((c) => c !== categoria) }
            );
            return limpios;
        });
        setDirty(true);
    }

    function quitarCategoria(grupoClave: string, categoria: string) {
        setGrupos((prev) => {
            const nuevos = prev.map((g) =>
                g.clave === grupoClave ? { ...g, categorias: g.categorias.filter((c) => c !== categoria) } : g
            );
            return nuevos;
        });
        setDirty(true);
    }

    function renombrarGrupo(grupoClave: string, nombre: string) {
        setGrupos((prev) => {
            const nuevos = prev.map((g) => (g.clave === grupoClave ? { ...g, nombre } : g));
            return nuevos;
        });
        setDirty(true);
    }

    function crearGrupo() {
        const nombre = nuevoGrupo.trim();
        if (!nombre) return;
        const clave = claveSlug(nombre);
        if (!clave || grupos.some((g) => g.clave === clave)) {
            setMessage({ type: "error", text: "Ya existe un grupo con ese nombre." });
            return;
        }
        setGrupos((prev) => {
            const nuevos = [...prev, { clave, nombre, orden: prev.length + 1, categorias: [] as string[] }];
            return nuevos;
        });
        setNuevoGrupo("");
        setDirty(true);
    }

    function eliminarGrupo(grupoClave: string) {
        setGrupos((prev) => {
            const nuevos = prev.filter((g) => g.clave !== grupoClave).map((g, idx) => ({ ...g, orden: idx + 1 }));
            return nuevos;
        });
        setDirty(true);
    }

    if (loading) {
        return (
            <div className="flex items-center gap-3 py-4 text-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                Cargando grupos de categoría...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {message && (
                <div
                    className={`rounded-lg px-4 py-2 text-sm ${
                        message.type === "error"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div className="flex items-start justify-between gap-3 sm:items-center">
                <div>
                    <h3 className="text-sm font-semibold text-body">Grupos de categoría</h3>
                    {dirty ? (
                        <p className="text-xs text-amber-600 dark:text-amber-300">Tienes cambios sin guardar</p>
                    ) : (
                        <p className="text-xs text-muted">Los cambios están guardados.</p>
                    )}
                </div>
                <Button onClick={guardar} isLoading={saving} disabled={!dirty || saving}>
                    Guardar cambios
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grupos.map((grupo) => (
                    <div
                        key={grupo.clave}
                        className="rounded-2xl border border-slate-200 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                        <div className="mb-3 flex items-start justify-between gap-2">
                            <Input
                                label="Nombre del grupo"
                                value={grupo.nombre}
                                onChange={(e) => renombrarGrupo(grupo.clave, e.target.value)}
                                className="text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => eliminarGrupo(grupo.clave)}
                                className="mt-6 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                                title="Eliminar grupo"
                            >
                                Eliminar
                            </button>
                        </div>

                        <div className="mb-2">
                            <p className="text-xs font-medium text-body">Categorías asignadas</p>
                            {grupo.categorias.length === 0 ? (
                                <p className="text-xs text-muted">Sin categorías.</p>
                            ) : (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {grupo.categorias.map((cat) => (
                                        <span
                                            key={cat}
                                            className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                        >
                                            {CATEGORIA_LABELS[cat] || cat}
                                            <button
                                                type="button"
                                                onClick={() => quitarCategoria(grupo.clave, cat)}
                                                className="ml-1 leading-none hover:text-red-600"
                                                aria-label={`Quitar ${CATEGORIA_LABELS[cat] || cat}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-2">
                            <select
                                value=""
                                onChange={(e) => agregarCategoria(grupo.clave, e.target.value)}
                                className="w-full rounded-xl px-3 py-2 text-sm text-body glass-input ring-accent-input"
                            >
                                <option value="">Agregar categoría...</option>
                                {disponibles.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {CATEGORIA_LABELS[cat] || cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            {disponibles.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-300" aria-hidden="true">⚠</span>
                        <div>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                Categorías sin agrupar
                            </p>
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
                                Estas categorías se ocultan en las vistas de usuario hasta que se asignen a un grupo.
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        {disponibles.map((cat) => (
                            <span
                                key={cat}
                                className="rounded-full bg-white/60 px-2 py-1 text-[10px] text-amber-900 dark:bg-slate-900/40 dark:text-amber-100"
                            >
                                {CATEGORIA_LABELS[cat] || cat}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Input
                        label="Nuevo grupo"
                        placeholder="Ej: Amenazas o extorsión"
                        value={nuevoGrupo}
                        onChange={(e) => setNuevoGrupo(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                crearGrupo();
                            }
                        }}
                    />
                </div>
                <Button onClick={crearGrupo} disabled={!nuevoGrupo.trim()}>
                    Agregar grupo
                </Button>
            </div>

            <p className="text-xs text-muted">
                Guarda los cambios con el botón superior. Las categorías sin grupo se ocultan en las vistas de usuario.
            </p>
        </div>
    );
}
