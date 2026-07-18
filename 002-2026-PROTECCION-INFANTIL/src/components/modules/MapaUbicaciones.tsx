"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PuntoMapa = {
    lat: number;
    lng: number;
    label: string;
    total: number;
};

const DEFAULT_CENTER: [number, number] = [4.5, -74];

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

    return (
        <MapContainer
            center={center}
            zoom={validos.length === 1 ? 10 : 5}
            scrollWheelZoom={false}
            className="h-80 w-full rounded-2xl"
            style={{ zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {validos.map((p, idx) => {
                const radius = 8 + Math.min(p.total * 2, 20);
                return (
                    <CircleMarker
                        key={idx}
                        center={[p.lat, p.lng]}
                        radius={radius}
                        pathOptions={{
                            color: "#3b6bff",
                            fillColor: "#3b6bff",
                            fillOpacity: 0.6,
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
