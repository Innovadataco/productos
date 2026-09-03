"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, CircleMarker, Tooltip, GeoJSON, Marker } from "react-leaflet";
import { divIcon, type Layer, type PathOptions } from "leaflet";
import type { Feature as FeatureGeoJson, GeoJsonObject, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import { nombreGeoJsonPais, normalizarNombrePais } from "./nombres-pais";

/**
 * Mapa de calor de reportes por ciudad + choropleth de países (mockup v3
 * pantalla 3, mejoras del dueño comparando con el dashboard público de PI).
 * CLIENT-ONLY: react-leaflet toca window — se carga vía MapaDinamico con
 * dynamic import ssr:false.
 *
 * Base del mapa: GeoJSON LOCAL de países (/geo/world-countries.json) — la
 * misma técnica del dashboard público de PI: SIN TileLayer ni tiles remotos,
 * así que jamás pide API key ni muestra marcas de agua. Los polígonos se
 * pintan con los tokens del tema oscuro.
 *
 * Choropleth de países (pedido del dueño, como PI): cada feature del GeoJSON
 * se rellena según el total de reportes de ESE país (GeoData.porPais), en
 * 4 bandas pino→cielo→ambar→rubí cortadas por fracción del máximo; los
 * países sin reportes conservan el relleno base. El cruce de nombres usa
 * nombres-pais.ts (catálogo ES → feature EN del GeoJSON). Popup por país
 * con nombre + total (técnica onEachFeature de PI); los países sin datos
 * solo muestran su nombre.
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

/** País resuelto del ResultSet (GeoData.porPais) con su total de reportes. */
export type PaisCoropleta = { pais: string; total: number };

/** Feature del GeoJSON local: geometry + properties con el nombre oficial EN. */
type FeaturePais = FeatureGeoJson<Geometry, { name?: string }>;

/** Centro geográfico de Colombia (constante de encuadre, no un dato). */
const CENTRO_COLOMBIA: [number, number] = [4.5709, -74.2973];
const ZOOM_COLOMBIA = 6;

/* Bandas de calor con los valores del tema oscuro (globals.css .dark:
   --pino-rgb 79 224 184, --cielo-rgb 111 182 245, --ambar-rgb 240 180 85,
   --rubi-rgb 245 128 155). Leaflet necesita colores concretos, no vars CSS.
   Se usan para AMBAS codificaciones: relleno de país (fracción del máximo)
   y borde/relleno de ciudad (cuartil de intensidad). */
const COLORES_CALOR = [
    "rgb(79 224 184)",
    "rgb(111 182 245)",
    "rgb(240 180 85)",
    "rgb(245 128 155)",
] as const;
const ETIQUETAS_CALOR = ["baja", "media", "alta", "muy alta"] as const;

/**
 * Cortes de las 4 bandas del choropleth, como FRACCIÓN del total máximo
 * entre países (presentación, candado 10 — umbrales documentados, no datos):
 * pino < 0.25 · cielo < 0.5 · ambar < 0.75 · rubí ≥ 0.75. Un país con > 0
 * reportes siempre queda por encima del relleno base.
 */
const FRACCION_CIELO = 0.25;
const FRACCION_AMBAR = 0.5;
const FRACCION_RUBI = 0.75;
/** Opacidad del relleno del choropleth (el de ciudad es 0.35 — distinto sufijo). */
const OPACIDAD_RELLENO_PAIS = 0.28;

/** Banda del choropleth para un total dado el máximo (0 = pino … 3 = rubí). */
function bandaPais(total: number, max: number): 0 | 1 | 2 | 3 {
    if (max <= 0 || total <= 0) return 0;
    const fraccion = total / max;
    if (fraccion >= FRACCION_RUBI) return 3;
    if (fraccion >= FRACCION_AMBAR) return 2;
    if (fraccion >= FRACCION_CIELO) return 1;
    return 0;
}

/** Cuartil p de una lista ordenada (índice entero, sin interpolar). */
function cuartil(ordenados: number[], p: number): number {
    return ordenados[Math.floor(p * (ordenados.length - 1))];
}

/* Estilo base de los polígonos de país (tema oscuro; Leaflet necesita colores
   concretos, no vars CSS): relleno apenas más claro que el fondo, borde
   sutil — es también el estilo de los países SIN reportes. */
const ESTILO_PAIS: PathOptions = {
    color: "rgb(242 247 244 / 0.28)",
    weight: 1,
    fillColor: "rgb(242 247 244 / 0.07)",
    fillOpacity: 1,
};

export default function MapaReportes({
    ciudades,
    paises,
}: {
    ciudades: CiudadCalor[];
    paises: PaisCoropleta[];
}) {
    // La tarjeta ya decide el vacío honesto; guarda defensiva si llega [].
    const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
    useEffect(() => {
        fetch("/geo/world-countries.json")
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => setGeoData(j as GeoJsonObject))
            .catch(() => setGeoData(null));
    }, []);

    // Choropleth: cruce nombre ES (catálogo) / nombre EN (feature GeoJSON).
    // Se indexa por AMBAS claves normalizadas para que el lookup de la
    // feature (EN) y el del dato (ES) caigan en la misma entrada.
    const paisesMap = useMemo(() => {
        const map = new Map<string, PaisCoropleta>();
        for (const p of paises) {
            map.set(normalizarNombrePais(nombreGeoJsonPais(p.pais)), p);
            map.set(normalizarNombrePais(p.pais), p);
        }
        return map;
    }, [paises]);
    const maxPais = useMemo(
        () => paises.reduce((acc, p) => Math.max(acc, p.total), 0),
        [paises],
    );

    const paisStyle = useCallback(
        (feature?: FeaturePais): PathOptions => {
            const pais = paisesMap.get(
                normalizarNombrePais(String(feature?.properties?.name ?? "")),
            );
            if (!pais || maxPais <= 0) return ESTILO_PAIS;
            return {
                ...ESTILO_PAIS,
                fillColor: COLORES_CALOR[bandaPais(pais.total, maxPais)],
                fillOpacity: OPACIDAD_RELLENO_PAIS,
            };
        },
        [paisesMap, maxPais],
    );

    // Popup por país (técnica onEachFeature del mapa público de PI): nombre
    // ES del catálogo cuando hay cruce, nombre de la feature si no; el total
    // solo aparece cuando el dato existe (candado 9: sin datos → solo nombre).
    const alCadaFeature = useCallback(
        (feature: FeaturePais, layer: Layer) => {
            const nombreFeature = String(feature.properties?.name ?? "");
            const pais = paisesMap.get(normalizarNombrePais(nombreFeature));
            const nombre = pais?.pais ?? nombreFeature;
            const detalle = pais
                ? `<div class="text-[12px] font-semibold">${pais.total.toLocaleString("es-CO")} ${pais.total === 1 ? "reporte" : "reportes"}</div>`
                : "";
            layer.bindPopup(
                `<div class="text-[13px] font-semibold">${nombre}</div>${detalle}`,
            );
        },
        [paisesMap],
    );

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
            {geoData && (
                <GeoJSON data={geoData} style={paisStyle} onEachFeature={alCadaFeature} />
            )}
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
