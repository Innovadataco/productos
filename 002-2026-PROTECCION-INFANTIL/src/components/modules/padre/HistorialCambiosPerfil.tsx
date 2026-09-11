"use client";

/**
 * SPEC-590 · «Historial de cambios» de «Mi perfil».
 * SPEC-628 · en ESPAÑOL natural y SIN identificadores internos. Cada entrada es
 * una frase («El 8 de septiembre cambiaste tu correo a …»), nunca «campo ciudad:
 * cambio de vacío a 05001». Prender/apagar un aviso también deja rastro. El
 * endpoint ya resolvió códigos a nombres; acá solo se redacta la frase.
 */
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

type ItemDato = {
    id: string;
    tipo: "dato";
    campo: string;
    etiqueta: string;
    anterior: string | null;
    nuevo: string | null;
    creadoEn: string;
};
type ItemAviso = {
    id: string;
    tipo: "aviso";
    etiqueta: string;
    estado: "activado" | "desactivado";
    creadoEn: string;
};
type Item = ItemDato | ItemAviso;

const fmtFechaLarga = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
});

/** «El 8 de septiembre» — sin identificadores, en la voz «tú» del padre. */
function fraseDato(c: ItemDato): string {
    const dia = `El ${fmtFechaLarga.format(new Date(c.creadoEn))}`;
    const campo = c.etiqueta.toLocaleLowerCase("es-CO");
    if (c.nuevo === null) return `${dia} borraste tu ${campo}.`;
    return `${dia} cambiaste tu ${campo} a ${c.nuevo}.`;
}

function fraseAvisoItem(c: ItemAviso): string {
    const dia = `El ${fmtFechaLarga.format(new Date(c.creadoEn))}`;
    const verbo = c.estado === "activado" ? "activaste" : "desactivaste";
    return `${dia} ${verbo} el aviso «${c.etiqueta}».`;
}

export function HistorialCambiosPerfil() {
    const [items, setItems] = useState<Item[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/padre/perfil/auditoria?pageSize=50", { credentials: "include" });
                if (!res.ok) throw new Error("no se pudo cargar");
                const data = (await res.json()) as { items: Item[] };
                setItems(data.items);
            } catch {
                setError("No pudimos cargar tu historial de cambios.");
            }
        })();
    }, []);

    return (
        <GlassCard className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-body">Historial de cambios</h2>
            <p className="mt-1 text-sm text-muted">Lo que has cambiado en tu perfil, en orden.</p>
            {error && <p className="mt-3 text-sm text-estado-rubi">{error}</p>}
            {!error && items === null && <p className="mt-3 text-sm text-muted">Cargando…</p>}
            {items !== null && items.length === 0 && (
                <p className="mt-3 text-sm text-muted">Todavía no has cambiado nada.</p>
            )}
            {items !== null && items.length > 0 && (
                <ul className="mt-4 space-y-3">
                    {items.map((c) => (
                        <li key={c.id} className="border-t border-tinta/10 pt-3 text-sm dark:border-papel/10">
                            <p className="text-body">{c.tipo === "aviso" ? fraseAvisoItem(c) : fraseDato(c)}</p>
                            <span className="mt-0.5 block text-xs text-muted">{formatoFechaHoraBogota(c.creadoEn)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </GlassCard>
    );
}
