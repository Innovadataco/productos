"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { CategoriaGruposEditor } from "./CategoriaGruposEditor";

type ParamType = "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "JSON" | "STRING_ARRAY";

type Param = {
    id: string;
    clave: string;
    valor: string;
    tipo: ParamType;
    categoria: string;
    esPublico: boolean;
    esSecreto: boolean;
    descripcion: string | null;
};

const SECTIONS: { key: string; label: string; description: string; prefixes: string[] }[] = [
    { key: "scoring", label: "Modelo de Score (F1)", description: "Pesos y umbrales que calculan el score de riesgo 0-100.", prefixes: ["scoring."] },
    { key: "visibility", label: "Visibilidad Pública", description: "Reglas para que un identificador aparezca en la consulta pública.", prefixes: ["visibility."] },
    { key: "alerts", label: "Alertas por Email", description: "Activar/desactivar notificaciones a administradores y suscriptores.", prefixes: ["alerts."] },
    { key: "ratelimit", label: "Rate Limiting", description: "Límites de peticiones por ventana de tiempo.", prefixes: ["ratelimit."] },
    { key: "reportes", label: "Procesamiento de Reportes", description: "Modelos de IA, umbrales de duplicados y parámetros del worker.", prefixes: ["reportes."] },
    { key: "ui", label: "Interfaz de usuario", description: "Parámetros visibles para usuarios finales, como SLA de seguimiento.", prefixes: ["ui."] },
    { key: "security", label: "Seguridad", description: "Intentos de login, duración de bloqueo, longitud de contraseña, etc.", prefixes: ["security."] },
    { key: "system", label: "Sistema", description: "Parámetros generales de la aplicación.", prefixes: ["system."] },
    { key: "other", label: "Otros", description: "Parámetros adicionales no agrupados.", prefixes: [] },
];

function sectionForParam(param: Param) {
    return (
        SECTIONS.find((s) => s.prefixes.some((prefix) => param.clave.startsWith(prefix))) ||
        SECTIONS.find((s) => s.key === "other")!
    );
}

function validateValue(param: Param, value: string): string | null {
    if ((value === "" || value === undefined) && !param.esSecreto) return "El valor es requerido";
    if (param.esSecreto && value === "") return null;
    if (param.tipo === "INTEGER") {
        if (!/^-?\d+$/.test(value)) return "Debe ser un número entero";
    }
    if (param.tipo === "FLOAT") {
        if (!/^-?\d+(\.\d+)?$/.test(value)) return "Debe ser un número decimal";
    }
    if (param.tipo === "BOOLEAN") {
        if (!/^(true|false)$/.test(value)) return "Debe ser true o false";
    }
    return null;
}

export default function ConfigPanel() {
    const [params, setParams] = useState<Param[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [messages, setMessages] = useState<Record<string, { type: "success" | "error"; text: string } | null>>({});
    const [pendingConfig, setPendingConfig] = useState<Record<string, string> | null>(null);
    const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([]);
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const pending = localStorage.getItem("experiment_pending_config");
        if (pending) {
            try {
                setPendingConfig(JSON.parse(pending));
            } catch {
                localStorage.removeItem("experiment_pending_config");
            }
        }

        Promise.all([
            fetch("/api/config/parametros", { credentials: "include" }).then((r) => r.json()),
            fetch("/api/admin/audit-logs?accion=PARAM_UPDATE&page=1&pageSize=50", { credentials: "include" }).then((r) => r.json()),
        ])
            .then(([data, auditData]) => {
                const items: Param[] = data.items || [];
                setParams(items);
                const initial: Record<string, string> = {};
                items.forEach((p: Param) => {
                    initial[p.clave] = p.valor ?? "";
                });
                if (pending) {
                    try {
                        const parsed = JSON.parse(pending) as Record<string, string>;
                        Object.assign(initial, parsed);
                    } catch {
                        // ignore
                    }
                }
                setEditValues(initial);
                setTimeline(auditData.items || []);
                setLoading(false);
            })
            .catch(() => {
                setMessages({ global: { type: "error", text: "Error cargando parámetros. ¿Iniciaste sesión como admin?" } });
                setLoading(false);
            });
    }, []);

    function dismissPendingConfig() {
        localStorage.removeItem("experiment_pending_config");
        setPendingConfig(null);
    }

    const grouped = useMemo(() => {
        const map: Record<string, Param[]> = {};
        SECTIONS.forEach((s) => (map[s.key] = []));
        params.forEach((p) => {
            const section = sectionForParam(p);
            map[section.key].push(p);
        });
        return map;
    }, [params]);

    async function saveParam(clave: string) {
        const value = editValues[clave];
        const param = params.find((p) => p.clave === clave);
        if (!param) return;

        if (param.esSecreto && value === "") return;

        const error = validateValue(param, value);
        if (error) {
            setMessages((m) => ({ ...m, [clave]: { type: "error", text: error } }));
            return;
        }

        setSaving((s) => ({ ...s, [clave]: true }));
        setMessages((m) => ({ ...m, [clave]: null }));

        try {
            const res = await fetch(`/api/config/parametros/${encodeURIComponent(clave)}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: value }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || "Error guardando");
            }

            if (param.esSecreto) {
                setEditValues((prev) => ({ ...prev, [clave]: "" }));
            }
            setParams((prev) => prev.map((p) => (p.clave === clave ? { ...p, valor: value } : p)));
            setMessages((m) => ({ ...m, [clave]: { type: "success", text: "Guardado" } }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error";
            setMessages((m) => ({ ...m, [clave]: { type: "error", text: msg } }));
        } finally {
            setSaving((s) => ({ ...s, [clave]: false }));
        }
    }

    async function saveSection(sectionKey: string) {
        const sectionParams = grouped[sectionKey] || [];
        const updates = sectionParams.filter((p) => {
            if (p.esSecreto) return false;
            const current = p.valor ?? "";
            return editValues[p.clave] !== current;
        });
        if (updates.length === 0) {
            setMessages((m) => ({ ...m, [sectionKey]: { type: "error", text: "No hay cambios para guardar" } }));
            return;
        }

        for (const p of updates) {
            const error = validateValue(p, editValues[p.clave]);
            if (error) {
                setMessages((m) => ({ ...m, [sectionKey]: { type: "error", text: `${p.clave}: ${error}` } }));
                return;
            }
        }

        setSaving((s) => ({ ...s, [sectionKey]: true }));
        setMessages((m) => ({ ...m, [sectionKey]: null }));

        const results = await Promise.allSettled(
            updates.map((p) =>
                fetch(`/api/config/parametros/${encodeURIComponent(p.clave)}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ valor: editValues[p.clave] }),
                })
            )
        );

        const failed: string[] = [];
        const succeeded: string[] = [];

        results.forEach((r, idx) => {
            const clave = updates[idx].clave;
            if (r.status === "rejected" || !r.value.ok) {
                failed.push(clave);
            } else {
                succeeded.push(clave);
            }
        });

        setParams((prev) =>
            prev.map((p) => {
                if (succeeded.includes(p.clave)) return { ...p, valor: editValues[p.clave] };
                return p;
            })
        );
        if (succeeded.length > 0) {
            setEditValues((prev) => {
                const next = { ...prev };
                for (const clave of succeeded) {
                    const param = params.find((p) => p.clave === clave);
                    if (param?.esSecreto) next[clave] = "";
                }
                return next;
            });
        }

        if (failed.length === 0) {
            setMessages((m) => ({ ...m, [sectionKey]: { type: "success", text: `Guardados ${succeeded.length} parámetros` } }));
        } else {
            setMessages((m) => ({
                ...m,
                [sectionKey]: { type: "error", text: `Fallaron ${failed.length} parámetros: ${failed.join(", ")}` },
            }));
        }

        setSaving((s) => ({ ...s, [sectionKey]: false }));
    }

    function updateValue(clave: string, value: string) {
        setEditValues((prev) => ({ ...prev, [clave]: value }));
        setMessages((m) => ({ ...m, [clave]: null }));
    }

    async function toggleReveal(clave: string) {
        if (revealed[clave]) {
            setRevealed((prev) => ({ ...prev, [clave]: false }));
            setEditValues((prev) => ({ ...prev, [clave]: "" }));
            return;
        }
        try {
            const res = await fetch(`/api/config/parametros/${encodeURIComponent(clave)}/revelar`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || "Error revelando");
            }
            const { valor } = (await res.json()) as { valor: string };
            setEditValues((prev) => ({ ...prev, [clave]: valor }));
            setRevealed((prev) => ({ ...prev, [clave]: true }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error";
            setMessages((m) => ({ ...m, [clave]: { type: "error", text: msg } }));
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
                <span className="ml-3 text-muted">Cargando parámetros...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {messages.global && (
                <div
                    className={`rounded-xl p-4 text-sm ${
                        messages.global.type === "error"
                            ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                    }`}
                >
                    {messages.global.text}
                </div>
            )}

            {pendingConfig && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                    <div className="flex items-center justify-between">
                        <p>Configuración precargada desde un experimento. Revisa los valores y guarda para activarla.</p>
                        <Button variant="ghost" className="text-xs" onClick={dismissPendingConfig}>
                            Descartar
                        </Button>
                    </div>
                </div>
            )}

            {SECTIONS.map((section) => {
                const items = grouped[section.key] || [];
                if (items.length === 0) return null;

                return (
                    <section key={section.key} className="glass rounded-2xl p-5 sm:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-body">{section.label}</h2>
                                <p className="text-sm text-muted">{section.description}</p>
                            </div>
                            <Button
                                onClick={() => saveSection(section.key)}
                                isLoading={saving[section.key]}
                                disabled={saving[section.key]}
                            >
                                Guardar cambios
                            </Button>
                        </div>

                        {messages[section.key] && (
                            <div
                                className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                                    messages[section.key]!.type === "error"
                                        ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                                        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                                }`}
                            >
                                {messages[section.key]!.text}
                            </div>
                        )}

                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {items
                                .filter((p) => p.clave !== "ui.grupos_categoria")
                                .map((p) => (
                                <div key={p.id} className="py-4 first:pt-0 last:pb-0">
                                    <div className="grid gap-4 sm:grid-cols-[1fr,280px,120px]">
                                        <div>
                                            <label className="block text-sm font-medium text-body">{p.clave}</label>
                                            <p className="mt-0.5 text-xs text-muted">{p.descripcion || "Sin descripción"}</p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-subtle">
                                                <span>{p.tipo}</span>
                                                <span>•</span>
                                                <span>{p.categoria}</span>
                                                {p.esPublico && <span className="text-accent">Público</span>}
                                            </div>
                                        </div>

                                        <div>
                                            {p.tipo === "BOOLEAN" ? (
                                                <div className="relative">
                                                    <select
                                                        value={editValues[p.clave] ?? p.valor}
                                                        onChange={(e) => updateValue(p.clave, e.target.value)}
                                                        className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input appearance-none pr-10"
                                                    >
                                                        <option value="true">true</option>
                                                        <option value="false">false</option>
                                                    </select>
                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
                                                        <ChevronIcon className="h-4 w-4" />
                                                    </span>
                                                </div>
                                            ) : p.tipo === "INTEGER" || p.tipo === "FLOAT" ? (
                                                <input
                                                    type="number"
                                                    step={p.tipo === "FLOAT" ? "0.01" : "1"}
                                                    value={editValues[p.clave] ?? p.valor}
                                                    onChange={(e) => updateValue(p.clave, e.target.value)}
                                                    className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type={p.esSecreto && !revealed[p.clave] ? "password" : "text"}
                                                        value={editValues[p.clave] ?? ""}
                                                        placeholder={p.esSecreto ? "•••••••• (ingresar nuevo valor)" : ""}
                                                        onChange={(e) => updateValue(p.clave, e.target.value)}
                                                        className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input"
                                                    />
                                                    {p.esSecreto && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            className="shrink-0 px-2 py-2 text-xs"
                                                            onClick={() => toggleReveal(p.clave)}
                                                            title={revealed[p.clave] ? "Ocultar" : "Revelar"}
                                                        >
                                                            {revealed[p.clave] ? "Ocultar" : "Revelar"}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <Button
                                                onClick={() => saveParam(p.clave)}
                                                isLoading={saving[p.clave]}
                                                disabled={
                                                    saving[p.clave] ||
                                                    (p.esSecreto ? editValues[p.clave] === "" : editValues[p.clave] === p.valor)
                                                }
                                                variant="outline"
                                                className="w-full py-2 px-3 text-xs"
                                            >
                                                Guardar
                                            </Button>
                                        </div>
                                    </div>

                                    {messages[p.clave] && (
                                        <div
                                            className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${
                                                messages[p.clave]!.type === "error"
                                                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                                                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                                            }`}
                                        >
                                            {messages[p.clave]!.text}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}

            <section className="glass rounded-2xl p-5 sm:p-6">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Grupos de categoría</h2>
                    <p className="text-sm text-muted">
                        Agrupa las 12 categorías internas en los nombres que ven los usuarios (padres) en consultas, seguimiento y dashboards.
                    </p>
                </div>
                <CategoriaGruposEditor />
            </section>

            <section className="glass rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-body">Timeline de cambios de producción</h2>
                <p className="text-sm text-muted">Solo lectura. Registro de cambios en parámetros de configuración.</p>
                {timeline.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Sin cambios registrados.</p>
                ) : (
                    <div className="mt-4 space-y-3 max-h-96 overflow-auto">
                        {timeline.map((log: Record<string, unknown>) => (
                            <div key={String(log.id)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-body">{String(log.accion)}</span>
                                    <span className="text-xs text-muted">{new Date(String(log.creadoEn)).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-muted">
                                    {((log.usuario as Record<string, string>)?.email) || "sistema"} · {String(log.tipoRecurso)}
                                </p>
                                {Boolean(log.valorAnterior) && Boolean(log.valorNuevo) && (
                                    <div className="mt-2 grid gap-1 text-xs">
                                        <p className="text-red-700 dark:text-red-300">- {String(log.valorAnterior).slice(0, 200)}</p>
                                        <p className="text-green-700 dark:text-green-300">+ {String(log.valorNuevo).slice(0, 200)}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}
