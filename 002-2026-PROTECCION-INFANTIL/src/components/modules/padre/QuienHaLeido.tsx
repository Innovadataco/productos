"use client";

import { useEffect, useState } from "react";
import { fechaHoraSinMinutos } from "@/lib/format/fecha";

interface AccesoItem {
    id: string;
    cuando: string | null;
    quien: string | null;
    rol: string | null;
    eventosLeidos: number;
}

/**
 * SPEC-610 (I-372 · D-129) · «Quién ha leído este expediente».
 *
 * Lista los pases que alguien canjeó para abrir ESTE expediente: quién y cuándo.
 * Solo metadatos (nunca contenido). Es la contraparte de transparencia del pase:
 * el padre ve exactamente quién abrió su caso, además del correo que recibe en
 * cada canje.
 */
export function QuienHaLeido({ expedienteId }: { expedienteId: string }) {
    const [items, setItems] = useState<AccesoItem[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let vivo = true;
        void (async () => {
            try {
                const res = await fetch(`/api/padre/expedientes/${expedienteId}/accesos`, { credentials: "include" });
                if (!res.ok) throw new Error("No pudimos cargar quién ha abierto este expediente.");
                const data = (await res.json()) as { items: AccesoItem[] };
                if (vivo) setItems(data.items);
            } catch (err) {
                if (vivo) setError(err instanceof Error ? err.message : "No pudimos cargar los accesos.");
            }
        })();
        return () => {
            vivo = false;
        };
    }, [expedienteId]);

    return (
        <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">
                Quién ha abierto este expediente
            </h3>
            {error ? (
                <p className="text-xs text-muted">{error}</p>
            ) : items === null ? (
                <p className="text-xs text-muted">Cargando…</p>
            ) : items.length === 0 ? (
                <p className="text-xs text-muted">Todavía nadie ha usado un pase para abrir este expediente.</p>
            ) : (
                <ul className="space-y-1.5">
                    {items.map((acceso) => (
                        <li key={acceso.id} className="text-xs text-body">
                            <span className="font-semibold">{acceso.quien ?? "Un profesional"}</span>
                            {acceso.rol === "PARENT" ? " (tú)" : ""}
                            {acceso.cuando ? ` · ${fechaHoraSinMinutos(acceso.cuando)}` : ""}
                            <span className="text-subtle">
                                {" "}
                                · leyó {acceso.eventosLeidos}{" "}
                                {acceso.eventosLeidos === 1 ? "anotación" : "anotaciones"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
