"use client";

/**
 * SPEC-590 (decisión CEO 06-09) — «Historial de cambios» de «Mi perfil».
 *
 * Lista qué campos cambiaron, con valor anterior → nuevo y fecha/hora en
 * formato de Bogotá. Datos del propio titular, nunca de terceros: el endpoint
 * acota por el usuario de la sesión.
 */
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

type ItemCambio = {
    id: string;
    campo: string;
    etiqueta: string;
    anterior: string | null;
    nuevo: string | null;
    creadoEn: string;
};

function Valor({ valor }: { valor: string | null }) {
    if (valor === null) return <span className="italic text-muted">vacío</span>;
    return <span className="break-all">{valor}</span>;
}

export function HistorialCambiosPerfil() {
    const [items, setItems] = useState<ItemCambio[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/padre/perfil/auditoria?pageSize=50", { credentials: "include" });
                if (!res.ok) throw new Error("no se pudo cargar");
                const data = (await res.json()) as { items: ItemCambio[] };
                setItems(data.items);
            } catch {
                setError("No pudimos cargar tu historial de cambios.");
            }
        })();
    }, []);

    return (
        <GlassCard className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-body">Historial de cambios</h2>
            <p className="mt-1 text-sm text-muted">
                Qué datos de tu perfil cambiaron, de qué valor a cuál y cuándo.
            </p>
            {error && <p className="mt-3 text-sm text-estado-rubi">{error}</p>}
            {!error && items === null && <p className="mt-3 text-sm text-muted">Cargando…</p>}
            {items !== null && items.length === 0 && (
                <p className="mt-3 text-sm text-muted">Todavía no hay cambios registrados.</p>
            )}
            {items !== null && items.length > 0 && (
                <ul className="mt-4 space-y-3">
                    {items.map((c) => (
                        <li key={c.id} className="border-t border-tinta/10 pt-3 text-sm dark:border-papel/10">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-body">{c.etiqueta}</span>
                                <span className="text-xs text-muted">{formatoFechaHoraBogota(c.creadoEn)}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                                <Valor valor={c.anterior} />
                                <span className="mx-1.5 text-body">→</span>
                                <Valor valor={c.nuevo} />
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </GlassCard>
    );
}
