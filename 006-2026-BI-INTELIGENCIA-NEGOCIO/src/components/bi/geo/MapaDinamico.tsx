"use client";

import dynamic from "next/dynamic";
import type { CiudadMapa } from "./MapaReportes";

/**
 * Puente SSR → mapa. react-leaflet es client-only: el dynamic import con
 * ssr:false DEBE vivir en un componente client (en un Server Component
 * Next lo rechaza). Mientras carga, un lienzo quieto con la altura final
 * evita el salto de layout.
 */
const MapaReportes = dynamic(() => import("./MapaReportes"), {
    ssr: false,
    loading: () => (
        <div className="grid h-[420px] w-full place-items-center rounded-xl bg-[rgb(var(--tinta-rgb)/0.04)]">
            <span className="text-[13px] text-muted">Cargando mapa…</span>
        </div>
    ),
});

export default function MapaDinamico({ ciudades }: { ciudades: CiudadMapa[] }) {
    return <MapaReportes ciudades={ciudades} />;
}
