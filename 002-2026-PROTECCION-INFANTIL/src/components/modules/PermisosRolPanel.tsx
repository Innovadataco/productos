"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";

interface Submodulo {
    id: string;
    clave: string;
    nombre: string;
    esCritico: boolean;
}

interface Modulo extends Submodulo {
    submodulos: Submodulo[];
}

interface Permiso {
    rol: string;
    moduloId: string;
    activo: boolean;
}

interface MatrizResponse {
    roles: string[];
    rolesProtegidos: string[];
    modulos: Modulo[];
    permisos: Permiso[];
}

type Mensaje = { type: "success" | "error"; text: string } | null;

export function PermisosRolPanel() {
    const [data, setData] = useState<MatrizResponse | null>(null);
    const [rol, setRol] = useState("");
    const [activos, setActivos] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<Mensaje>(null);

    useEffect(() => {
        async function cargar() {
            setLoading(true);
            try {
                const res = await fetch("/api/admin/permisos-modulos", { credentials: "include" });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error?.message || "Error cargando permisos");
                setData(json);
                if (json.roles.length > 0) setRol((r) => r || json.roles[0]);
            } catch (err) {
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
            } finally {
                setLoading(false);
            }
        }
        cargar();
    }, []);

    // Estado local del rol seleccionado (inicializado desde la matriz)
    useEffect(() => {
        if (!data || !rol) return;
        const inicial: Record<string, boolean> = {};
        for (const p of data.permisos.filter((x) => x.rol === rol)) {
            inicial[p.moduloId] = p.activo;
        }
        setActivos(inicial);
        setMessage(null);
    }, [data, rol]);

    const cambios = useMemo(() => {
        if (!data || !rol) return [];
        const originales = new Map(data.permisos.filter((p) => p.rol === rol).map((p) => [p.moduloId, p.activo]));
        return Object.entries(activos)
            .filter(([moduloId, activo]) => (originales.get(moduloId) ?? false) !== activo)
            .map(([moduloId, activo]) => ({ rol, moduloId, activo }));
    }, [data, rol, activos]);

    function toggle(moduloId: string) {
        setActivos((prev) => ({ ...prev, [moduloId]: !prev[moduloId] }));
    }

    async function guardar() {
        if (cambios.length === 0) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/permisos-modulos", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cambios }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error?.message || "Error guardando");
            setMessage({ type: "success", text: `${json.actualizados} permiso(s) actualizados.` });
            setData((prev) =>
                prev
                    ? {
                          ...prev,
                          permisos: [
                              ...prev.permisos.filter((p) => !cambios.some((c) => c.rol === p.rol && c.moduloId === p.moduloId)),
                              ...cambios,
                          ],
                      }
                    : prev
            );
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        } finally {
            setSaving(false);
        }
    }

    function renderModulo(modulo: Submodulo, esHijo: boolean) {
        const activo = activos[modulo.id] === true;
        return (
            <label key={modulo.id} className={`flex items-center gap-3 py-1.5 ${esHijo ? "ml-8" : ""}`}>
                <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => toggle(modulo.id)}
                    className="h-4 w-4"
                    aria-label={`Permiso ${modulo.nombre}`}
                />
                <span className="text-sm text-body">{modulo.nombre}</span>
                <span className="text-xs text-subtle">{modulo.clave}</span>
                {modulo.esCritico && <Badge variant="warning">Crítico</Badge>}
            </label>
        );
    }

    if (loading) return <p className="text-sm text-muted">Cargando permisos...</p>;
    if (!data) return <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar la matriz de permisos.</p>;

    return (
        <GlassCard className="p-6 space-y-5">
            <div>
                <h3 className="text-lg font-semibold text-body">Permisos por rol</h3>
                <p className="text-sm text-muted">
                    Activa o desactiva módulos por rol. Sin permiso activo, el rol no accede (denegado por defecto).
                    Los cambios se auditan. Roles protegidos (anti-lockout): {data.rolesProtegidos.join(", ")}.
                </p>
            </div>

            <Select
                label="Rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                options={data.roles.map((r) => ({ value: r, label: r }))}
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.modulos.map((modulo) => (
                    <div key={modulo.id} className="py-2">
                        {renderModulo(modulo, false)}
                        {modulo.submodulos.map((sub) => renderModulo(sub, true))}
                    </div>
                ))}
            </div>

            {message && (
                <p className={`text-sm ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {message.text}
                </p>
            )}

            <div className="flex gap-2">
                <Button onClick={guardar} isLoading={saving} disabled={cambios.length === 0}>
                    Guardar cambios ({cambios.length})
                </Button>
            </div>
        </GlassCard>
    );
}
