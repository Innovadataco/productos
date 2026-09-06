"use client";

import { useEffect } from "react";
import { GUARDIAS_ACCESO } from "@/lib/routing/guardias";
import { urlSinMarcaRebote } from "@/lib/routing/marca-rebote-url";

/**
 * SPEC-572 (loop-cap · residual señalado por Datos) — tras una carga SANA (estado válido, esta
 * página se renderizó en vez de ser rebotada), saca la marca `_rv` de la barra de direcciones.
 *
 * Por qué: si la marca queda pegada y la URL se guarda en favoritos o se comparte, más tarde puede
 * caer en un hueco de estado y disparar el logout de corte del loop-cap SIN atacante. `replaceState`
 * no navega, no dispara un request, y no toca el camino de seguridad (la marca sigue inerte con
 * estado sano). Borra SOLO `_rv`, preservando el resto de la query (condición de Datos).
 *
 * Límite conocido y aceptado (CEO): limpia la barra ACTUAL, no un favorito ya guardado. El cierre
 * total sería server-side (302 único a la URL limpia), pero eso pone un redirect en cada carga
 * marcada-pero-válida — demasiado peaje para una molestia auto-recuperable. `replaceState` es la
 * proporción correcta; el residual queda dentro del sobre aceptado.
 */
export function LimpiarMarcaRebote() {
    useEffect(() => {
        try {
            const limpio = urlSinMarcaRebote(window.location.href, GUARDIAS_ACCESO.marcaRebote);
            if (limpio !== null) {
                window.history.replaceState(window.history.state, "", limpio);
            }
        } catch {
            // Entornos sin `window.history`/`URL` (SSR, prerender): no-op. La marca es inerte con
            // estado sano, así que no limpiarla no rompe nada — solo deja el residual aceptado.
        }
    }, []);
    return null;
}
