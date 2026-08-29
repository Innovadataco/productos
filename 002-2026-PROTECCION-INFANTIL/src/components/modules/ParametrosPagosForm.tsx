"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

const CLAVES = [
    "pagos.iva.porcentaje",
    "pagos.iva.aplica_a",
    "pagos.freemium.activo",
    "pagos.freemium.duracion_dias",
    "pagos.recompensa.activa",
    "pagos.recompensa.meses_gratis",
    "pagos.recompensa.max_por_año",
] as const;

type ClaveParametro = (typeof CLAVES)[number];

const OPCIONES_IVA_APLICA = [
    { value: "todos", label: "Todos" },
    { value: "solo_colegios", label: "Solo colegios" },
    { value: "solo_padres", label: "Solo padres" },
    { value: "ninguno", label: "Ninguno" },
];

function parseBool(valor: string | null): boolean {
    return valor === "true";
}

export function ParametrosPagosForm() {
    const [valores, setValores] = useState<Record<ClaveParametro, string | null>>({
        "pagos.iva.porcentaje": "19",
        "pagos.iva.aplica_a": "todos",
        "pagos.freemium.activo": "true",
        "pagos.freemium.duracion_dias": "30",
        "pagos.recompensa.activa": "true",
        "pagos.recompensa.meses_gratis": "1",
        "pagos.recompensa.max_por_año": "5",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/config/parametros?categoria=SYSTEM&pageSize=100");
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message ?? "Error al cargar parámetros");
                return;
            }
            const items: Array<{ clave: string; valor: string }> = data.items ?? [];
            const next: Record<string, string> = {};
            for (const item of items) {
                if (CLAVES.includes(item.clave as ClaveParametro)) {
                    next[item.clave] = item.valor;
                }
            }
            setValores((prev) => ({ ...prev, ...next }));
        } catch {
            setError("Error de red al cargar parámetros");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void cargar();
    }, []);

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const body = {
            "pagos.iva.porcentaje": Number(valores["pagos.iva.porcentaje"]),
            "pagos.iva.aplica_a": valores["pagos.iva.aplica_a"] ?? "todos",
            "pagos.freemium.activo": valores["pagos.freemium.activo"] === "true",
            "pagos.freemium.duracion_dias": Number(valores["pagos.freemium.duracion_dias"]),
            "pagos.recompensa.activa": valores["pagos.recompensa.activa"] === "true",
            "pagos.recompensa.meses_gratis": Number(valores["pagos.recompensa.meses_gratis"]),
            "pagos.recompensa.max_por_año": Number(valores["pagos.recompensa.max_por_año"]),
        };

        try {
            const res = await fetch("/api/admin/pagos/parametros", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message ?? "Error al guardar parámetros");
                return;
            }
            setSuccess("Parámetros globales actualizados");
            await cargar();
        } catch {
            setError("Error de red al guardar parámetros");
        }
    }

    function actualizar(clave: ClaveParametro, valor: string) {
        setValores((prev) => ({ ...prev, [clave]: valor }));
    }

    return (
        <GlassCard>
            <h3 className="mb-4 text-base font-semibold text-body">Configuración global de pagos</h3>
            {error && <Alerta tono="error">{error}</Alerta>}
            {success && <Alerta tono="exito">{success}</Alerta>}
            <form onSubmit={guardar} className="grid gap-4 md:grid-cols-2">
                <Input
                    label="IVA %"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={valores["pagos.iva.porcentaje"] ?? ""}
                    onChange={(e) => actualizar("pagos.iva.porcentaje", e.target.value)}
                />
                <Select
                    label="IVA aplica a"
                    options={OPCIONES_IVA_APLICA}
                    value={valores["pagos.iva.aplica_a"] ?? "todos"}
                    onChange={(e) => actualizar("pagos.iva.aplica_a", e.target.value)}
                />
                <Input
                    label="Duración freemium (días)"
                    type="number"
                    min={1}
                    required
                    value={valores["pagos.freemium.duracion_dias"] ?? ""}
                    onChange={(e) => actualizar("pagos.freemium.duracion_dias", e.target.value)}
                />
                <Input
                    label="Recompensa: meses gratis"
                    type="number"
                    min={0}
                    max={12}
                    required
                    value={valores["pagos.recompensa.meses_gratis"] ?? ""}
                    onChange={(e) => actualizar("pagos.recompensa.meses_gratis", e.target.value)}
                />
                <Input
                    label="Recompensa: máximo por año"
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={valores["pagos.recompensa.max_por_año"] ?? ""}
                    onChange={(e) => actualizar("pagos.recompensa.max_por_año", e.target.value)}
                />
                <div className="flex items-center gap-6 py-2">
                    <label className="flex items-center gap-2 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={parseBool(valores["pagos.freemium.activo"])}
                            onChange={(e) => actualizar("pagos.freemium.activo", e.target.checked ? "true" : "false")}
                            className="h-4 w-4 rounded border-tinta/20"
                        />
                        Freemium activo
                    </label>
                    <label className="flex items-center gap-2 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={parseBool(valores["pagos.recompensa.activa"])}
                            onChange={(e) => actualizar("pagos.recompensa.activa", e.target.checked ? "true" : "false")}
                            className="h-4 w-4 rounded border-tinta/20"
                        />
                        Recompensa activa
                    </label>
                </div>
                <div className="flex gap-2 md:col-span-2">
                    <Button type="submit" isLoading={loading}>
                        Guardar configuración
                    </Button>
                    <Button type="button" variant="outline" onClick={cargar} disabled={loading}>
                        Cancelar
                    </Button>
                </div>
            </form>
        </GlassCard>
    );
}
