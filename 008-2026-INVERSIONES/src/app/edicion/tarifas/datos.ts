/**
 * Qué lee /edicion/tarifas (O5): las versiones guardadas (la historia), la vigente de hoy de cada comisionista y lado con
 * su control contra las órdenes pasadas, y la última versión (contra ella se crea la nueva). Solo lectura.
 */
import "server-only";
import type { LadoOrden, PrismaClient } from "@prisma/client";
import { textoPesos } from "@/operar/simulador/textos";
import type { CargoTarifa, Comisionista, TarifaSimulada } from "@/operar/simulador/tipos";
import { controlarTarifa, type ControlTarifa } from "@/operar/tarifa/control";
import { leerOrdenesHistoricas, leerTarifas, type TarifaLeida } from "@/operar/tarifa/leer";
import { COMISIONISTAS, LADOS_TARIFA, MAX_OTROS_CARGOS, TIPOS_CARGO } from "@/operar/tarifa/parametros";
import { vigenteDe } from "@/operar/tarifa/vigente";
import { nivelEs } from "@/plan/edicion/formato";
import { fechaEnBogota } from "@/precios/horario";
import { fecha } from "../../tablero/formato";
import type { DatosEdicionTarifas, TarifaVista, VigenteVista } from "./tipos-tarifas";

export const NOMBRES_COMISIONISTA: Readonly<Record<Comisionista, string>> = { TRII: "Trii", AV: "Acciones & Valores" };
export const NOMBRES_LADO: Readonly<Record<LadoOrden, string>> = { COMPRA: "Compra", VENTA: "Venta" };
const NOMBRES_TIPO: Readonly<Record<(typeof TIPOS_CARGO)[number], string>> = { PCT: "Porcentaje del valor", FIJO: "Fijo en pesos" };
const HISTORIA = 20;
const VERSION = /^[1-9][0-9]{0,8}$/;
const DESFASE_BOGOTA_MS = 5 * 3_600_000;

const pct = (d: TarifaSimulada["porcentaje"]): string => `${nivelEs(d.toFixed())} %`;
const cargoTexto = (c: CargoTarifa): string => `${c.nombre}: ${c.tipo === "PCT" ? `${pct(c.valor)} del valor` : textoPesos(c.valor)}`;

/** «0,25 % del valor (mínimo $ 4.613) · fijo $ 0 · IVA 19 % sobre la comisión · sin otros cargos». */
export function detalleTarifa(t: TarifaSimulada): string {
  const otros = t.otrosCargos.length === 0 ? "sin otros cargos" : t.otrosCargos.map(cargoTexto).join(" · ");
  return `${pct(t.porcentaje)} del valor (mínimo ${textoPesos(t.minimoPorOrden)}) · fijo ${textoPesos(t.fijoPorOrden)} · IVA ${pct(t.ivaPct)} sobre la comisión · ${otros}`;
}

/** «17-mar-2027 18:41», en hora de Colombia. */
function fechaHora(instante: Date): string {
  const bogota = new Date(instante.getTime() - DESFASE_BOGOTA_MS).toISOString();
  return `${fecha(bogota.slice(0, 10))} ${bogota.slice(11, 16)}`;
}

const aVista = (t: TarifaLeida): TarifaVista => ({
  version: t.version,
  comisionista: NOMBRES_COMISIONISTA[t.comisionista],
  lado: NOMBRES_LADO[t.lado],
  desde: fecha(t.vigenteDesde.toISOString().slice(0, 10)),
  detalle: detalleTarifa(t),
  motivo: t.motivo,
  creada: fechaHora(t.creadaEn),
});

/** «La tarifa explica 37 de 41 órdenes de compra pasadas (hasta 1 peso de diferencia por orden).» */
export function textoControl(c: ControlTarifa, comisionista: Comisionista, lado: LadoOrden): string {
  const deLado = NOMBRES_LADO[lado].toLowerCase();
  if (c.estado === "SIN_ORDENES") {
    return comisionista === "TRII" ? `Sin órdenes de ${deLado} para contrastar.` : "Sin órdenes para contrastar: 008 solo tiene las órdenes de Trii.";
  }
  const ordenes = c.total === 1 ? "orden" : "órdenes";
  return `La tarifa explica ${c.explicadas} de ${c.total} ${ordenes} de ${deLado} pasadas (hasta 1 peso de diferencia por orden).`;
}

const versionGuardada = (v: string | string[] | undefined, historia: readonly TarifaLeida[]): number | null => {
  if (typeof v !== "string" || !VERSION.test(v)) return null;
  const n = Number(v);
  return historia.some((t) => t.version === n) ? n : null;
};

export async function datosEdicionTarifas(db: PrismaClient, guardada: string | string[] | undefined): Promise<DatosEdicionTarifas> {
  const hoy = fechaEnBogota(new Date());
  const [tarifas, ordenes] = await Promise.all([leerTarifas(db), leerOrdenesHistoricas(db)]);
  const vigentes: VigenteVista[] = COMISIONISTAS.flatMap((c) =>
    LADOS_TARIFA.map((l) => {
      const t = vigenteDe(tarifas, c, l, hoy);
      return {
        comisionista: NOMBRES_COMISIONISTA[c],
        lado: NOMBRES_LADO[l],
        tarifa: t === undefined ? null : aVista(t),
        control: t === undefined ? "" : textoControl(controlarTarifa(t, ordenes), c, l),
      };
    }),
  );
  return {
    ultimaVersion: tarifas[0]?.version ?? 0,
    hoy: hoy.toISOString().slice(0, 10),
    vigentes,
    historia: tarifas.slice(0, HISTORIA).map(aVista),
    comisionistas: COMISIONISTAS.map((c) => ({ valor: c, texto: NOMBRES_COMISIONISTA[c] })),
    lados: LADOS_TARIFA.map((l) => ({ valor: l, texto: NOMBRES_LADO[l] })),
    tiposCargo: TIPOS_CARGO.map((t) => ({ valor: t, texto: NOMBRES_TIPO[t] })),
    maxCargos: MAX_OTROS_CARGOS,
    guardada: versionGuardada(guardada, tarifas),
  };
}
