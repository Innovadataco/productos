import "server-only";
/**
 * El análisis del antes y el después de una operación simulada (POST /api/operar/simular), con los motores tal cual:
 * src/analisis/ (analizar y observaciones) sobre el tablero y la historia de hoy y sobre el portafolio simulado, y
 * src/proyecciones/ (con la caja como parte fija, src/operar/analisis/escenarios.ts) con los parámetros por omisión de la pantalla de proyecciones y horizonte de
 * 12, DENTRO del turno de las proyecciones (src/app/proyecciones/turno.ts): con el turno ocupado, sin escenarios. Solo
 * lectura; nada se guarda. Las decisiones no entran (solo se comparan los puntos que cambian con la operación).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { analizar } from "@/analisis/analizar";
import { observaciones } from "@/analisis/observaciones";
import type { EntradasAnalisis, ReglaParaAnalisis } from "@/analisis/tipos";
import { CONTROLES_INICIALES } from "@/app/proyecciones/opciones";
import { SEMILLA_PANTALLA, TRAYECTORIAS_PANTALLA } from "@/app/proyecciones/controles";
import { conTurno } from "@/app/proyecciones/turno";
import { leerEntradas } from "@/proyecciones/leer";
import { validarParametros } from "@/proyecciones/parametros";
import { obtenerResumen } from "@/tablero/datos";
import type { Tablero } from "@/tablero/calculo";
import { compararAnalisis } from "../analisis/comparar";
import { portafolioDespues } from "../analisis/despues";
import { escenariosAntesDespues, type EntradaEscenario } from "../analisis/escenarios";
import type { AntesDespues, ComparacionAnalisis, ResumenEscenario } from "../analisis/tipos";

export const HORIZONTE_ESCENARIOS = 12;

export interface PedidoAnalisis {
  readonly hoy: Date;
  readonly usuarioId: string;
  readonly instrumentoId: string;
  readonly cantidadDespues: bigint;
  readonly reglas: readonly ReglaParaAnalisis[];
  /** La caja del simulador: antes, la vigente (escrita por el dueño o la de A&V); después, con la orden y la comisión. */
  readonly caja: AntesDespues<Prisma.Decimal>;
}

export interface AnalisisSimulado {
  readonly comparacion: ComparacionAnalisis;
  readonly escenarios: AntesDespues<ResumenEscenario> | null;
  readonly nombres: ReadonlyMap<string, string>;
}

const paraAnalisis = (r: ReglaParaAnalisis): ReglaParaAnalisis => ({ id: r.id, instrumentoId: r.instrumentoId, condicion: r.condicion, nivel: r.nivel, plazoHasta: r.plazoHasta });

function parametros() {
  const v = validarParametros({ ...CONTROLES_INICIALES, horizonteMeses: HORIZONTE_ESCENARIOS, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA });
  if (!v.ok) throw new RangeError("Parámetros de los escenarios inválidos.");
  return v.valor;
}

/** La entrada de un escenario: la historia, la caja y, si la historia no trae la especie operada, su valor al cierre. */
function entradaEscenario(historia: EntradasAnalisis["historia"], tablero: Tablero, caja: Prisma.Decimal, instrumentoId: string): EntradaEscenario {
  const enHistoria = historia.posiciones.some((p) => p.tipo === "ACCION" && p.instrumentoId === instrumentoId);
  const fila = enHistoria ? undefined : tablero.filas.find((f) => f.instrumentoId === instrumentoId);
  return { historia, caja: caja.toNumber(), accionesSinHistoria: fila?.valor?.toNumber() ?? 0 };
}

async function escenarios(usuarioId: string, antes: EntradaEscenario, despues: EntradaEscenario): Promise<AntesDespues<ResumenEscenario> | null> {
  const p = parametros();
  try {
    const turno = await conTurno(usuarioId, Date.now(), async () => escenariosAntesDespues(antes, despues, p));
    return turno.ok ? turno.valor : null;
  } catch (error) {
    // Sin escenarios (p. ej. demasiado trabajo): el resto del análisis sigue. Al registro, solo el nombre del error.
    console.error(`[operar:simular] escenarios no calculados (${error instanceof Error ? error.name : "desconocido"})`);
    return null;
  }
}

export async function analizarSimulacion(db: PrismaClient, pedido: PedidoAnalisis): Promise<AnalisisSimulado> {
  const { hoy, instrumentoId } = pedido;
  const { tablero } = await obtenerResumen(db);
  const historia = await leerEntradas(db, hoy);
  const base: EntradasAnalisis = { hoy, historia, tablero, decisiones: [] };
  const simulado = portafolioDespues({ tablero, historia }, instrumentoId, pedido.cantidadDespues);
  const antes = analizar(base);
  const despues = analizar({ ...base, ...simulado });
  const plan = { reglas: pedido.reglas.map(paraAnalisis) };
  return {
    comparacion: compararAnalisis({ antes, despues, puntosAntes: observaciones(antes, plan, hoy), puntosDespues: observaciones(despues, plan, hoy), instrumentoId }),
    escenarios: await escenarios(
      pedido.usuarioId,
      entradaEscenario(historia, tablero, pedido.caja.antes, instrumentoId),
      entradaEscenario(simulado.historia, simulado.tablero, pedido.caja.despues, instrumentoId),
    ),
    nombres: new Map([...tablero.filas, ...tablero.cerradas].map((f) => [f.instrumentoId, f.nemotecnico] as const)),
  };
}
