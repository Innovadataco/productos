"use client";
/**
 * La gráfica de una serie oficial en su ventana (frente datos-oficiales-pantalla, C6a), con la gráfica de tiempo del
 * módulo común (src/app/_graficas: SVG propio, «reducir movimiento», deslizador por teclado y «Ver los datos»). Un
 * punto por vigencia, en su `desde` (el IPC, uno por mes); el detalle de un tramo de varios días dice hasta cuándo vale.
 * Recibe solo textos y números del servidor; los formatos (formato.ts) son deterministas, así hidrata sin diferencias.
 * Con menos de dos valores en la ventana, una nota en lugar de la gráfica.
 */
import { useMemo } from "react";
import { GraficaTiempo } from "@/app/_graficas";
import { extraDetalle, formatoDia, formatoEje, formatoTick, formatoY, notaSinGrafica, resumenGrafica, tituloGrafica, valores } from "./formato";
import type { SerieConDatos } from "./tipos";

const ALTO = 200;

export function GraficaSerie({ serie }: { readonly serie: SerieConDatos }) {
  const props = useMemo(() => ({
    dias: serie.historia.map((p) => p.desde),
    series: [{ id: serie.codigo, nombre: serie.nombre, tono: "valor" as const, valores: valores(serie) }],
    formatoY: formatoY(serie),
    formatoEje: formatoEje(serie),
    formatoDia: formatoDia(serie),
    extraDetalle: extraDetalle(serie),
  }), [serie]);
  const nota = notaSinGrafica(serie);
  if (nota !== null) return <p className="nota do-sin-grafica">{nota}</p>;
  return (
    <GraficaTiempo
      titulo={tituloGrafica(serie)} resumen={resumenGrafica(serie)} alto={ALTO} formatoTick={formatoTick}
      dias={props.dias} series={props.series} formatoY={props.formatoY} formatoEje={props.formatoEje} formatoDia={props.formatoDia} extraDetalle={props.extraDetalle}
    />
  );
}
