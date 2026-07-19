"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { MapContainer, Popup, GeoJSON, Marker, Tooltip } from "react-leaflet";
import * as L from "leaflet";
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

const LATAM_CENTER: [number, number] = [4.5, -74];
const LATAM_ZOOM = 3;

const COLORES = {
    alto: "#ef4444", // rojo
    medio: "#f97316", // naranja
    bajo: "#22c55e", // verde
    sinDatos: "#e2e8f0", // gris claro
    borde: "#94a3b8",
    bordeHover: "#475569",
};

const NOMBRE_PAIS_ES_EN: Record<string, string> = {
    "estados unidos": "United States of America",
    mexico: "Mexico",
    espana: "Spain",
    brasil: "Brazil",
    argentina: "Argentina",
    colombia: "Colombia",
    peru: "Peru",
    chile: "Chile",
    venezuela: "Venezuela",
    ecuador: "Ecuador",
    bolivia: "Bolivia",
    paraguay: "Paraguay",
    uruguay: "Uruguay",
    "costa rica": "Costa Rica",
    panama: "Panama",
    guatemala: "Guatemala",
    honduras: "Honduras",
    "el salvador": "El Salvador",
    nicaragua: "Nicaragua",
    cuba: "Cuba",
    "republica dominicana": "Dominican Republic",
    "puerto rico": "Puerto Rico",
    haiti: "Haiti",
    jamaica: "Jamaica",
    canada: "Canada",
    "reino unido": "United Kingdom",
    francia: "France",
    alemania: "Germany",
    italia: "Italy",
    "paises bajos": "Netherlands",
    belgica: "Belgium",
    suiza: "Switzerland",
    austria: "Austria",
    portugal: "Portugal",
    suecia: "Sweden",
    noruega: "Norway",
    dinamarca: "Denmark",
    finlandia: "Finland",
    polonia: "Poland",
    "republica checa": "Czech Republic",
    hungria: "Hungary",
    rumania: "Romania",
    bulgaria: "Bulgaria",
    grecia: "Greece",
    turquia: "Turkey",
    ucrania: "Ukraine",
    rusia: "Russia",
    china: "China",
    japon: "Japan",
    "corea del sur": "South Korea",
    india: "India",
    indonesia: "Indonesia",
    filipinas: "Philippines",
    tailandia: "Thailand",
    vietnam: "Vietnam",
    malasia: "Malaysia",
    singapur: "Singapore",
    australia: "Australia",
    "nueva zelanda": "New Zealand",
    sudafrica: "South Africa",
    nigeria: "Nigeria",
    egipto: "Egypt",
    marruecos: "Morocco",
    argelia: "Algeria",
    tunisia: "Tunisia",
    libia: "Libya",
    "arabia saudita": "Saudi Arabia",
    "emiratos arabes unidos": "United Arab Emirates",
    israel: "Israel",
    "palestina estado de": "State of Palestine",
    qatar: "Qatar",
    kuwait: "Kuwait",
    irak: "Iraq",
    iran: "Iran",
    pakistan: "Pakistan",
    afganistan: "Afghanistan",
    bangladesh: "Bangladesh",
    nepal: "Nepal",
    myanmar: "Myanmar",
    "sri lanka": "Sri Lanka",
    camboya: "Cambodia",
    laos: "Laos",
    mongolia: "Mongolia",
    "corea del norte": "North Korea",
    kazajistan: "Kazakhstan",
    uzbekistan: "Uzbekistan",
    turkmenistan: "Turkmenistan",
    kirguistan: "Kyrgyzstan",
    tayikistan: "Tajikistan",
};

function normalizarNombre(nombre: string) {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function colorPorCantidad(total: number, max: number) {
    if (max <= 0) return COLORES.sinDatos;
    if (total === max || total >= max * 0.75) return COLORES.alto;
    if (total >= max * 0.25) return COLORES.medio;
    return COLORES.bajo;
}

function geoJsonNameFor(pais: string): string {
    const norm = normalizarNombre(pais);
    return NOMBRE_PAIS_ES_EN[norm] || norm;
}

function cityIcon(total: number, color: string) {
    const size = Math.min(14 + total * 2, 44);
    const half = size / 2;
    return L.divIcon({
        className: "city-marker",
        html: `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:2px solid white;
            border-radius:9999px;
            box-shadow:0 2px 4px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:${Math.max(9, size / 2.5)}px;font-weight:700;
        ">${total}</div>`,
        iconSize: [size, size],
        iconAnchor: [half, half],
    });
}

export function MapaUbicaciones({
    puntos,
    paises,
    center,
    zoom,
}: {
    puntos: PuntoMapa[];
    paises?: PaisMapa[];
    center?: [number, number];
    zoom?: number;
}) {
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
            const enName = geoJsonNameFor(p.pais);
            map.set(normalizarNombre(enName), p);
            map.set(normalizarNombre(p.pais), p);
        }
        return map;
    }, [paises]);

    const computedCenter: [number, number] = useMemo(() => {
        if (center) return center;
        if (validos.length === 1) return [validos[0].lat, validos[0].lng];
        if (validos.length > 0)
            return [
                validos.reduce((sum, p) => sum + p.lat, 0) / validos.length,
                validos.reduce((sum, p) => sum + p.lng, 0) / validos.length,
            ];
        return LATAM_CENTER;
    }, [center, validos]);

    const computedZoom = zoom ?? (validos.length === 1 ? 10 : validos.length > 0 ? 5 : LATAM_ZOOM);

    const maxTotal = Math.max(1, ...validos.map((p) => p.total));

    const paisStyle = useCallback(
        (feature?: GeoJSON.Feature): PathOptions => {
            const nombre = normalizarNombre(String(feature?.properties?.name || ""));
            const pais = paisesMap.get(nombre);
            const color = pais && maxPais > 0 ? colorPorCantidad(pais.total, maxPais) : COLORES.sinDatos;
            return {
                fillColor: color,
                fillOpacity: 0.55,
                color: COLORES.borde,
                weight: 1,
            };
        },
        [paisesMap, maxPais]
    );

    const onEachFeature = useCallback(
        (feature: GeoJSON.Feature, layer: LeafletGeoJSON) => {
            const nombre = String(feature.properties?.name || "");
            const norm = normalizarNombre(nombre);
            const pais = paisesMap.get(norm);

            const popupContent = pais
                ? `<div class="font-sans"><div class="text-sm font-semibold">${nombre}</div><div class="text-xs text-slate-600">${pais.total} reporte(s)</div></div>`
                : `<div class="font-sans"><div class="text-sm font-semibold">${nombre}</div></div>`;
            layer.bindPopup(popupContent);

            layer.on("mouseover", () => {
                layer.setStyle({ fillOpacity: 0.75, color: COLORES.bordeHover, weight: 2 });
            });
            layer.on("mouseout", () => {
                const color = pais && maxPais > 0 ? colorPorCantidad(pais.total, maxPais) : COLORES.sinDatos;
                layer.setStyle({ fillOpacity: 0.55, color: COLORES.borde, weight: 1, fillColor: color });
            });
        },
        [paisesMap, maxPais]
    );

    return (
        <div className="relative">
            <MapContainer
                center={computedCenter}
                zoom={computedZoom}
                minZoom={2}
                scrollWheelZoom={false}
                className="h-96 w-full rounded-2xl"
                style={{ zIndex: 0, background: "#e0f2fe" }}
            >
                {geoData && <GeoJSON data={geoData} style={paisStyle} onEachFeature={onEachFeature} />}
                {validos.map((p, idx) => {
                    const color = colorPorCantidad(p.total, maxTotal);
                    const [ciudad, pais] = p.label.split(",").map((s) => s.trim());
                    return (
                        <Marker key={idx} position={[p.lat, p.lng]} icon={cityIcon(p.total, color)}>
                            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                <div className="text-xs font-semibold">{ciudad}</div>
                                <div className="text-[10px] text-slate-600">{pais}</div>
                                <div className="text-[10px] font-bold">{p.total} reporte(s)</div>
                            </Tooltip>
                            <Popup>
                                <div className="font-sans">
                                    <div className="text-sm font-semibold">{p.label}</div>
                                    <div className="text-xs text-slate-600">{p.total} reporte(s)</div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {paises && paises.length > 0 && (
                <div className="absolute bottom-3 right-3 z-[1000] rounded-lg border border-slate-200 bg-white/90 p-3 text-xs shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                    <p className="mb-2 font-semibold text-body">Reportes por país</p>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORES.alto }} />
                            <span className="text-muted">Alto ({maxPais > 0 ? `≥ ${Math.ceil(maxPais * 0.75)}` : "—"})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORES.medio }} />
                            <span className="text-muted">Medio</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORES.bajo }} />
                            <span className="text-muted">Bajo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORES.sinDatos }} />
                            <span className="text-muted">Sin datos</span>
                        </div>
                    </div>
                </div>
            )}

            {geoError && (
                <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    No se pudieron cargar los contornos geográficos.
                </div>
            )}
        </div>
    );
}
