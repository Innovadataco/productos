/**
 * Riesgo del portafolio en la ventana común: `armarHistoria` (src/proyecciones/historia.ts) con las acciones que tienen
 * valor en el tablero. Puro.
 * - Retornos diarios de PRECIO (factores − 1, ajustados). Sin dividendos: en datos diarios el pago y el salto ex caen en
 *   días distintos y sumarlos inflaría la varianza.
 * - Pesos: el valor del tablero de cada especie cubierta sobre el de todas las cubiertas (renormalizados), con la fracción
 *   cubierta del valor de las acciones. Las que no entran en la ventana quedan SIN_HISTORIA: no se inventa su riesgo.
 * - Anualización: A = 12 × ruedasPorMes de la ventana común, el factor de `volatilidadAnualVentana` de las proyecciones.
 *   Esa otra volatilidad usa retornos logarítmicos del portafolio y los pesos de Yahoo: los dos números no coinciden.
 */
import { Prisma } from "@prisma/client";
import { armarHistoria } from "../proyecciones/historia";
import { MINIMO_DIAS } from "../proyecciones/metodo";
import type { AccionEntrada, AvisoCrudo, EntradasProyeccion, Historia, PosicionSupuesta } from "../proyecciones/tipos";
import { compararTexto, redondear } from "./numeros";
import { correlacionDe, covarianzaMuestral, descomponerRiesgo, type RiesgoColumna } from "./riesgo";
import type { RiesgoConValor, RiesgoPortafolio } from "./tipos";

const MESES_POR_ANIO = 12;

export interface EspecieCubierta {
  readonly instrumentoId: string;
  /** Positivo. */
  readonly valor: Prisma.Decimal;
}

export interface ResultadoRiesgoComun {
  readonly portafolio: RiesgoPortafolio;
  /** Por id, de cada especie pedida. */
  readonly porEspecie: ReadonlyMap<string, RiesgoConValor>;
  readonly avisos: readonly AvisoCrudo[];
}

/** Por qué una especie no entra en la ventana común (la regla de historia.ts: 250 días en total y en la ventana). */
function sinHistoria(p: PosicionSupuesta | undefined): RiesgoConValor {
  if (p === undefined || p.estado === "EXCLUIDA_SIN_VALOR") return { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: p?.diasTotales ?? 0 };
  return p.diasTotales >= MINIMO_DIAS
    ? { estado: "SIN_HISTORIA", motivo: "HISTORIA_CORTA_EN_VENTANA", dias: p.diasEnVentana }
    : { estado: "SIN_HISTORIA", motivo: "HISTORIA_CORTA", dias: p.diasTotales };
}

/** K columnas de T retornos de precio. */
const retornosPrecio = (h: Historia): number[][] => Array.from({ length: h.K }, (_, k) => Array.from({ length: h.T }, (_, t) => h.factores[t * h.K + k]! - 1));

const aEspecie = (c: RiesgoColumna, pesoEnCubiertas: number): RiesgoConValor => ({
  estado: "CUBIERTA",
  volatilidadAnual: redondear(c.volatilidad),
  pesoEnCubiertas: redondear(pesoEnCubiertas),
  contribucion: c.contribucion === null ? null : { marginal: redondear(c.marginal!), contribucion: redondear(c.contribucion), contribucionPct: redondear(c.contribucionPct!) },
});

/** `especies`: las de valor positivo del tablero; `valorAcciones`: el total del tablero. */
export function riesgoComun(e: EntradasProyeccion, especies: readonly EspecieCubierta[], valorAcciones: Prisma.Decimal): ResultadoRiesgoComun {
  const valores = new Map(especies.map((x) => [x.instrumentoId, x.valor]));
  const acciones = e.posiciones
    .filter((p): p is AccionEntrada => p.tipo === "ACCION" && valores.has(p.instrumentoId))
    .sort((a, b) => compararTexto(a.instrumentoId, b.instrumentoId));
  if (acciones.length === 0) return { portafolio: { estado: "SIN_HISTORIA" }, porEspecie: new Map(especies.map((x) => [x.instrumentoId, sinHistoria(undefined)])), avisos: [] };
  const armado = armarHistoria({ ...e, posiciones: acciones, incompletas: [] });
  const supuestas = new Map(armado.posiciones.map((p) => [p.instrumentoId, p]));
  const fuera = new Map(especies.map((x) => [x.instrumentoId, sinHistoria(supuestas.get(x.instrumentoId))]));
  if (armado.historia.K === 0) return { portafolio: { estado: "SIN_HISTORIA" }, porEspecie: fuera, avisos: armado.avisos };
  const ids = armado.columnas.map((c) => c.instrumentoId);
  const cubierto = ids.reduce((s, id) => s.add(valores.get(id)!), new Prisma.Decimal(0));
  const pesos = ids.map((id) => valores.get(id)!.div(cubierto).toNumber());
  const factor = MESES_POR_ANIO * armado.historia.ruedasPorMes;
  const cov = covarianzaMuestral(retornosPrecio(armado.historia));
  const d = descomponerRiesgo(cov, pesos, factor);
  const porEspecie = new Map([...fuera, ...ids.map((id, k) => [id, aEspecie(d.columnas[k]!, pesos[k]!)] as const)]);
  const portafolio: RiesgoPortafolio = {
    estado: "CALCULADO", ventana: { desde: armado.ventana!.desde, hasta: armado.ventana!.hasta, ruedas: armado.ventana!.ruedas }, factorAnualizacion: redondear(factor), volatilidadAnual: redondear(d.volatilidad),
    fraccionCubierta: redondear(cubierto.div(valorAcciones).toNumber()),
    correlacion: { ids, valores: correlacionDe(cov).map((fila) => fila.map((r) => (r === null ? null : redondear(r)))) },
  };
  return { portafolio, porEspecie, avisos: armado.avisos };
}
