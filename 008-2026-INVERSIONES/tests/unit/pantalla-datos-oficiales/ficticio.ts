// Vistas inventadas de /datos-oficiales (frente datos-oficiales-pantalla, C6a) para las pruebas de los componentes y
// de los formatos. «Hoy» es el 17-mar-2021 (fuera del periodo de la historia real del dueño). Cifras inventadas.
import { CATALOGO } from "@/datos-oficiales/catalogo";
import { UNIDAD_VARIACION } from "@/datos-oficiales/series/consulta";
import type { DecretosVista, PuntoVista, SerieBase, SerieConDatos, SerieVista, VariacionVista, VistaDatosOficiales } from "@/app/datos-oficiales/tipos";
import { DECRETOS_VACIOS } from "./ficticio-decretos";

export const HOY = "2021-03-17";

export function baseDe(codigo: string): SerieBase {
  const s = CATALOGO.find((c) => c.codigo === codigo);
  if (!s) throw new Error(`${codigo} no está en el catálogo`);
  return {
    codigo: s.codigo, nombre: s.nombre, unidad: s.unidad, origen: s.origen, fuente: s.fuente, escala: s.escala,
    vigencia: s.vigencia.tipo, entrada: s.entrada, umbralDias: s.umbralFrescuraDias, ventana: s.vigencia.tipo === "MES" ? "CINCO_ANIOS" : "ANIO",
  };
}

const punto = (desde: string, hasta: string, valor: string): PuntoVista => ({ desde, hasta, valor });
/** Como lo guarda la base: sin ceros sobrantes en la fracción. */
const canonico = (texto: string) => texto.replace(/0+$/, "").replace(/\.$/, "");

export const TRM: SerieConDatos = {
  ...baseDe("TRM"), estado: "CON_DATOS",
  ultimo: { valor: "3923.07", desde: "2021-03-17", hasta: "2021-03-17", fuente: "sfc:32sa-8pi3", traidoEn: "2021-03-16 18:41" },
  frescura: { estado: "AL_DIA", dias: 0, umbralDias: 3, valeHoy: true },
  historia: [punto("2021-03-12", "2021-03-12", "3917.43"), punto("2021-03-13", "2021-03-15", "3921.17"), punto("2021-03-16", "2021-03-16", "3919.61"), punto("2021-03-17", "2021-03-17", "3923.07")],
  variacion: null,
};

export const TPM: SerieConDatos = {
  ...baseDe("TPM"), estado: "CON_DATOS",
  ultimo: { valor: "4.37", desde: "2021-03-16", hasta: "2021-03-16", fuente: "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", traidoEn: "2021-03-17 07:13" },
  frescura: { estado: "AL_DIA", dias: 1, umbralDias: 7, valeHoy: false },
  historia: [punto("2021-03-14", "2021-03-14", "4.41"), punto("2021-03-15", "2021-03-15", "4.37"), punto("2021-03-16", "2021-03-16", "4.37")],
  variacion: null,
};

export const IBR: SerieConDatos = {
  ...baseDe("IBR_3M_EA"), estado: "CON_DATOS",
  ultimo: { valor: "3.917", desde: "2021-03-05", hasta: "2021-03-05", fuente: "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", traidoEn: "2021-03-06 09:02" },
  frescura: { estado: "ATRASADA", dias: 12, umbralDias: 7, valeHoy: false },
  historia: [punto("2021-03-04", "2021-03-04", "3.931"), punto("2021-03-05", "2021-03-05", "3.917")],
  variacion: null,
};

export const VARIACION: VariacionVista = { estado: "CALCULADA", valor: "2.71", unidad: UNIDAD_VARIACION, mesBase: "2020-02-01", mesFinal: "2021-02-01" };

const meses = ["2020-02", "2020-03", "2020-04", "2020-05", "2020-06", "2020-07", "2020-08", "2020-09", "2020-10", "2020-11", "2020-12", "2021-01", "2021-02"];
const finDeMes = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);

export const IPC: SerieConDatos = {
  ...baseDe("IPC_INDICE"), estado: "CON_DATOS",
  ultimo: { valor: "134.93", desde: "2021-02-01", hasta: "2021-02-28", fuente: "dane:anex-IPC-Indices", traidoEn: "2021-03-09 20:57" },
  frescura: { estado: "AL_DIA", dias: 17, umbralDias: 45, valeHoy: false },
  historia: meses.map((m, k) => punto(`${m}-01`, finDeMes(m), k === meses.length - 1 ? "134.93" : canonico((131.37 + k * 0.27).toFixed(2)))),
  variacion: VARIACION,
};

/** Sin decretos por defecto (la sección de C6b la prueban sus propios archivos con ficticio-decretos.ts). */
export const datos = (series: readonly SerieVista[] = [TRM, TPM, IBR, IPC], decretos: DecretosVista = DECRETOS_VACIOS): VistaDatosOficiales => ({ hoy: HOY, series, decretos });
export const sinDatos = (codigo: string): SerieVista => ({ ...baseDe(codigo), estado: "SIN_DATOS" });
export const conError = (codigo: string): SerieVista => ({ ...baseDe(codigo), estado: "ERROR" });
