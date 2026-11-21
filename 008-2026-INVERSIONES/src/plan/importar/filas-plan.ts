/**
 * Gramática cerrada de las filas del plan de la ficha: la tabla «Ticker | Decisión | Detalle» y la
 * viñeta «Reglas: a · b · c». Lo que no encaja en una forma conocida se reporta con su código; nunca se
 * adivina. Devuelve reglas y decisiones de la fila más sus hallazgos (sin valores).
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import { partirNivelSuperior, textoPlano, type FilaTabla } from "./markdown";
import type { Hallazgo, ReglaLeida } from "./tipos";
import { leerCantidadInicial, leerMontoEs } from "./valores-es";

const NEMOTECNICO = /^[A-Z][A-Z0-9]{1,11}$/;
const MONEDA = String.raw`(\$?\s*\d(?:[\d.]|,(?=\d))*(?:\s*M\b)?)`;
const CONDICION = new RegExp(String.raw`\bsi\s+cierra\s*(<|>|bajo|sobre|por\s+debajo\s+de|por\s+encima\s+de)\s*${MONEDA}\s*,?\s*(vender|comprar)\b(.*)$`, "i");
const MONTO_POR_ORDEN = new RegExp(String.raw`\bno\s+(?:comprar|vender|operar)\b.*?<\s*${MONEDA}\s*(?:por|cada)\s+orden`, "i");
const SIN_DETALLE = /^[—–-]*$/;

/** Decisión de una fila del plan, antes de saber su motivo y su fecha (los pone quien llama). */
export interface DecisionDeFila {
  readonly linea: number;
  readonly especie: string;
  readonly accion: AccionPlan;
  /** Obligatoria en «no actuar» (sin ella la decisión no se arma); en compra o venta, la de la orden. */
  readonly cantidad: bigint | null;
  /** Índice dentro de `reglas` de la fila. */
  readonly indiceLocal: number;
}

export interface LecturaDeFila {
  readonly reglas: readonly ReglaLeida[];
  readonly decisiones: readonly DecisionDeFila[];
  readonly noImportados: readonly Hallazgo[];
  readonly avisos: readonly Hallazgo[];
  readonly bloqueos: readonly Hallazgo[];
}

const VACIA: LecturaDeFila = { reglas: [], decisiones: [], noImportados: [], avisos: [], bloqueos: [] };
const hallazgo = (linea: number, codigo: string, item: number | null = null): Hallazgo => ({ linea, item, codigo });
const bloqueo = (linea: number, codigo: string): LecturaDeFila => ({ ...VACIA, bloqueos: [hallazgo(linea, codigo)] });

interface DecisionTexto {
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly avisos: readonly string[];
}

type FallaDeTexto = "DECISION_NO_RECONOCIDA" | "CANTIDAD_NO_RECONOCIDA";

/** Cantidad tras el verbo: un número entero, ninguno (aviso si hay texto) o una falla (nunca truncada). */
function cantidadTrasVerbo(resto: string): { readonly cantidad: bigint | null; readonly avisos: readonly string[] } | "CANTIDAD_NO_RECONOCIDA" {
  const c = leerCantidadInicial(resto);
  if (c.tipo === "NO_RECONOCIDA") return "CANTIDAD_NO_RECONOCIDA";
  if (c.tipo === "CANTIDAD") return { cantidad: c.cantidad, avisos: [] };
  return { cantidad: null, avisos: resto.trim() === "" ? [] : ["CANTIDAD_EN_TEXTO"] };
}

/** «Vender las N» · «Vender N, dejar M» · «Comprar N» · «Mantener [hasta …]» · «Mantener; …» · «No tocar». */
function leerDecisionTexto(texto: string): DecisionTexto | FallaDeTexto {
  const operar = /^(vender|comprar)\b(.*)$/i.exec(texto);
  if (operar) {
    const accion: AccionPlan = operar[1]!.toLowerCase() === "vender" ? "VENDER" : "COMPRAR";
    const c = cantidadTrasVerbo(operar[2]!);
    return c === "CANTIDAD_NO_RECONOCIDA" ? c : { accion, ...c };
  }
  if (/^mantener\b/i.test(texto)) return { accion: "NO_ACTUAR", cantidad: null, avisos: /\bhasta\b/i.test(texto) ? ["PLAZO_EN_TEXTO"] : [] };
  if (/^no\s+tocar\b/i.test(texto)) return { accion: "NO_ACTUAR", cantidad: null, avisos: [] };
  return "DECISION_NO_RECONOCIDA";
}

function condicionDe(operador: string): CondicionRegla {
  return /^(<|bajo|por\s+debajo\s+de)$/i.test(operador.trim()) ? "CIERRE_BAJO" : "CIERRE_SOBRE";
}

/** «Si cierra < $X, vender [N | texto]» del Detalle → una regla por especie; nulo si no hay condición. */
function leerCondicionada(linea: number, especies: readonly string[], detalle: string): LecturaDeFila | null {
  const m = CONDICION.exec(detalle);
  if (!m) return null;
  const nivel = leerMontoEs(m[2]!);
  if (nivel === null) return bloqueo(linea, "NIVEL_NO_RECONOCIDO");
  const c = cantidadTrasVerbo(m[4]!);
  if (c === "CANTIDAD_NO_RECONOCIDA") return bloqueo(linea, c);
  const accion: AccionPlan = m[3]!.toLowerCase() === "vender" ? "VENDER" : "COMPRAR";
  const reglas = especies.map((especie): ReglaLeida => ({ linea, item: null, especie, condicion: condicionDe(m[1]!), nivel, accion, cantidad: c.cantidad, plazoHasta: null, detalle }));
  return { ...VACIA, reglas, avisos: c.avisos.map((codigo) => hallazgo(linea, codigo)) };
}

/** Una fila de la tabla del plan: regla principal (y su decisión) por especie, más la condicionada. */
export function leerFilaPlan(fila: FilaTabla, cantidades: ReadonlyMap<string, bigint | null>): LecturaDeFila {
  const { linea, celdas } = fila;
  if (celdas.length < 3) return bloqueo(linea, "FILA_INCOMPLETA");
  const especies = textoPlano(celdas[0]!).split(/\s*[·,]\s*/);
  if (!especies.every((e) => NEMOTECNICO.test(e))) return bloqueo(linea, "ESPECIE_NO_RECONOCIDA");
  const textoDecision = textoPlano(celdas[1]!);
  const decision = leerDecisionTexto(textoDecision);
  if (typeof decision === "string") return bloqueo(linea, decision);
  if (decision.cantidad !== null && especies.length > 1) return bloqueo(linea, "CANTIDAD_AMBIGUA");
  const textoDetalle = textoPlano(celdas[2]!);
  const conDetalle = !SIN_DETALLE.test(textoDetalle);
  const detalle = conDetalle ? `${textoDecision} — ${textoDetalle}` : textoDecision;
  const principales = especies.map((especie): ReglaLeida => ({ linea, item: null, especie, condicion: "NINGUNA", nivel: null, accion: decision.accion, cantidad: decision.cantidad, plazoHasta: null, detalle }));
  const cantidadDe = (especie: string) => (decision.accion === "NO_ACTUAR" ? (cantidades.get(especie) ?? null) : decision.cantidad);
  const conCantidad = especies.map((especie, indiceLocal) => ({ especie, indiceLocal, cantidad: cantidadDe(especie) }));
  const decisiones = conCantidad.flatMap(({ especie, indiceLocal, cantidad }): DecisionDeFila[] =>
    decision.accion === "NO_ACTUAR" && cantidad === null ? [] : [{ linea, especie, accion: decision.accion, cantidad, indiceLocal }],
  );
  const sinCantidad = conCantidad.filter((d) => decision.accion === "NO_ACTUAR" && d.cantidad === null).map(() => hallazgo(linea, "SIN_CANTIDAD"));
  const condicionada = conDetalle ? leerCondicionada(linea, especies, textoDetalle) : null;
  const destino = conDetalle && /\bdestino\s*:/i.test(textoDetalle) ? [hallazgo(linea, "DESTINO_EN_DETALLE")] : [];
  return {
    reglas: [...principales, ...(condicionada?.reglas ?? [])],
    decisiones,
    noImportados: sinCantidad,
    avisos: [...decision.avisos.map((c) => hallazgo(linea, c)), ...destino, ...(condicionada?.avisos ?? [])],
    bloqueos: condicionada?.bloqueos ?? [],
  };
}

/** Viñeta del bloque del plan: «Reglas: …» se parte en reglas de portafolio; lo demás es una regla LIBRE. */
export function leerVinetaPlan(linea: number, texto: string): LecturaDeFila {
  const plano = textoPlano(texto);
  if (/pendiente\s+de\s+decisi[oó]n/i.test(plano)) return { ...VACIA, noImportados: [hallazgo(linea, "PENDIENTE_DE_DECISION")] };
  const reglas = /^reglas\s*:\s*(.*)$/i.exec(plano);
  if (!reglas) return { ...VACIA, reglas: [reglaDePortafolio(linea, null, "LIBRE", null, plano)] };
  const partes = partirNivelSuperior(reglas[1]!);
  const lecturas = partes.map((parte, i) => leerParteDeReglas(linea, partes.length > 1 ? i + 1 : null, parte));
  return {
    reglas: lecturas.flatMap((l) => l.reglas),
    decisiones: [],
    noImportados: lecturas.flatMap((l) => l.noImportados),
    avisos: [],
    bloqueos: lecturas.flatMap((l) => l.bloqueos),
  };
}

function reglaDePortafolio(linea: number, item: number | null, condicion: CondicionRegla, nivel: string | null, detalle: string): ReglaLeida {
  return { linea, item, especie: null, condicion, nivel, accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle };
}

function leerParteDeReglas(linea: number, item: number | null, parte: string): LecturaDeFila {
  const excepcion = /\(\s*excepci[oó]n/i.test(parte) ? [hallazgo(linea, "EXCEPCION_EN_DETALLE", item)] : [];
  const monto = MONTO_POR_ORDEN.exec(parte);
  if (!monto) return { ...VACIA, reglas: [reglaDePortafolio(linea, item, "LIBRE", null, parte)], noImportados: excepcion };
  const nivel = leerMontoEs(monto[1]!);
  if (nivel === null) return { ...VACIA, bloqueos: [hallazgo(linea, "NIVEL_NO_RECONOCIDO", item)] };
  return { ...VACIA, reglas: [reglaDePortafolio(linea, item, "MONTO_ORDEN_BAJO", nivel, parte)], noImportados: excepcion };
}
