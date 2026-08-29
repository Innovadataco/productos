"use client";

import { useState } from "react";
import { WidgetSeccion } from "./WidgetSeccion";
import type { ItemVencimientoDto } from "@/lib/pagos/analitica.service";

/**
 * SPEC-218 (002-PI-118) · Widget 1 (US-001/AS-001): vencimientos de esta
 * semana, ordenados por fecha fin, con acción "Copiar contactos" para llamar
 * a los clientes antes del corte.
 */
export function WidgetVencimientosSemana({ data }: { data: { total: number; items: ItemVencimientoDto[] } }) {
    const [copiado, setCopiado] = useState(false);
    const contactos = data.items.map((item) => item.email).filter((email): email is string => Boolean(email));

    async function copiarContactos() {
        try {
            await navigator.clipboard.writeText(contactos.join("\n"));
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            console.error("[Pagos/Analitica] Copiar contactos: portapapeles no disponible");
        }
    }

    return (
        <WidgetSeccion titulo="Vencimientos esta semana" total={data.total}>
            {data.items.length === 0 ? (
                <p className="text-sm text-muted">No hay suscripciones por vencer en los próximos 7 días.</p>
            ) : (
                <>
                    <ul className="space-y-3">
                        {data.items.map((item) => (
                            <li key={item.suscripcionId} className="flex items-start justify-between gap-3 text-sm">
                                <div>
                                    <p className="font-medium text-body">{item.nombre}</p>
                                    <p className="text-xs text-muted">{item.rol === "COLEGIO" ? "Colegio" : "Padre"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-body">{item.fechaFin}</p>
                                    <p className="text-xs text-estado-ambar dark:text-ambar">
                                        {item.diasRestantes === 0 ? "vence hoy" : `${item.diasRestantes} días`}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {contactos.length > 0 && (
                        <button
                            type="button"
                            onClick={copiarContactos}
                            className="mt-4 w-full rounded-lg bg-ambar/10 px-3 py-2 text-sm font-medium text-estado-ambar transition hover:bg-ambar/20 dark:bg-ambar/20 dark:text-ambar dark:hover:bg-ambar/30"
                        >
                            {copiado ? "Contactos copiados" : `Copiar contactos (${contactos.length})`}
                        </button>
                    )}
                </>
            )}
        </WidgetSeccion>
    );
}
