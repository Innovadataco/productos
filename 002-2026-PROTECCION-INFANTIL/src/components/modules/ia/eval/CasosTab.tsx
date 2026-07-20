"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import type { Caso } from "./types";
import { CATEGORIAS, FUENTES } from "./types";

export function CasosTab() {
    const [casos, setCasos] = useState<Caso[]>([]);
    const [conteos, setConteos] = useState<Record<string, number>>({});
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ categoria: "", ruido: "", fuente: "", activo: "" });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [form, setForm] = useState({ texto: "", categoriaEsperada: "", secundariaEsperada: "", ruido: false });

    async function loadCasos() {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.ruido) params.set("ruido", filters.ruido);
        if (filters.fuente) params.set("fuente", filters.fuente);
        if (filters.activo) params.set("activo", filters.activo);
        try {
            const res = await fetch(`/api/admin/ia/evals/casos?${params.toString()}`, { credentials: "include" });
            const data = await res.json();
            if (res.ok) {
                setCasos(data.items || []);
                setConteos(data.conteosPorCategoria || {});
                setTotalPages(data.pagination.totalPages || 1);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando casos" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCasos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters]);

    async function createCaso(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        try {
            const res = await fetch("/api/admin/ia/evals/casos", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: form.texto,
                    categoriaEsperada: form.categoriaEsperada,
                    secundariaEsperada: form.secundariaEsperada || undefined,
                    ruido: form.ruido,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error creando caso");
            setMessage({
                type: "success",
                text: `Caso creado. El fixture cambió a v${data.fixtureVersion}. Las métricas anteriores corresponden a v${data.fixtureVersion - 1}; corré el eval para establecer la nueva línea de base.`,
            });
            setForm({ texto: "", categoriaEsperada: "", secundariaEsperada: "", ruido: false });
            loadCasos();
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        }
    }

    async function disableCaso(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/ia/evals/casos/${id}/desactivar`, {
                method: "PATCH",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error desactivando caso");
            setMessage({
                type: "success",
                text: `Caso desactivado. El fixture cambió a v${data.fixtureVersion}. Corré el eval para establecer la nueva línea de base.`,
            });
            loadCasos();
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        }
    }

    return (
        <div className="space-y-6">
            {message && (
                <GlassCard className={`border-l-4 p-4 ${message.type === "success" ? "border-l-green-500" : "border-l-red-500"}`}>
                    <p className={message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {message.text}
                    </p>
                </GlassCard>
            )}

            <GlassCard className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-body">Alta de caso</h3>
                <form onSubmit={createCaso} className="space-y-4">
                    <textarea
                        value={form.texto}
                        onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                        placeholder="Texto del caso de evaluación..."
                        rows={3}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                        maxLength={4000}
                        required
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                        <Select
                            label="Categoría esperada"
                            value={form.categoriaEsperada}
                            onChange={(e) => setForm((f) => ({ ...f, categoriaEsperada: e.target.value }))}
                            options={[{ value: "", label: "Seleccionar..." }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                            required
                        />
                        <Select
                            label="Secundaria (opcional)"
                            value={form.secundariaEsperada}
                            onChange={(e) => setForm((f) => ({ ...f, secundariaEsperada: e.target.value }))}
                            options={[{ value: "", label: "Ninguna" }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                        />
                        <label className="flex items-center gap-2 text-sm text-body">
                            <input
                                type="checkbox"
                                checked={form.ruido}
                                onChange={(e) => setForm((f) => ({ ...f, ruido: e.target.checked }))}
                            />
                            Ruido
                        </label>
                    </div>
                    <Button type="submit">Crear caso</Button>
                </form>
            </GlassCard>

            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-body">Casos</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Select
                        label="Categoría"
                        value={filters.categoria}
                        onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value, page: "" }))}
                        options={[{ value: "", label: "Todas" }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                    />
                    <Select
                        label="Ruido"
                        value={filters.ruido}
                        onChange={(e) => setFilters((f) => ({ ...f, ruido: e.target.value }))}
                        options={[
                            { value: "", label: "Todos" },
                            { value: "true", label: "Sí" },
                            { value: "false", label: "No" },
                        ]}
                    />
                    <Select
                        label="Fuente"
                        value={filters.fuente}
                        onChange={(e) => setFilters((f) => ({ ...f, fuente: e.target.value }))}
                        options={[{ value: "", label: "Todas" }, ...FUENTES.map((c) => ({ value: c, label: c }))]}
                    />
                    <Select
                        label="Activo"
                        value={filters.activo}
                        onChange={(e) => setFilters((f) => ({ ...f, activo: e.target.value }))}
                        options={[
                            { value: "", label: "Todos" },
                            { value: "true", label: "Sí" },
                            { value: "false", label: "No" },
                        ]}
                    />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(conteos).map(([cat, count]) => (
                        <Badge key={cat} variant="neutral">
                            {cat}: {count}
                        </Badge>
                    ))}
                </div>

                {loading ? (
                    <p className="mt-4 text-sm text-muted">Cargando...</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {casos.map((c) => (
                            <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge>{c.categoriaEsperada}</Badge>
                                    {c.secundariaEsperada && <Badge variant="info">{c.secundariaEsperada}</Badge>}
                                    {c.ruido && <Badge variant="warning">ruido</Badge>}
                                    <Badge variant={c.activo ? "success" : "danger"}>{c.activo ? "activo" : "inactivo"}</Badge>
                                    <span className="text-xs text-muted">v{c.fixtureVersion}</span>
                                </div>
                                <p className="mt-2 text-muted line-clamp-2">{c.texto}</p>
                                {c.activo && (
                                    <Button variant="ghost" className="mt-2 text-xs" onClick={() => disableCaso(c.id)}>
                                        Desactivar
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 flex gap-2">
                    <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                        Anterior
                    </Button>
                    <span className="self-center text-sm text-muted">
                        Página {page} de {totalPages}
                    </span>
                    <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                        Siguiente
                    </Button>
                </div>
            </GlassCard>
        </div>
    );
}
