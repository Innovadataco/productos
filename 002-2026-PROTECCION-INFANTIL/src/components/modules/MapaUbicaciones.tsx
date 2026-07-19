"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJSON as LeafletGeoJSON, PathOptions } from "leaflet";

export type PuntoMapa = {
    lat: number;
    lng: number;
    label: string;
    total: number;
};

export type PaisMapa = {
    pais: string;
    total: number;
};

const DEFAULT_CENTER: [number, number] = [4.5, -74];
const COLORES = {
    alto: "#ef4444", // rojo
    medio: "#f97316", // naranja
    bajo: "#22c55e", // verde
    sinDatos: "#e2e8f0", // gris claro
};

function colorPorCantidad(total: number, max: number) {
    if (max <= 0) return COLORES.sinDatos;
    if (total === max || total >= max * 0.75) return COLORES.alto;
    if (total >= max * 0.25) return COLORES.medio;
    return COLORES.bajo;
}

function normalizarNombre(nombre: string) {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function MapaUbicaciones({ puntos, paises }: { puntos: PuntoMapa[]; paises?: PaisMapa[] }) {
    const validos = puntos.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const [geoData, setGeoData] = useState<GeoJSON.GeoJsonObject | null>(null);
    const [geoError, setGeoError] = useState(false);

    useEffect(() => {
        fetch("/geo/world-countries.json")
            .then((r) => {
                if (!r.ok) throw new Error("Error cargando GeoJSON");
                return r.json();
            })
            .then((data) => setGeoData(data))
            .catch(() => setGeoError(true));
    }, []);

    const maxPais = useMemo(() => {
        if (!paises || paises.length === 0) return 0;
        return Math.max(...paises.map((p) => p.total));
    }, [paises]);

    const paisesMap = useMemo(() => {
        const map = new Map<string, PaisMapa>();
        if (!paises) return map;
        for (const p of paises) {
            map.set(normalizarNombre(p.pais), p);
        }
        return map;
    }, [paises]);

    const center: [number, number] =
        validos.length === 1
            ? [validos[0].lat, validos[0].lng]
            : validos.length > 0
              ? [
                    validos.reduce((sum, p) => sum + p.lat, 0) / validos.length,
                    validos.reduce((sum, p) => sum + p.lng, 0) / validos.length,
                ]
              : DEFAULT_CENTER;

    const maxTotal = Math.max(1, ...validos.map((p) => p.total));

    const paisStyle = (feature?: GeoJSON.Feature): PathOptions => {
        const nombre = normalizarNombre(String(feature?.properties?.name || ""));
        const pais = paisesMap.get(nombre);
        const color = pais && maxPais > 0 ? colorPorCantidad(pais.total, maxPais) : COLORES.sinDatos;
        return {
            fillColor: color,
            fillOpacity: 0.5,
            color: "#64748b",
            weight: 1,
        };
    };

    const onEachFeature = (feature: GeoJSON.Feature, layer: LeafletGeoJSON) => {
        const nombre = String(feature.properties?.name || "");
        const pais = paisesMap.get(normalizarNombre(nombre));
        const popupContent = pais
            ? `<span class="text-sm font-medium">${nombre}</span><br/><span class="text-xs text-muted">${pais.total} reporte(s)</span>`
            : `<span class="text-sm font-medium">${nombre}</span>`;
        layer.bindPopup(popupContent);
    };

    return (
        <div className="relative">
            <MapContainer
                center={center}
                zoom={validos.length === 1 ? 10 : 5}
                scrollWheelZoom={false}
                className="h-80 w-full rounded-2xl"
                style={{
                    zIndex: 0,
                    background: "#e0f2fe",
                }}
            >
                {geoData && <GeoJSON data={geoData} style={paisStyle} onEachFeature={onEachFeature} />}
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
            {geoError && (
                <div className="absolute bottom-2 left-2 z-[1000] rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    No se pudieron cargar los contornos geográficos.
                </div>
            )}
        </div>
    );
}
