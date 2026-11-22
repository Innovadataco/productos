/**
 * Entradas INVENTADAS del armador ESCENARIOS (E7): un ResultadoProyeccion con los puntos de tres, seis y doce meses
 * (el bajo, el central y el alto, y lo aportado), la probabilidad de terminar bajo lo aportado, la caída máxima, la
 * ventana de historia (que puede empezar antes de 2022 o faltar) y, a veces, especies fijas por historia corta.
 * Solo los campos que lee el armador. Especies FICTICIA-*.
 *
 * Para que cada caso sea distinto PARA EL MODELO (la vista ciega no trae cifras), el índice fija la forma: cuántas
 * especies de historia corta (0, 1 o 2) y el «perfil» (central que sube, central que baja, rendimiento histórico
 * negativo o sin rendimiento histórico). El resto sale del azar con la semilla.
 */
import type { Prng } from "../../../proyecciones/prng";
import { VERSION_METODO } from "../../../proyecciones/metodo";
import type { EntradaArmadoEscenarios, ResultadoParaHechos } from "../../hechos";
import { dentroDelAnio, elegir, entero, habilDesde, hoyInventado, nombres, noRedondo, real, siQue } from "./comun.ficticio";

const MESES = Object.freeze([0, 3, 6, 12]);
const HORIZONTE_MESES = 12;
const MESES_POR_ANIO = 12;
const DESVIOS_P5_P95 = 1.645;
/** Los pesos van con dos decimales en el paquete: el «no redondo» se mira con esa precisión. */
const DECIMALES_PESOS = 2;
/** Ventanas largas que empiezan antes de 2022 (fuera de la historia real del dueño). */
const INICIOS_LARGOS = Object.freeze(["2019-03-14", "2019-09-17", "2020-06-11", "2021-02-09", "2021-08-24"]);
const PERFILES = Object.freeze(["SUBE", "BAJA", "HISTORIA_NEGATIVA", "SIN_HISTORIA"] as const);
type Perfil = (typeof PERFILES)[number];
const FORMAS_DE_ESPECIES = 3;

const pesos = (v: number): number => noRedondo(v, DECIMALES_PESOS);

function puntos(p: Prng, valorHoy: number, aporte: number, perfil: Perfil): ResultadoParaHechos["puntos"] {
  const rendimiento = perfil === "BAJA" ? real(p, -0.09, -0.02) : real(p, 0.05, 0.13);
  const volatilidad = real(p, 0.09, 0.37);
  return MESES.map((mes) => {
    const t = mes / MESES_POR_ANIO;
    const p50 = valorHoy * (1 + rendimiento * t) + aporte * mes;
    const ancho = DESVIOS_P5_P95 * volatilidad * Math.sqrt(t) * p50;
    return { mes, p5: pesos(p50 - ancho), p50: pesos(p50), p95: pesos(p50 + ancho * real(p, 1.01, 1.3)), aportado: pesos(valorHoy + aporte * mes) };
  });
}

function rendimientoHistorico(p: Prng, perfil: Perfil): number | null {
  if (perfil === "SIN_HISTORIA") return null;
  return Number((perfil === "HISTORIA_NEGATIVA" ? real(p, -0.07, -0.01) : real(p, 0.01, 0.19)).toFixed(4));
}

function supuestos(p: Prng, hoy: string, indice: number, perfil: Perfil): ResultadoParaHechos["supuestos"] {
  const cortas = nombres(p, indice % FORMAS_DE_ESPECIES);
  const desde = siQue(p, 0.75) ? elegir(p, INICIOS_LARGOS) : dentroDelAnio(habilDesde(hoy, -entero(p, 23, 59)));
  return {
    fraccionProyectada: Number(real(p, 0.41, 0.99).toFixed(4)),
    rendimientoAnualVentana: rendimientoHistorico(p, perfil),
    volatilidadAnualVentana: siQue(p, 0.1) ? null : Number(real(p, 0.09, 0.37).toFixed(4)),
    ventana: siQue(p, 0.1) ? null : { desde, hasta: habilDesde(hoy, -1) },
    posiciones: cortas.map((nombre) => ({ nombre, tipo: "ACCION" as const, estado: "FIJA_HISTORIA_CORTA" as const, diasTotales: entero(p, 13, 59) })),
    avisos: [...(cortas.length > 0 ? [{ codigo: "HISTORIA_CORTA" as const }] : []), ...(siQue(p, 0.2) ? [{ codigo: "ANIO_SIN_CALENDARIO" as const }] : [])],
  };
}

/** La entrada ESCENARIOS número `indice` (desde 0), con el azar dado. */
export function entradaEscenariosInventada(p: Prng, indice: number): EntradaArmadoEscenarios {
  const perfil = PERFILES[indice % PERFILES.length] as Perfil;
  const hoy = hoyInventado(p);
  const valorHoy = pesos(real(p, 213_713, 9_713_713));
  const aporte = siQue(p, 0.4) ? pesos(real(p, 13_713, 413_713)) : 0;
  const resultado: ResultadoParaHechos = {
    hoy, valorHoy, versionMetodo: VERSION_METODO, probabilidadBajoAportado: Number(real(p, 0.03, 0.47).toFixed(5)),
    caidaMaximaMediana: Number(real(p, 0.04, 0.31).toFixed(5)), parametros: { horizonteMeses: HORIZONTE_MESES },
    puntos: puntos(p, valorHoy, aporte, perfil), supuestos: supuestos(p, hoy, indice, perfil),
  };
  return { hoy, resultado };
}
