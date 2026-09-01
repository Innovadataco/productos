"use client";

import { MapContainer, CircleMarker, Tooltip, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa interactivo de reportes por ciudad (mockup v3 pantalla 3 + nivel dios).
 * CLIENT-ONLY: react-leaflet toca window — se carga vía MapaDinamico con
 * dynamic import ssr:false. Un CircleMarker por ciudad del ResultSet:
 * radio proporcional a √total (percepción de área honesta) y color que
 * interpola pino→ambar según volumen relativo. Tooltip con nombre + total
 * exacto; nunca se pinta una ciudad sin coordenadas (la capa de datos ya
 * las filtró — candado 9).
 */
export interface CiudadMapa {
    nombre: string;
    total: number;
    lat: number;
    lng: number;
}

/** Centro geográfico de Colombia (constante de encuadre, no un dato). */
const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973];
const ZOOM_COLOMBIA = 6;

/* Interpolación pino→ambar con los valores del tema oscuro (globals.css
   .dark: --pino-rgb 79 224 184, --ambar-rgb 240 180 85). */
function colorVolumen(t: number): string {
    const r = Math.round(79 + (240 - 79) * t);
    const g = Math.round(224 + (180 - 224) * t);
    const b = Math.round(184 + (85 - 184) * t);
    return `rgb(${r} ${g} ${b})`;
}

export default function MapaReportes({ ciudades }: { ciudades: CiudadMapa[] }) {
    const max = Math.max(...ciudades.map((c) => c.total), 1);
    return (
        <MapContainer
            center={CENTRO_COLOMBIA}
            zoom={ZOOM_COLOMBIA}
            minZoom={4}
            scrollWheelZoom={false}
            className="h-[420px] w-full rounded-xl"
            style={{ zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {ciudades.map((c) => {
                const ratio = c.total / max;
                const color = colorVolumen(ratio);
                return (
                    <CircleMarker
                        key={c.nombre}
                        center={[c.lat, c.lng]}
                        radius={6 + Math.sqrt(ratio) * 20}
                        pathOptions={{
                            color,
                            weight: 2,
                            fillColor: color,
                            fillOpacity: 0.35,
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                            <div className="text-[13px] font-semibold">{c.nombre}</div>
                            <div className="cifra text-[12px]">
                                {c.total.toLocaleString("es-CO")}{" "}
                                {c.total === 1 ? "reporte" : "reportes"}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
}
