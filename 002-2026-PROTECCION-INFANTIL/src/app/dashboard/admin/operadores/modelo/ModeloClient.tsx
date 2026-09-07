"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OperadoresSubNav } from "../components/OperadoresSubNav";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";

type ModeloAsignacion = {
    cupoMaximoDefault: number;
    estrategia: "ponderado_carga_inversa" | "aleatorio_puro";
};

export default function AdminOperadoresModeloPage() {
    const [modelo, setModelo] = useState<ModeloAsignacion | null>(null);
    const [form, setForm] = useState<ModeloAsignacion | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    async function cargar() {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/operadores/modelo", { credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setModelo(json);
                setForm(json);
            } else {
                setMessage({ type: "error", text: json?.error?.message || "Error cargando modelo" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando modelo" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        if (!form) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/operadores/modelo", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cupoMaximoDefault: form.cupoMaximoDefault,
                    estrategia: form.estrategia,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setModelo(json);
                setForm(json);
                setMessage({ type: "success", text: "Modelo de asignación actualizado" });
            } else {
                setMessage({ type: "error", text: json?.error?.message || "Error actualizando modelo" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red actualizando modelo" });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Modelo de asignación</h1>
                <p className="text-sm text-muted">
                    Configure cómo se reparten los casos entre operadores y el cupo default.
                </p>
            </div>

            <OperadoresSubNav />

            {message && (
                <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">
                    {message.text}
                </Alerta>
            )}

            <GlassCard>
                {loading || !form ? (
                    <Cargando inline texto="Cargando modelo..." className="py-8" />
                ) : (
                    <form onSubmit={guardar} className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <Input
                                label="Cupo máximo default"
                                type="number"
                                min={1}
                                max={200}
                                required
                                value={form.cupoMaximoDefault}
                                onChange={(e) =>
                                    setForm((f) => (f ? { ...f, cupoMaximoDefault: Number(e.target.value) } : null))
                                }
                            />
                            <div>
                                <label className="mb-1 block text-sm font-medium text-body">Estrategia de asignación</label>
                                <select
                                    value={form.estrategia}
                                    onChange={(e) =>
                                        setForm((f) =>
                                            f
                                                ? {
                                                    ...f,
                                                    estrategia: e.target.value as ModeloAsignacion["estrategia"],
                                                }
                                                : null
                                        )
                                    }
                                    className="w-full rounded-lg border border-tinta/10 bg-papel/70 px-3 py-2 text-sm text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                                >
                                    <option value="ponderado_carga_inversa">
                                        Ponderado por carga inversa (más cupo libre = más probabilidad)
                                    </option>
                                    <option value="aleatorio_puro">Aleatorio puro</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-xl bg-tinta/5 p-4 text-sm text-muted">
                            <p className="font-medium text-body">Cómo funciona</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                <li>La asignación es instantánea cuando un reporte entra a revisión manual.</li>
                                <li>Solo se asignan operadores activos con cupo disponible.</li>
                                <li>Si un operador tiene un cupo explícito en su perfil, ese valor tiene prioridad sobre el default.</li>
                                <li>Con &quot;ponderado por carga inversa&quot;, quien tenga más cupo libre relativo tiene más chances de recibir el caso.</li>
                                <li>Con &quot;aleatorio puro&quot;, todos los operadores con cupo disponible tienen la misma probabilidad.</li>
                            </ul>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" isLoading={saving}>
                                Guardar cambios
                            </Button>
                        </div>
                    </form>
                )}
            </GlassCard>
        </div>
    );
}
