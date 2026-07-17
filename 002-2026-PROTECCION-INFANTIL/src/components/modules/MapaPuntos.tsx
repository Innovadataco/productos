"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type PuntoMapa = {
    lat: number;
    lng: number;
    label: string;
    sub?: string;
    count: number;
    extra?: string;
};

function FitBounds({ puntos }: { puntos: { lat: number; lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
        if (puntos.length === 0) return;
        if (puntos.length === 1) {
            map.setView([puntos[0].lat, puntos[0].lng], 10, { animate: false });
            return;
        }
        const bounds = L.latLngBounds(puntos.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [48, 48], animate: false });
    }, [map, puntos]);
    return null;
}

function createIcon(total: number) {
    const size = total >= 50 ? 44 : total >= 20 ? 36 : total >= 10 ? 30 : 24;
    return L.divIcon({
        className: "custom-marker",
        html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:9999px;
            background:linear-gradient(135deg,#0ea5e9,#06b6d4);
            color:#fff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:700;
            font-size:12px;
            box-shadow:0 4px 14px rgba(6,182,212,0.45);
            border:2px solid #fff;
        ">${total}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}

export function MapaPuntos({ puntos, title = "Mapa", subtitle }: { puntos: PuntoMapa[]; title?: string; subtitle?: string }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const validos = useMemo(() => puntos.filter((p) => p.lat != null && p.lng != null), [puntos]);

    if (!mounted) {
        return (
            <div className="glass rounded-2xl p-5">
                <h3 className="mb-3 text-base font-semibold text-body">{title}</h3>
                <div className="h-[320px] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
        );
    }

    if (validos.length === 0) {
        return (
            <div className="glass rounded-2xl p-5">
                <h3 className="mb-1 text-base font-semibold text-body">{title}</h3>
                <p className="text-sm text-subtle">No hay coordenadas disponibles para mostrar en el mapa.</p>
            </div>
        );
    }

    const center: [number, number] = validos.length === 1 ? [validos[0].lat, validos[0].lng] : [4.0, -74.0];

    return (
        <div className="glass rounded-2xl p-5">
            <h3 className="mb-1 text-base font-semibold text-body">{title}</h3>
            {subtitle && <p className="mb-3 text-xs text-subtle">{subtitle}</p>}
            <div className="h-[320px] w-full overflow-hidden rounded-xl">
                <MapContainer center={center} zoom={validos.length === 1 ? 10 : 3} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitBounds puntos={validos.map((p) => ({ lat: p.lat, lng: p.lng }))} />
                    {validos.map((p, idx) => (
                        <Marker key={idx} position={[p.lat, p.lng]} icon={createIcon(p.count)}>
                            <Popup>
                                <div className="text-sm">
                                    <p className="font-semibold">{p.label}</p>
                                    {p.sub && <p className="text-xs text-slate-500">{p.sub}</p>}
                                    <p>{p.count} reporte(s)</p>
                                    {p.extra && <p className="text-xs text-slate-500">{p.extra}</p>}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
