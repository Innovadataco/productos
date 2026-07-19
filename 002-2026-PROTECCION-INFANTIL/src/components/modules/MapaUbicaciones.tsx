"use client";

import { MapContainer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PuntoMapa = {
    lat: number;
    lng: number;
    label: string;
    total: number;
};

const DEFAULT_CENTER: [number, number] = [4.5, -74];
const COLORES = {
    alto: "#ef4444", // rojo
    medio: "#f97316", // naranja
    bajo: "#22c55e", // verde
};

function colorPorCantidad(total: number, max: number) {
    if (max <= 1 || total === max) return COLORES.alto;
    if (total >= max * 0.5) return COLORES.medio;
    return COLORES.bajo;
}

export function MapaUbicaciones({ puntos }: { puntos: PuntoMapa[] }) {
    const validos = puntos.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");

    if (validos.length === 0) {
        return <p className="text-sm text-muted">Sin coordenadas geográficas disponibles.</p>;
    }

    const center: [number, number] =
        validos.length === 1
            ? [validos[0].lat, validos[0].lng]
            : [
                  validos.reduce((sum, p) => sum + p.lat, 0) / validos.length,
                  validos.reduce((sum, p) => sum + p.lng, 0) / validos.length,
              ];

    const maxTotal = Math.max(1, ...validos.map((p) => p.total));

    return (
        <MapContainer
            center={center}
            zoom={validos.length === 1 ? 10 : 5}
            scrollWheelZoom={false}
            className="h-80 w-full rounded-2xl"
            style={{
                zIndex: 0,
                background: "#f8fafc",
                backgroundImage:
                    "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
                backgroundSize: "24px 24px",
            }}
        >
            {validos.map((p, idx) => {
                const color = colorPorCantidad(p.total, maxTotal);
                const radius = 8 + Math.min(p.total * 3, 22);
                return (
                    <CircleMarker
                        key={idx}
                        center={[p.lat, p.lng]}
                        radius={radius}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.65,
                            weight: 2,
                        }}
                    >
                        <Popup>
                            <span className="text-sm font-medium">{p.label}</span>
                            <br />
                            <span className="text-xs text-muted">{p.total} reporte(s)</span>
                        </Popup>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
}
