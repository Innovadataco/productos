"use client";

/**
 * SPEC-380 (PR B · C4/D-100) — panel de identificadores del integrante del
 * comité (usuario, teléfono, email en plataformas). Cada identificador ACTIVO
 * dispara alerta al COLEGIO (nunca a la persona) si se reporta el mismo valor.
 *
 * Voz: usted formal. La lista es corta y directa — este panel no necesita
 * modales; alta y baja inline como en el resto del comité.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

interface Identificador {
    id: string;
    tipo: string;
    valor: string;
    estado: string;
    plataforma: { id: string; clave: string; nombre: string } | null;
    createdAt: string;
}

interface Props {
    integranteId: string;
}

export function IdentificadoresIntegranteClient({ integranteId }: Props) {
    const [items, setItems] = useState<Identificador[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const [nuevoValor, setNuevoValor] = useState("");
    const [nuevaPlataformaClave, setNuevaPlataformaClave] = useState("");
    const [creando, setCreando] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/comite/integrantes/${integranteId}/identificadores`, {
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos cargar los identificadores.");
                return;
            }
            setItems(data.items ?? []);
        } catch {
            setError("Error de red al cargar los identificadores.");
        } finally {
            setLoading(false);
        }
    }, [integranteId]);

    useEffect(() => { void cargar(); }, [cargar]);

    async function crear(event: React.FormEvent) {
        event.preventDefault();
        setCreando(true);
        setMsg(null);
        setError(null);
        try {
            // El backend infiere el tipo si va vacío. Y resuelve la plataforma
            // por clave si se pasó ("whatsapp"/"instagram"/...).
            const res = await fetch(`/api/colegio/comite/integrantes/${integranteId}/identificadores`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    valor: nuevoValor.trim(),
                    plataformaId: nuevaPlataformaClave ? undefined : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos agregar el identificador.");
                return;
            }
            setNuevoValor("");
            setNuevaPlataformaClave("");
            setMsg("Identificador agregado. Desde ahora la cuenta se vigila.");
            await cargar();
        } catch {
            setError("Error de red al agregar el identificador.");
        } finally {
            setCreando(false);
        }
    }

    async function toggleEstado(item: Identificador) {
        const nuevoEstado = item.estado === "activo" ? "inactivo" : "activo";
        try {
            const res = await fetch(
                `/api/colegio/comite/integrantes/${integranteId}/identificadores/${item.id}`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado: nuevoEstado }),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos cambiar el estado.");
                return;
            }
            setMsg(nuevoEstado === "activo" ? "Identificador reactivado." : "Identificador desactivado.");
            await cargar();
        } catch {
            setError("Error de red al cambiar el estado.");
        }
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-sm text-muted">
                    <Link href="/dashboard/colegio/comite/integrantes" className="underline">
                        ← Volver a integrantes del comité
                    </Link>
                </p>
                <h1 className="mt-2 text-2xl font-bold text-body">Identificadores del integrante</h1>
                <p className="mt-1 text-sm text-muted">
                    Aquí registra las cuentas del integrante que quiere vigilar (usuario en una
                    plataforma, teléfono o correo). Si alguien reporta uno de estos valores, el
                    aviso llega al colegio — nunca a la persona vigilada.
                </p>
            </header>

            <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-body">Agregar</h2>
                <form onSubmit={crear} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex-1">
                        <span className="mb-1 block text-xs uppercase text-muted">Identificador</span>
                        <input
                            required
                            type="text"
                            value={nuevoValor}
                            onChange={(e) => setNuevoValor(e.target.value)}
                            placeholder="usuario@correo.co · @nick · +573001234567"
                            className="w-full rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                        />
                    </label>
                    <Button type="submit" isLoading={creando} disabled={creando || !nuevoValor.trim()}>
                        {creando ? "Agregando…" : "Agregar"}
                    </Button>
                </form>
                {msg && (
                    <p className="mt-3 text-sm text-muted" role="status">
                        {msg}
                    </p>
                )}
                {error && (
                    <p className="mt-3 text-sm text-estado-ambar" role="alert">
                        {error}
                    </p>
                )}
            </GlassCard>

            <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-body">Vigilados</h2>
                {loading ? (
                    <p className="mt-3 text-sm text-muted">Cargando…</p>
                ) : items.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                        Aún no hay identificadores. Al agregar el primero, empieza la vigilancia.
                    </p>
                ) : (
                    <ul className="mt-3 divide-y divide-tinta/10">
                        {items.map((it) => (
                            <li key={it.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm text-body">{it.valor}</p>
                                    <p className="text-xs text-muted">
                                        {it.tipo}
                                        {it.plataforma ? ` · ${it.plataforma.nombre}` : ""} · {it.estado}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => toggleEstado(it)}
                                    className="px-3 py-1 text-xs"
                                >
                                    {it.estado === "activo" ? "Desactivar" : "Reactivar"}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </GlassCard>
        </div>
    );
}
