/** Días ISO como números de día (UTC, sin zonas horarias) y marcas del eje de tiempo. Puro. */
import type { EtiquetaTiempo } from "./tipos";

const DIA_MS = 86_400_000;
const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Hasta aquí (en días) el eje marca días; desde aquí, meses. */
const TRAMO_CORTO = 70;
const PASOS_DIA = [7, 14, 28] as const;
const PASOS_MES = [1, 2, 3, 6, 12, 24] as const;

export function diaANumero(dia: string): number {
  const m = DIA_ISO.exec(dia);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DIA_MS : Number.NaN;
}

export const numeroADia = (n: number): string => new Date(n * DIA_MS).toISOString().slice(0, 10);

export interface MarcaTiempo { readonly valor: number; readonly dia: string; readonly etiqueta: EtiquetaTiempo }

const anioDe = (n: number) => new Date(n * DIA_MS).getUTCFullYear();

/** El año va en la primera marca y cada vez que cambia. */
const marcas = (valores: readonly number[], tipo: EtiquetaTiempo["tipo"]): MarcaTiempo[] =>
  valores.map((valor, i) => ({ valor, dia: numeroADia(valor), etiqueta: { tipo, conAnio: i === 0 || anioDe(valor) !== anioDe(valores[i - 1]!) } }));

function ticksDias(desde: number, hasta: number, maximo: number): MarcaTiempo[] {
  const paso = PASOS_DIA.find((p) => Math.floor((hasta - desde) / p) + 1 <= maximo) ?? PASOS_DIA[PASOS_DIA.length - 1];
  return marcas(Array.from({ length: Math.floor((hasta - desde) / paso) + 1 }, (_, k) => desde + k * paso), "dia");
}

function ticksMeses(desde: number, hasta: number, maximo: number): MarcaTiempo[] {
  const d = new Date(desde * DIA_MS);
  const primero = d.getUTCFullYear() * 12 + d.getUTCMonth() + (d.getUTCDate() === 1 ? 0 : 1);
  const inicioDe = (mes: number) => Date.UTC(Math.floor(mes / 12), mes % 12, 1) / DIA_MS;
  const meses = (paso: number) => {
    const lista: number[] = [];
    for (let mes = Math.ceil(primero / paso) * paso; inicioDe(mes) <= hasta; mes += paso) lista.push(inicioDe(mes));
    return lista;
  };
  const paso = PASOS_MES.find((p) => meses(p).length <= maximo) ?? PASOS_MES[PASOS_MES.length - 1];
  return marcas(meses(paso), "mes");
}

export function ticksTiempo(desde: number, hasta: number, maximo: number): MarcaTiempo[] {
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde) return [];
  return hasta - desde <= TRAMO_CORTO ? ticksDias(desde, hasta, maximo) : ticksMeses(desde, hasta, maximo);
}
