"use client";

/**
 * SPEC-819 · Superficie de la Puerta de Soporte: cablea `PuertaSoporte` al endpoint real
 * (`POST /api/padre/soporte/peticiones`) y le pasa los hijos del padre (para el sujeto de habeas data).
 *
 * 🚧 SIN CABLEAR A PROPÓSITO (SPEC-819/824): este panel NO lo monta ninguna `page.tsx` todavía — la puerta
 * NO debe ser alcanzable por un padre antes de que exista la bandeja del operador que atienda lo que entra
 * (SPEC-824, precondición de despliegue; la puerta y la bandeja se despliegan en el MISMO deploy). Por eso
 * es huérfano DECLARADO en el allowlist (salida autoexigida → SPEC-824): cuando 824 monte la página y el
 * enlace, se lo quita del allowlist en el mismo PR.
 */
import { PuertaSoporte, type EnvioSoporte, type HijoOpcion } from "./PuertaSoporte";

export function SoportePanel({ hijos }: { hijos: HijoOpcion[] }) {
    async function onEnviar(envio: EnvioSoporte): Promise<{ numeroSeguimiento: string }> {
        const res = await fetch("/api/padre/soporte/peticiones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(envio),
        });
        if (!res.ok) {
            // El detalle del servidor no se filtra al padre: la puerta muestra un mensaje neutral.
            throw new Error("No se pudo registrar la petición");
        }
        const data: { numeroSeguimiento: string } = await res.json();
        return { numeroSeguimiento: data.numeroSeguimiento };
    }

    return <PuertaSoporte onEnviar={onEnviar} hijos={hijos} />;
}
