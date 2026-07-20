"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { CategoriaGruposEditor } from "./CategoriaGruposEditor";
import { ConfigSection } from "./config-panel/ConfigSection";
import { TimelineSection } from "./config-panel/TimelineSection";
import { validateValue, SECTIONS, sectionForParam, type Param } from "./config-panel/types";

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

    useEffect(() => {
        const hasUnsaved = params.some((p) => {
            if (p.esSecreto) return false;
            return editValues[p.clave] !== (p.valor ?? "");
        });

        const handler = (e: BeforeUnloadEvent) => {
            if (hasUnsaved) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [params, editValues]);

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

            {SECTIONS.map((section) => (
                <ConfigSection
                    key={section.key}
                    section={section}
                    items={grouped[section.key] || []}
                    editValues={editValues}
                    revealed={revealed}
                    messages={messages}
                    saving={saving}
                    onUpdate={updateValue}
                    onSave={saveParam}
                    onReveal={toggleReveal}
                    onSaveSection={saveSection}
                />
            ))}

            <section className="glass rounded-2xl p-5 sm:p-6">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Grupos de categoría</h2>
                    <p className="text-sm text-muted">
                        Agrupa las 12 categorías internas en los nombres que ven los usuarios (padres) en consultas, seguimiento y dashboards.
                    </p>
                </div>
                <CategoriaGruposEditor />
            </section>

            <TimelineSection timeline={timeline} />
        </div>
    );
}
