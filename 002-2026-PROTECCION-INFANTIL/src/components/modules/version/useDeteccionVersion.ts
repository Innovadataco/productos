"use client";

/**
 * SPEC-548 (I-337) · Hook que vigila si el servidor cambió de versión bajo los
 * pies de esta sesión (cruzó un despliegue).
 *
 * - «Sello cargado»: el primer sello que responde el servidor que sirvió a esta
 *   sesión. Es la línea base; se fija una sola vez.
 * - «Sello actual»: se vuelve a pedir en cada NAVEGACIÓN (cambio de ruta) y con
 *   un intervalo de respaldo. Si difiere del cargado → hay versión nueva.
 *
 * La decisión vive en `hayVersionNueva` (pieza pura, con candado propio). Acá
 * solo está el cableado de red y de ciclo de vida.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { hayVersionNueva, type SelloVersion } from "@/lib/version-cliente";

const INTERVALO_RESPALDO_MS = 5 * 60 * 1000;

async function traerSello(): Promise<SelloVersion | null> {
    try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return null;
        const j = (await r.json()) as Partial<SelloVersion>;
        if (typeof j.version !== "string") return null;
        return { version: j.version, sha: typeof j.sha === "string" ? j.sha : null };
    } catch {
        return null; // la red falla → no afirmamos nada
    }
}

export function useDeteccionVersion(): boolean {
    const cargada = useRef<SelloVersion | null>(null);
    const [hayNueva, setHayNueva] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        let vivo = true;

        async function revisar() {
            const actual = await traerSello();
            if (!vivo || !actual) return;
            if (!cargada.current) {
                cargada.current = actual; // primera respuesta = línea base
                return;
            }
            if (hayVersionNueva(cargada.current, actual)) setHayNueva(true);
        }

        revisar();
        const id = setInterval(revisar, INTERVALO_RESPALDO_MS);
        return () => {
            vivo = false;
            clearInterval(id);
        };
    }, [pathname]);

    return hayNueva;
}
