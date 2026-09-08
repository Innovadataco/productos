"use client";

import { useEffect, useState } from "react";

interface ItemHistorial {
    id: string;
    creadoEn: string;
    campo: string;
    tipoActor: string;
    rol: string | null;
    usuario: { nombre: string | null; email: string; rol: string } | null;
}

interface Props {
    reporteId: string;
}

function etiquetaActor(item: ItemHistorial): string {
    if (item.tipoActor === "EXTERNO") {
        return item.usuario ? `Acceso externo (${item.usuario.nombre ?? item.usuario.email})` : "Acceso externo";
    }
    if (item.usuario) return item.usuario.nombre ?? item.usuario.email;
    return item.rol ?? "Plataforma";
}

/**
 * SPEC-584 (Fase 2) · «Historial de accesos al texto» en el detalle del reporte
 * (admin/operador/comité). Solo metadatos: fecha, quién y qué campo — nunca
 * contenido. Los padres no ven este historial (endpoint restringido).
 */
export function HistorialAccesosTexto({ reporteId }: Props) {
    const [items, setItems] = useState<ItemHistorial[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelado = false;
        fetch(`/api/admin/reportes/${encodeURIComponent(reporteId)}/accesos-texto`, { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) throw new Error("No se pudo cargar el historial de accesos");
                const data = (await res.json()) as { items?: unknown };
                if (!cancelado) setItems(Array.isArray(data.items) ? (data.items as ItemHistorial[]) : []);
            })
            .catch((err) => {
                if (!cancelado) setError(err instanceof Error ? err.message : "Error");
            });
        return () => {
            cancelado = true;
        };
    }, [reporteId]);

    return (
        <section className="rounded-2xl border border-tinta/10 p-4">
            <h3 className="text-sm font-semibold text-body">Historial de accesos al texto</h3>
            {error ? (
                <p className="mt-2 text-xs text-muted">{error}</p>
            ) : items === null ? (
                <p className="mt-2 text-xs text-muted">Cargando historial...</p>
            ) : items.length === 0 ? (
                <p className="mt-2 text-xs text-muted">Aún no hay accesos registrados al texto de este reporte.</p>
            ) : (
                <ul className="mt-2 space-y-1.5">
                    {items.map((item) => (
                        <li key={item.id} className="text-xs text-muted">
                            <span className="font-medium text-body">{etiquetaActor(item)}</span>
                            {" · "}
                            {item.campo === "textoOriginal" ? "texto original" : "texto"}
                            {" · "}
                            {new Date(item.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
