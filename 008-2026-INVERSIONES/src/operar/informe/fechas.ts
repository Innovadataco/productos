/**
 * Sección «Fechas» del informe para operar. Pura. Los ex-dividendos (por fecha ex) y los plazos de las reglas de la
 * versión vigente que caen de hoy a hoy + DIAS_FECHAS, los dos bordes incluidos. Orden: fecha, especie (las de
 * portafolio al final), primero el ex-dividendo y después el plazo, y el id. Los decretos ya llegan filtrados por el
 * lector (vigentes, no anulados, ex desde hoy); aquí se vuelve a cortar por la ventana.
 */
import type { Proximo } from "@/datos-oficiales/decretos/proximos";
import type { FechaInforme, ReglaInforme } from "./tipos";
import { porEspecieEId } from "./reglas";

/** Cuántos días mira adelante la sección «Fechas», contando desde hoy. */
export const DIAS_FECHAS = 30;

const enVentana = (fecha: Date, hoy: Date, hasta: Date): boolean => fecha.getTime() >= hoy.getTime() && fecha.getTime() <= hasta.getTime();

const exDividendo = (p: Proximo): FechaInforme => ({
  tipo: "EX_DIVIDENDO", fecha: p.fechaEx, id: p.id, especie: p.nemotecnico, tipoDividendo: p.tipo, cuota: p.cuota,
  valorPorAccion: p.valorPorAccion, fechaPago: p.fechaPago, tenencia: p.tenencia,
});

const plazo = (r: ReglaInforme & { readonly plazoHasta: Date }): FechaInforme => ({
  tipo: "PLAZO", fecha: r.plazoHasta, id: r.id, especie: r.especie, accion: r.accion, cantidad: r.cantidad, condicion: r.condicion, nivel: r.nivel,
});

const conPlazo = (r: ReglaInforme): r is ReglaInforme & { readonly plazoHasta: Date } => r.plazoHasta !== null;

const ORDEN_TIPO: Readonly<Record<FechaInforme["tipo"], number>> = { EX_DIVIDENDO: 0, PLAZO: 1 };

function porFecha(a: FechaInforme, b: FechaInforme): number {
  const dt = a.fecha.getTime() - b.fecha.getTime();
  if (dt !== 0) return dt;
  if (a.especie !== b.especie) return porEspecieEId(a, b);
  return ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] || porEspecieEId(a, b);
}

export function fechasQueImportan(proximos: readonly Proximo[], reglas: readonly ReglaInforme[], hoy: Date, hasta: Date): FechaInforme[] {
  return [
    ...proximos.filter((p) => enVentana(p.fechaEx, hoy, hasta)).map(exDividendo),
    ...reglas.filter(conPlazo).filter((r) => enVentana(r.plazoHasta, hoy, hasta)).map(plazo),
  ].sort(porFecha);
}
