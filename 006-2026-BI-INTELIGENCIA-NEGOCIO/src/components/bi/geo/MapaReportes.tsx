"use client";

import { Fragment, useEffect, useState } from "react";
import { MapContainer, CircleMarker, Tooltip, GeoJSON, Marker } from "react-leaflet";
import { divIcon, type PathOptions } from "leaflet";
import type { GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";

/**
 * Mapa de calor de reportes por ciudad (Pulso siguiente nivel · mockup v3
 * pantalla 3). CLIENT-ONLY: react-leaflet toca window — se carga vía
 * MapaDinamico con dynamic import ssr:false.
 *
 * Base del mapa: GeoJSON LOCAL de países (/geo/world-countries.json) — la
 * misma técnica del dashboard público de PI: SIN TileLayer ni tiles remotos,
 * así que jamás pide API key ni muestra marcas de agua (defecto visto con
 * las tiles de CARTO: "API KEY REQUIRED"). Los polígonos se pintan con los
 * tokens del tema oscuro; el calor vive en los CircleMarkers encima.
 *
 * Un CircleMarker por ciudad del ResultSet:
 * · COLOR por CUARTIL de intensidad (constante de presentación, no un dato):
 *   se ordenan las intensidades recibidas y se toman Q1/Q2/Q3; cada ciudad
 *   cae en una de 4 bandas pino→cielo→ambar→rubí, la misma escala que
 *   muestra la leyenda `.leyenda-calor` bajo el mapa.
 * · RADIO proporcional a √total (percepción de área honesta).
 * · NÚMERO ADENTRO (pedido del dueño, como el mapa público de PI): un Marker
 *   con divIcon `.mapa-num` centrado sobre el círculo muestra el total en
 *   cifra tabular. Es un icono HTML (no un Tooltip permanente) porque Leaflet
 *   admite UN solo tooltip por capa y el de hover ya lleva el detalle; el
 *   divIcon no captura eventos (interactive:false) así que el hover sigue
 *   llegando al círculo de abajo.
 * Tooltip con nombre + total exacto + banda de intensidad; nunca se pinta
 * una ciudad sin coordenadas (la capa de datos ya las filtró — candado 9).
 */
export interface CiudadCalor {
    nombre: string;
    lat: number;
    lng: number;
    total: number;
    /** Índice de intensidad calculado por la capa de datos (GeoData). */
    intensidad: number;
}

/** Centro geográfico de Colombia (constante de encuadre, no un dato). */
const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973];
const ZOOM_COLOMBIA = 6;

/* Bandas de calor con los valores del tema oscuro (globals.css .dark:
   --pino-rgb 79 224 184, --cielo-rgb 111 182 245, --ambar-rgb 240 180 85,
   --rubi-rgb 245 128 155). Leaflet necesita colores concretos, no vars CSS. */
const COLORES_CALOR = [
    "rgb(79 224 184)",
    "rgb(111 182 245)",
    "rgb(240 180 85)",
    "rgb(245 128 155)",
] as const;
const ETIQUETAS_CALOR = ["baja", "media", "alta", "muy alta"] as const;

/** Cuartil p de una lista ordenada (índice entero, sin interpolar). */
function cuartil(ordenados: number[], p: number): number {
    return ordenados[Math.floor(p * (ordenados.length - 1))];
}

/* Estilo de los polígonos de país (tema oscuro; Leaflet necesita colores
   concretos, no vars CSS): relleno apenas más claro que el fondo, borde
   sutil — la atención es de los círculos de calor, no del mapa base. */
const ESTILO_PAIS: PathOptions = {
    color: "rgb(242 247 244 / 0.28)",
    weight: 1,
    fillColor: "rgb(242 247 244 / 0.07)",
    fillOpacity: 1,
};

export default function MapaReportes({ ciudades }: { ciudades: CiudadCalor[] }) {
    // La tarjeta ya decide el vacío honesto; guarda defensiva si llega [].
    const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
    useEffect(() => {
        fetch("/geo/world-countries.json")
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => setGeoData(j as GeoJsonObject))
            .catch(() => setGeoData(null));
    }, []);

    if (ciudades.length === 0) return null;

    const maxTotal = Math.max(...ciudades.map((c) => c.total), 1);
    const intensidades = ciudades.map((c) => c.intensidad).sort((a, b) => a - b);
    const q1 = cuartil(intensidades, 0.25);
    const q2 = cuartil(intensidades, 0.5);
    const q3 = cuartil(intensidades, 0.75);
    const bandaDe = (intensidad: number): 0 | 1 | 2 | 3 =>
        intensidad <= q1 ? 0 : intensidad <= q2 ? 1 : intensidad <= q3 ? 2 : 3;

    return (
        <MapContainer
            center={CENTRO_COLOMBIA}
            zoom={ZOOM_COLOMBIA}
            minZoom={4}
            scrollWheelZoom={false}
            className="h-[420px] w-full rounded-xl"
            style={{ zIndex: 0, background: "rgb(6 11 10)" }}
        >
            {geoData && <GeoJSON data={geoData} style={ESTILO_PAIS} />}
            {ciudades.map((c) => {
                const banda = bandaDe(c.intensidad);
                const color = COLORES_CALOR[banda];
                return (
                    <Fragment key={c.nombre}>
                        <CircleMarker
                            center={[c.lat, c.lng]}
                            radius={6 + Math.sqrt(c.total / maxTotal) * 20}
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
                                <div className="text-[11px]">
                                    Intensidad {ETIQUETAS_CALOR[banda]}
                                </div>
                            </Tooltip>
                        </CircleMarker>
                        {/* Total permanente dentro del círculo (mapa público de
                            PI): divIcon sin caja, el número flota centrado. */}
                        <Marker
                            position={[c.lat, c.lng]}
                            interactive={false}
                            keyboard={false}
                            icon={divIcon({
                                className: "mapa-num",
                                html: `<span class="mapa-num-cifra">${c.total.toLocaleString("es-CO")}</span>`,
                                iconSize: [56, 18],
                                iconAnchor: [28, 9],
                            })}
                        />
                    </Fragment>
                );
            })}
        </MapContainer>
    );
}
