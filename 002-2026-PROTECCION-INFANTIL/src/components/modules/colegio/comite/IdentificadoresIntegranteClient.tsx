"use client";

/**
 * SPEC-380 (PR B · C4/D-100) — identificadores del integrante del comité. Cada identificador ACTIVO dispara
 * alerta al COLEGIO (nunca a la persona) si se reporta el mismo valor.
 *
 * SPEC-932 · MIGRA ENTERO al patrón único (FORMA SPEC-931 §2.4): el form inline + `<ul>` «Vigilados» (sin
 * Plataforma ni Editar) se reemplaza por `IdentificadoresParaAlertas` — tabla + modal Valor+Plataforma + Editar +
 * Desactivar. Ruta y título («Identificadores del integrante») se conservan; también el éxito propio del comité.
 *
 * Voz: usted.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonLista } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/ErrorState";
import {
    IdentificadoresParaAlertas,
    type ApiIdentificadores,
    type IdentificadorAlerta,
} from "@/components/modules/colegio/identificadores/IdentificadoresParaAlertas";

interface Props {
    integranteId: string;
}

function json(url: string, method: "POST" | "PATCH", body: unknown): Promise<Response> {
    return fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export function IdentificadoresIntegranteClient({ integranteId }: Props) {
    const [items, setItems] = useState<IdentificadorAlerta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const base = `/api/colegio/comite/integrantes/${integranteId}/identificadores`;

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(base, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
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
    }, [base]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const api: ApiIdentificadores = {
        crear: (d) => json(base, "POST", { valor: d.valor, plataformaId: d.plataformaId }),
        editar: (i, d) => json(`${base}/${i.id}`, "PATCH", { valor: d.valor, plataformaId: d.plataformaId }),
        cambiarEstado: (i, estado) => json(`${base}/${i.id}`, "PATCH", { estado }),
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-sm text-muted">
                    <Link href="/dashboard/colegio/comite/integrantes" className="underline">
                        ← Volver a integrantes del comité
                    </Link>
                </p>
                <h1 className="mt-2 text-2xl font-bold text-body">Identificadores del integrante</h1>
            </header>

            {loading ? (
                <SkeletonLista />
            ) : error ? (
                <ErrorState title="No pudimos cargar los identificadores" description={error} onRetry={() => void cargar()} />
            ) : (
                <IdentificadoresParaAlertas
                    identificadores={items}
                    api={api}
                    onCambio={cargar}
                    mensajeAgregado="Identificador agregado. Desde ahora la cuenta se vigila."
                />
            )}
        </div>
    );
}
