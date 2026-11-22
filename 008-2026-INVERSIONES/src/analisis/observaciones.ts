/**
 * Puntos para revisar: las observaciones del catálogo cerrado (catalogo.ts) que se cumplen en el análisis y en las
 * reglas vigentes del plan. Puro. Cada una dice qué dato cruzó qué umbral, con los ids que la sostienen.
 * - `hoy` debe ser el día del análisis: un análisis de otro día daría frescuras y plazos falsos.
 * - Las reglas se miden como en /plan: `estadoDelNivel` (src/plan/niveles.ts) solo con el cierre AL_DIA.
 * - De una regla solo se leen su id, su especie, su condición, su nivel y su plazo: la salida se arma con objetos nuevos.
 * - Orden: el del catálogo y, dentro de cada clave, por sus ids.
 */
import { esFechaDeNegocio } from "../plan/fechas";
import { estadoDelNivel } from "../plan/niveles";
import { diaIso } from "../precios/horario";
import {
  CLAVES_OBSERVACION, CONTRIBUCION_MINIMA, DIAS_DECISION_RECIENTE, DIAS_EX_DIVIDENDO_PRONTO, DIAS_REGLA_VENCE_PRONTO, DIAS_REGLA_VENCIDA,
  FACTOR_CONTRIBUCION_DESPROPORCIONADA, MINIMO_ESPECIES_TOP_TRES, UMBRAL_CORRELACION, UMBRAL_PESO_PRIMERA, UMBRAL_PESO_TOP_TRES,
  UMBRAL_REGLA_CERCANA_PCT, CRITERIOS, type Observacion,
} from "./catalogo";
import { diasEntre } from "./dias";
import { compararTexto, redondear } from "./numeros";
import { VERSION_ANALISIS, type Analisis, type EstadoCierre, type PlanParaAnalisis, type ReglaParaAnalisis } from "./tipos";
import { validarPlan } from "./validar";

type Dia = Analisis["hoy"];

const enRango = (dias: number, desde: number, hasta: number): boolean => dias >= desde && dias <= hasta;

function concentracion(a: Analisis): Observacion[] {
  const c = a.concentracion;
  if (c === null) return [];
  const alta: Observacion[] = c.primera.peso > UMBRAL_PESO_PRIMERA ? [{ clave: "CONCENTRACION_ALTA", umbral: CRITERIOS.CONCENTRACION_ALTA.umbral, datos: { ...c.primera } }] : [];
  const tres = c.especies >= MINIMO_ESPECIES_TOP_TRES && c.tresPrimeras.peso > UMBRAL_PESO_TOP_TRES;
  // Con MINIMO_ESPECIES_TOP_TRES (4) o más especies, las tres primeras son exactamente tres.
  const [x, y, z] = c.tresPrimeras.instrumentoIds;
  const top: Observacion[] = tres
    ? [{ clave: "CONCENTRACION_TOP_TRES", umbral: CRITERIOS.CONCENTRACION_TOP_TRES.umbral, datos: { instrumentoIds: [x!, y!, z!], peso: c.tresPrimeras.peso } }]
    : [];
  return [...alta, ...top];
}

function correlacion(a: Analisis): Observacion[] {
  if (a.riesgo.estado !== "CALCULADO") return [];
  const { ids, valores } = a.riesgo.correlacion;
  return ids.flatMap((x, i) =>
    ids.slice(i + 1).flatMap((y, d): Observacion[] => {
      const r = valores[i]![i + 1 + d]!;
      return r !== null && r >= UMBRAL_CORRELACION ? [{ clave: "CORRELACION_ALTA", umbral: CRITERIOS.CORRELACION_ALTA.umbral, datos: { instrumentoIds: [x, y].sort(compararTexto) as [string, string], correlacion: r } }] : [];
    }),
  );
}

function contribucion(a: Analisis): Observacion[] {
  return a.especies.flatMap((e): Observacion[] => {
    if (e.riesgo.estado !== "CUBIERTA" || e.riesgo.contribucion === null) return [];
    const { pesoCubierto } = e.riesgo;
    const pct = e.riesgo.contribucion.contribucionPct;
    // El producto se redondea como las métricas: 1,5 × 0,4 es 0,6000000000000001 en coma flotante.
    if (pct < CONTRIBUCION_MINIMA || pct < redondear(FACTOR_CONTRIBUCION_DESPROPORCIONADA * pesoCubierto)) return [];
    const datos = { instrumentoId: e.instrumentoId, pesoCubierto, contribucionPct: pct, veces: redondear(pct / pesoCubierto) };
    return [{ clave: "CONTRIBUCION_RIESGO_DESPROPORCIONADA", umbral: CRITERIOS.CONTRIBUCION_RIESGO_DESPROPORCIONADA.umbral, datos }];
  });
}

/** El cierre de la especie de la regla, de las vivas y de las sin tenencia. */
function cierres(a: Analisis): ReadonlyMap<string, EstadoCierre> {
  return new Map([...a.especies.map((e) => [e.instrumentoId, e.cierre] as const), ...a.sinTenencia.map((s) => [s.instrumentoId, s.cierre] as const)]);
}

function nivel(r: ReglaParaAnalisis, porEspecie: ReadonlyMap<string, EstadoCierre>): Observacion[] {
  const cierre = r.instrumentoId === null ? undefined : porEspecie.get(r.instrumentoId);
  if (r.instrumentoId === null || cierre?.estado !== "AL_DIA") return [];
  const e = estadoDelNivel(r.condicion, r.nivel, cierre.precio);
  const base = { reglaId: r.id, instrumentoId: r.instrumentoId };
  if (e.estado === "TOCADA") return [{ clave: "REGLA_CUMPLIDA", umbral: CRITERIOS.REGLA_CUMPLIDA.umbral, datos: { ...base, lado: e.lado } }];
  const distancia = e.estado === "EN_EL_NIVEL" ? 0 : e.estado === "A_DISTANCIA" ? e.distanciaPct.toNumber() : null;
  if (distancia === null || Math.abs(distancia) > UMBRAL_REGLA_CERCANA_PCT) return [];
  return [{ clave: "REGLA_CERCANA", umbral: CRITERIOS.REGLA_CERCANA.umbral, datos: { ...base, distanciaPct: redondear(distancia) } }];
}

function plazo(r: ReglaParaAnalisis, hoy: Dia): Observacion[] {
  if (r.plazoHasta === null) return [];
  const dia = diaIso(r.plazoHasta);
  const dias = diasEntre(hoy, dia);
  const base = { reglaId: r.id, instrumentoId: r.instrumentoId, plazo: dia };
  if (enRango(dias, 0, DIAS_REGLA_VENCE_PRONTO)) return [{ clave: "REGLA_VENCE_PRONTO", umbral: CRITERIOS.REGLA_VENCE_PRONTO.umbral, datos: { ...base, dias } }];
  return -dias >= DIAS_REGLA_VENCIDA ? [{ clave: "REGLA_VENCIDA", umbral: CRITERIOS.REGLA_VENCIDA.umbral, datos: { ...base, dias: -dias } }] : [];
}

function precios(a: Analisis): Observacion[] {
  const atrasadas = a.especies.flatMap((e): Observacion[] => {
    if (e.cierre.estado !== "SIN_NEGOCIACION" && e.cierre.estado !== "SIN_CIERRE") return [];
    const ultimoCierre = e.cierre.estado === "SIN_CIERRE" ? null : { dia: e.cierre.dia, sinNegociacionDesde: e.cierre.desde };
    return [{ clave: "PRECIO_ATRASADO", umbral: CRITERIOS.PRECIO_ATRASADO.umbral, datos: { instrumentoId: e.instrumentoId, ultimoCierre } }];
  });
  const carga: Observacion[] = a.referencia?.cargaDetenida ? [{ clave: "PRECIOS_SIN_ACTUALIZAR", umbral: CRITERIOS.PRECIOS_SIN_ACTUALIZAR.umbral, datos: { referencia: a.referencia.dia } }] : [];
  return [...atrasadas, ...carga];
}

function decisiones(a: Analisis): Observacion[] {
  return a.decisiones.medidas.flatMap((m): Observacion[] => {
    const dias = diasEntre(m.conocidoEl, a.hoy);
    if (m.veredicto !== "NO_FUNCIONO" || !enRango(dias, 0, DIAS_DECISION_RECIENTE)) return [];
    const datos = { decisionId: m.decisionId, horizonteDias: m.horizonteDias, resultadoPesos: m.resultadoPesos, conocidoEl: m.conocidoEl, dias };
    return [{ clave: "DECISION_RESULTADO_NEGATIVO", umbral: CRITERIOS.DECISION_RESULTADO_NEGATIVO.umbral, datos }];
  });
}

function especies(a: Analisis): Observacion[] {
  return a.especies.flatMap((e): Observacion[] => {
    const dias = e.proximaEx === null ? -1 : diasEntre(a.hoy, e.proximaEx.dia);
    const ex: Observacion[] = e.proximaEx !== null && enRango(dias, 0, DIAS_EX_DIVIDENDO_PRONTO)
      ? [{ clave: "EX_DIVIDENDO_PRONTO", umbral: CRITERIOS.EX_DIVIDENDO_PRONTO.umbral, datos: { instrumentoId: e.instrumentoId, decretoId: e.proximaEx.decretoId, fechaEx: e.proximaEx.dia, dias } }]
      : [];
    const corta: Observacion[] = e.riesgo.estado === "SIN_HISTORIA"
      ? [{ clave: "HISTORIA_INSUFICIENTE", umbral: CRITERIOS.HISTORIA_INSUFICIENTE.umbral, datos: { instrumentoId: e.instrumentoId, motivo: e.riesgo.motivo, dias: e.riesgo.dias } }]
      : [];
    return [...ex, ...corta];
  });
}

const ORDEN = new Map(CLAVES_OBSERVACION.map((c, i) => [c, i]));
/** Dentro de una clave, por sus datos en texto (los ids van primero en cada clave). */
const claveDe = (o: Observacion): string => JSON.stringify(o.datos);
const porCatalogo = (x: Observacion, y: Observacion): number => ORDEN.get(x.clave)! - ORDEN.get(y.clave)! || compararTexto(claveDe(x), claveDe(y));

export function observaciones(analisis: Analisis, plan: PlanParaAnalisis, hoy: Date): readonly Observacion[] {
  if (!esFechaDeNegocio(hoy)) throw new RangeError("hoy debe ser una fecha de negocio (medianoche UTC).");
  if (diaIso(hoy) !== analisis.hoy) throw new RangeError("hoy debe ser el día del análisis.");
  if (analisis.version !== VERSION_ANALISIS) throw new RangeError(`El análisis es de otra versión (${analisis.version}).`);
  validarPlan(plan);
  const porEspecie = cierres(analisis);
  const reglas = plan.reglas.flatMap((r) => [...nivel(r, porEspecie), ...plazo(r, analisis.hoy)]);
  return [...concentracion(analisis), ...correlacion(analisis), ...contribucion(analisis), ...reglas, ...precios(analisis), ...decisiones(analisis), ...especies(analisis)].sort(porCatalogo);
}
