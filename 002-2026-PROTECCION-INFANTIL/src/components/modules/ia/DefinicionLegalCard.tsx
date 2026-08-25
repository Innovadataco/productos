"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatCategoria } from "@/lib/labels";

export interface DefinicionCategoriaView {
    conductaLegal: string;
    definicionLiteral: string;
    referenciaNormativa: string;
    rolDentroDeConducta?: string | null;
}

interface DefinicionLegalCardProps {
    categoria: string;
    definicion: DefinicionCategoriaView;
    puedeEditar: boolean;
    onGuardar: (definicion: DefinicionCategoriaView) => Promise<void>;
}

/**
 * Card destacado con el fundamento legal de una categoría (SPEC-248, 002-PI-151).
 * Se renderiza ANTES de las preguntas de rúbrica de la categoría seleccionada
 * (D-74: color ámbar de admin backoffice, vidrio Apple).
 */
export function DefinicionLegalCard({ categoria, definicion, puedeEditar, onGuardar }: DefinicionLegalCardProps) {
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState<DefinicionCategoriaView>(definicion);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function abrirModal() {
        setForm(definicion);
        setError(null);
        setEditando(true);
    }

    async function guardar() {
        setGuardando(true);
        setError(null);
        try {
            await onGuardar(form);
            setEditando(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error guardando la definición");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <GlassCard className="border-l-4 border-l-amber-400 bg-amber-50/60 p-6 space-y-3 dark:border-l-amber-500 dark:bg-amber-950/20">
            <div className="flex items-start justify-between gap-3">
                <Badge variant="warning">{formatCategoria(categoria)}</Badge>
                {puedeEditar && (
                    <Button variant="outline" onClick={abrirModal}>
                        Editar definición legal
                    </Button>
                )}
            </div>

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Conducta legal</p>
                <p className="text-body">{definicion.conductaLegal}</p>
            </div>

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Referencia normativa</p>
                <p className="text-body">{definicion.referenciaNormativa}</p>
            </div>

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Definición literal</p>
                <p className="italic text-body">&ldquo;{definicion.definicionLiteral}&rdquo;</p>
            </div>

            {definicion.rolDentroDeConducta && (
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Rol dentro de la conducta
                    </p>
                    <p className="text-body">{definicion.rolDentroDeConducta}</p>
                </div>
            )}

            {editando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <GlassCard className="w-full max-w-lg space-y-4 p-6">
                        <h4 className="text-lg font-semibold text-body">Editar definición legal — {formatCategoria(categoria)}</h4>
                        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                        <Input
                            label="Conducta legal"
                            value={form.conductaLegal}
                            onChange={(e) => setForm((f) => ({ ...f, conductaLegal: e.target.value }))}
                        />
                        <Input
                            label="Referencia normativa"
                            value={form.referenciaNormativa}
                            onChange={(e) => setForm((f) => ({ ...f, referenciaNormativa: e.target.value }))}
                        />
                        <div>
                            <label className="mb-1 block text-sm font-medium text-body">Definición literal</label>
                            <textarea
                                value={form.definicionLiteral}
                                onChange={(e) => setForm((f) => ({ ...f, definicionLiteral: e.target.value }))}
                                rows={4}
                                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                            />
                        </div>
                        <Input
                            label="Rol dentro de la conducta (opcional)"
                            value={form.rolDentroDeConducta ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, rolDentroDeConducta: e.target.value }))}
                        />
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setEditando(false)} disabled={guardando}>
                                Cancelar
                            </Button>
                            <Button onClick={guardar} disabled={guardando}>
                                Guardar
                            </Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </GlassCard>
    );
}
