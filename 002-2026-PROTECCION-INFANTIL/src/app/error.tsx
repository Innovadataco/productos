"use client";

/**
 * SPEC-548 (I-337) · Frontera de error de la app (caso b del aviso de versión).
 *
 * Antes NO había frontera: si un chunk fallaba tras un despliegue, la pantalla
 * quedaba a medias y sin salida (Calidad vio desaparecer hasta el pie). Este
 * `error.tsx` se pinta EN EL LUGAR del contenido —dentro del layout raíz, así
 * que el header y el pie sobreviven— y ofrece la salida: recargar.
 *
 * Si el error es de chunk (código viejo tras subida) muestra la copia del
 * despliegue; cualquier otro fallo de render cae en el aviso genérico calmo (con
 * `reset()` para reintentar sin recargar). Nunca modal, nunca rojo.
 */
import { useEffect } from "react";
import { esErrorDeChunk } from "@/lib/error-de-chunk";
import { AvisoRecargar } from "@/components/modules/version/AvisoRecargar";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Deja rastro para el monitor; no altera lo que ve el padre.
        console.error(error);
    }, [error]);

    if (esErrorDeChunk(error)) return <AvisoRecargar variante="chunk" />;
    return <AvisoRecargar variante="generico" onReintentar={reset} />;
}
