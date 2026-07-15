"use client";

import { useState, useEffect, useMemo } from "react";

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
    {
        key: "scoring",
        label: "Modelo de Score (F1)",
        description: "Pesos y umbrales que calculan el score de riesgo 0-100. Los cambios se aplican inmediatamente en la próxima consulta.",
        prefixes: ["scoring."],
    },
    {
        key: "visibility",
        label: "Visibilidad Pública",
        description: "Reglas para que un identificador aparezca en la consulta pública: cantidad mínima de reportes y porcentaje autenticados.",
        prefixes: ["visibility."],
    },
    {
        key: "alerts",
        label: "Alertas por Email",
        description: "Activar/desactivar notificaciones a administradores y suscriptores.",
        prefixes: ["alerts."],
    },
    {
        key: "ratelimit",
        label: "Rate Limiting",
        description: "Límites de peticiones por ventana de tiempo para reportes, login, registro y consultas.",
        prefixes: ["ratelimit."],
    },
    {
        key: "reportes",
        label: "Procesamiento de Reportes",
        description: "Modelos de IA, umbrales de duplicados y parámetros del worker.",
        prefixes: ["reportes."],
    },
    {
        key: "security",
        label: "Seguridad",
        description: "Intentos de login, duración de bloqueo, longitud de contraseña y otros parámetros de seguridad.",
        prefixes: ["security."],
    },
    {
        key: "system",
        label: "Sistema",
        description: "Parámetros generales de la aplicación.",
        prefixes: ["system."],
    },
    {
        key: "other",
        label: "Otros",
        description: "Parámetros adicionales no agrupados.",
        prefixes: [],
    },
];

function sectionForParam(param: Param) {
    return (
        SECTIONS.find((s) => s.prefixes.some((prefix) => param.clave.startsWith(prefix))) ||
        SECTIONS.find((s) => s.key === "other")!
    );
}

function validateValue(param: Param, value: string): string | null {
    if (value === "" || value === undefined) return "El valor es requerido";
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

    useEffect(() => {
        fetch("/api/config/parametros", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                const items: Param[] = data.items || [];
                setParams(items);
                const initial: Record<string, string> = {};
                items.forEach((p: Param) => {
                    initial[p.clave] = p.valor;
                });
                setEditValues(initial);
                setLoading(false);
            })
            .catch(() => {
                setMessages({ global: { type: "error", text: "Error cargando parámetros. ¿Iniciaste sesión como admin?" } });
                setLoading(false);
            });
    }, []);

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
        const updates = sectionParams.filter((p) => editValues[p.clave] !== p.valor);
        if (updates.length === 0) {
            setMessages((m) => ({ ...m, [sectionKey]: { type: "error", text: "No hay cambios para guardar" } }));
            return;
        }

        // Validar todos antes de enviar
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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <span className="ml-3 text-slate-600">Cargando parámetros...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {messages.global && (
                <div
                    className={`rounded-xl p-4 text-sm ${
                        messages.global.type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
                    }`}
                >
                    {messages.global.text}
                </div>
            )}

            {SECTIONS.map((section) => {
                const items = grouped[section.key] || [];
                if (items.length === 0) return null;

                return (
                    <section key={section.key} className="rounded-2xl bg-white p-6 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">{section.label}</h2>
                                <p className="text-sm text-slate-500">{section.description}</p>
                            </div>
                            <button
                                onClick={() => saveSection(section.key)}
                                disabled={saving[section.key]}
                                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                                {saving[section.key] ? "Guardando..." : "Guardar cambios de esta sección"}
                            </button>
                        </div>

                        {messages[section.key] && (
                            <div
                                className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                                    messages[section.key]!.type === "error"
                                        ? "bg-red-50 text-red-800"
                                        : "bg-green-50 text-green-800"
                                }`}
                            >
                                {messages[section.key]!.text}
                            </div>
                        )}

                        <div className="divide-y divide-slate-100">
                            {items.map((p) => (
                                <div key={p.id} className="py-4 first:pt-0 last:pb-0">
                                    <div className="grid gap-4 sm:grid-cols-[1fr,200px,120px]">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-800">
                                                {p.clave}
                                            </label>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                {p.descripcion || "Sin descripción"}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                                                <span>{p.tipo}</span>
                                                <span>•</span>
                                                <span>{p.categoria}</span>
                                                {p.esPublico && <span className="text-primary-600">Público</span>}
                                            </div>
                                        </div>

                                        <div>
                                            {p.tipo === "BOOLEAN" ? (
                                                <select
                                                    value={editValues[p.clave] ?? p.valor}
                                                    onChange={(e) => updateValue(p.clave, e.target.value)}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                >
                                                    <option value="true">true</option>
                                                    <option value="false">false</option>
                                                </select>
                                            ) : p.tipo === "INTEGER" || p.tipo === "FLOAT" ? (
                                                <input
                                                    type="number"
                                                    step={p.tipo === "FLOAT" ? "0.01" : "1"}
                                                    value={editValues[p.clave] ?? p.valor}
                                                    onChange={(e) => updateValue(p.clave, e.target.value)}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={editValues[p.clave] ?? p.valor}
                                                    onChange={(e) => updateValue(p.clave, e.target.value)}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                />
                                            )}
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <button
                                                onClick={() => saveParam(p.clave)}
                                                disabled={saving[p.clave] || editValues[p.clave] === p.valor}
                                                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
                                            >
                                                {saving[p.clave] ? "..." : "Guardar"}
                                            </button>
                                        </div>
                                    </div>

                                    {messages[p.clave] && (
                                        <div
                                            className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${
                                                messages[p.clave]!.type === "error"
                                                    ? "bg-red-50 text-red-700"
                                                    : "bg-green-50 text-green-700"
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
        </div>
    );
}
