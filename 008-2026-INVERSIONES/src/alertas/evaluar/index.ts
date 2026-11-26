/**
 * Motor de alertas (puro): `evaluarAlertas` recibe todo por parámetro (el instante, los precios, las reglas, los decretos,
 * el calendario y los umbrales) y devuelve las alertas del día de Colombia de `ahora`. Sin base, red, reloj ni azar
 * (candado: tests/unit/alertas/pureza.candado.test.ts).
 * - Una alerta por clave (día, tipo, especie, regla y sentido), en orden estable por clave. Si el intradía y el cierre
 *   producen la misma clave, queda la del cierre (es la definitiva).
 * - FECHA_EX: una por decreto. DATO_VIEJO: solo de las especies que se tienen.
 * Informa; no recomienda comprar ni vender.
 */
import type { CondicionRegla, Prisma } from "@prisma/client";
import { diaIso, fechaEnBogota } from "../../precios/horario";
import { tenenciaEn, type MovimientoTenencia } from "../../plan/tenencia";
import type { Alerta, BasePrecio, PrecioEvaluado, PrecioUltimo } from "../tipos";
import type { Umbrales } from "../umbrales";
import { evaluarFechasEx, type DecretoParaAlerta } from "./fecha-ex";
import { evaluarFrescura } from "./frescura";
import { evaluarMovimiento } from "./mercado";
import { evaluarNivel } from "./nivel";
import { evaluarCaida, type PosicionCaida } from "./portafolio";

export interface ReglaEvaluada {
  readonly id: string;
  readonly condicion: CondicionRegla;
  readonly nivel: Prisma.Decimal | null;
}

export interface EspecieEvaluada {
  readonly instrumentoId: string;
  readonly reglas: readonly ReglaEvaluada[];
  readonly movimientos: readonly MovimientoTenencia[];
  /** Barra intradía más reciente (de cualquier día). */
  readonly intradia: PrecioUltimo | null;
  /** Cierre con la fecha de hoy. */
  readonly cierreHoy: Prisma.Decimal | null;
  /** Cierre del día hábil anterior. */
  readonly cierreAnterior: Prisma.Decimal | null;
}

export interface EntradaEvaluacion {
  readonly ahora: Date;
  readonly umbrales: Umbrales;
  /** El servicio de precios intradía está encendido. */
  readonly intradiaActivo: boolean;
  /** Días AAAA-MM-DD sin rueda (`calendario_bvc`). */
  readonly noHabiles: ReadonlySet<string>;
  readonly especies: readonly EspecieEvaluada[];
  readonly decretos: readonly DecretoParaAlerta[];
}

const BASES: readonly BasePrecio[] = ["CIERRE", "INTRADIA"];

/** El precio de hoy por base: la barra solo cuenta si es de hoy y el intradía está encendido. */
function precioDe(base: BasePrecio, e: EspecieEvaluada, hoy: Date, intradiaActivo: boolean): PrecioEvaluado | null {
  if (base === "CIERRE") return e.cierreHoy === null ? null : { base, precio: e.cierreHoy };
  const u = e.intradia;
  if (!intradiaActivo || u === null || fechaEnBogota(u.instante).getTime() !== hoy.getTime()) return null;
  return { base, precio: u.precio, instante: u.instante, conRetraso: u.conRetraso };
}

export function evaluarAlertas(entrada: EntradaEvaluacion): Alerta[] {
  const { ahora, umbrales, intradiaActivo, noHabiles, especies, decretos } = entrada;
  const hoy = fechaEnBogota(ahora);
  const dia = diaIso(hoy);
  // El orden de BASES importa: gana la primera alerta de cada clave.
  const candidatas: Alerta[] = [];
  const movimientos = new Map(especies.map((e) => [e.instrumentoId, e.movimientos]));

  for (const base of BASES) {
    for (const e of especies) {
      const precio = precioDe(base, e, hoy, intradiaActivo);
      for (const r of e.reglas) {
        const a = evaluarNivel({ reglaId: r.id, instrumentoId: e.instrumentoId, condicion: r.condicion, nivel: r.nivel, precio, dia }, umbrales);
        if (a) candidatas.push(a);
      }
      const diaEsFechaEx = decretos.some((d) => d.instrumentoId === e.instrumentoId && d.vigente && !d.anulada && diaIso(d.fechaEx) === dia);
      const m = evaluarMovimiento({ dia, instrumentoId: e.instrumentoId, precio, cierreAnterior: e.cierreAnterior, diaEsFechaEx }, umbrales);
      if (m) candidatas.push(m);
    }
    const posiciones: PosicionCaida[] = especies.map((e) => ({
      instrumentoId: e.instrumentoId, tenencia: tenenciaEn(e.movimientos, hoy), precio: precioDe(base, e, hoy, intradiaActivo)?.precio ?? null, cierreAnterior: e.cierreAnterior,
    }));
    const caida = evaluarCaida({ dia, base, posiciones }, umbrales);
    if (caida) candidatas.push(caida);
  }

  for (const e of especies) {
    if (tenenciaEn(e.movimientos, hoy) <= 0n) continue;
    const v = evaluarFrescura({ dia, ahora, instrumentoId: e.instrumentoId, intradiaActivo, ultimo: e.intradia, cierreDeHoy: e.cierreHoy !== null, noHabiles }, umbrales);
    if (v) candidatas.push(v);
  }
  candidatas.push(...evaluarFechasEx({ dia, hoy, decretos, movimientos, noHabiles }, umbrales));

  const porClave = new Map<string, Alerta>();
  for (const a of candidatas) if (!porClave.has(a.clave)) porClave.set(a.clave, a);
  return [...porClave.values()].sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
}
