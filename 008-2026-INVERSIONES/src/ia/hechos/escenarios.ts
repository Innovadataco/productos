/**
 * Armador ESCENARIOS (E1b): de un ResultadoProyeccion calculado con los parámetros fijos del resumen (horizonte de doce
 * meses), el paquete de hechos de los escenarios. Puro: sin base, sin red y sin reloj (`hoy` entra como parámetro).
 *
 * - P5, P50 y P95 (escenarios bajo, central y alto) y lo aportado a tres, seis y doce meses (plan de la fase E, §3),
 *   en pesos con dos decimales; la dirección de cada escenario es frente al valor de partida.
 * - La probabilidad de quedar bajo lo aportado y la caída máxima mediana (del mes final), la volatilidad y el rendimiento
 *   anual de la ventana y la parte con riesgo modelado, en puntos porcentuales (fracción × 100, cuatro decimales); la
 *   caída, como su magnitud.
 * - La ventana de historia usada y, de cada acción fija por historia corta, sus días de historia.
 * - Los avisos de la proyección van como sus códigos (sin sus textos, que llevan nombres y fechas).
 * - El AVISO fijo («Escenario ilustrativo…») lo pone el código del render (E2): no es un hecho.
 */
import type { ClaveEscenarios } from "../catalogo";
import type { DiaIso, PaqueteHechos } from "../contrato";
import { borrador, cerrarPaquete, conOrigen, hastaHoy, marcasDeHoy, type Marcas } from "./comun";
import { FUENTES } from "./constantes";
import { deEntero, deNumero, exigirDia } from "./decimal";
import { direccionDelSigno, direccionFrente } from "./derivar";
import type { EntradaArmadoEscenarios, ResultadoParaHechos } from "./entradas";
import { ErrorArmado } from "./errores";
import type { BorradorHecho } from "./grupos";

type Borrador = BorradorHecho<ClaveEscenarios>;

/** Meses de cada horizonte (plan de la fase E, §3). El largo es el horizonte de la proyección. */
export const HORIZONTES_ESCENARIOS = Object.freeze({ CORTO: 3, MEDIO: 6, LARGO: 12 } as const);
type Horizonte = keyof typeof HORIZONTES_ESCENARIOS;
const HORIZONTES: readonly Horizonte[] = ["CORTO", "MEDIO", "LARGO"];

const DECIMALES_PESOS = 2;
const DECIMALES_PORCENTAJE = 4;
const CIEN = 100;
const PRIORIDAD = Object.freeze({ PROYECCION: 1, ESPECIES: 2 });

const pesos = (v: number): string => deNumero(v, DECIMALES_PESOS);
const porcentaje = (fraccion: number): string => deNumero(fraccion * CIEN, DECIMALES_PORCENTAJE);

function puntoDe(r: ResultadoParaHechos, mes: number): ResultadoParaHechos["puntos"][number] {
  const punto = r.puntos.find((p) => p.mes === mes);
  if (punto === undefined) throw new ErrorArmado("HORIZONTES_INVALIDOS");
  return punto;
}

function hechosDelHorizonte(r: ResultadoParaHechos, horizonte: Horizonte, inicial: string, m: { readonly calculo: Marcas; readonly estimacion: Marcas }): readonly Borrador[] {
  const punto = puntoDe(r, HORIZONTES_ESCENARIOS[horizonte]);
  const escenario = (clave: ClaveEscenarios, valor: number, obligatorio = false): Borrador => {
    const cifra = pesos(valor);
    return borrador(clave, cifra, FUENTES.PROYECCION, m.estimacion, { direccion: direccionFrente(cifra, inicial), obligatorio });
  };
  return [
    escenario(`ESCENARIO_BAJO_${horizonte}`, punto.p5),
    escenario(`ESCENARIO_CENTRAL_${horizonte}`, punto.p50, true),
    escenario(`ESCENARIO_ALTO_${horizonte}`, punto.p95),
    borrador(`APORTADO_${horizonte}`, pesos(punto.aportado), FUENTES.PROYECCION, m.calculo),
  ];
}

function hechosDeLaHistoria(r: ResultadoParaHechos, hoy: DiaIso, calculo: Marcas): readonly Borrador[] {
  const s = r.supuestos;
  const conValor = (clave: ClaveEscenarios, fraccion: number | null, conDireccion = false): readonly Borrador[] => {
    if (fraccion === null) return [];
    const valor = porcentaje(fraccion);
    return [borrador(clave, valor, FUENTES.PROYECCION, calculo, conDireccion ? { direccion: direccionDelSigno(valor) } : {})];
  };
  const ventana = s.ventana === null ? [] : [
    borrador("VENTANA_DESDE", hastaHoy(exigirDia(s.ventana.desde), hoy), FUENTES.PROYECCION, calculo),
    borrador("VENTANA_HASTA", hastaHoy(exigirDia(s.ventana.hasta), hoy), FUENTES.PROYECCION, calculo),
  ];
  return [
    ...conValor("VOLATILIDAD_ANUAL", s.volatilidadAnualVentana),
    ...conValor("RENDIMIENTO_ANUAL_HISTORICO", s.rendimientoAnualVentana, true),
    ...conValor("FRACCION_PROYECTADA", s.fraccionProyectada),
    ...ventana,
  ];
}

/** El paquete ESCENARIOS, armado con `construirPaquete`. Cierra en fallo con ErrorArmado o ErrorPaquete. */
export function armarEscenarios(e: EntradaArmadoEscenarios): PaqueteHechos<"ESCENARIOS"> {
  const hoy = exigirDia(e.hoy, "HOY_INVALIDO");
  const r = e.resultado;
  if (r.hoy !== hoy) throw new ErrorArmado("HOY_DISTINTO");
  if (r.parametros.horizonteMeses !== HORIZONTES_ESCENARIOS.LARGO) throw new ErrorArmado("HORIZONTES_INVALIDOS");
  const calculo = marcasDeHoy(hoy, "CALCULO");
  const estimacion = conOrigen(calculo, "ESTIMACION");
  const inicial = pesos(r.valorHoy);
  const proyeccion: readonly Borrador[] = [
    borrador("VALOR_INICIAL", inicial, FUENTES.PROYECCION, calculo),
    ...HORIZONTES.map((h) => borrador(`HORIZONTE_${h}`, deEntero(HORIZONTES_ESCENARIOS[h]), FUENTES.PROYECCION, calculo, { obligatorio: true })),
    ...HORIZONTES.flatMap((h) => hechosDelHorizonte(r, h, inicial, { calculo, estimacion })),
    borrador("PROBABILIDAD_BAJO_APORTADO", porcentaje(r.probabilidadBajoAportado), FUENTES.PROYECCION, estimacion, { obligatorio: true }),
    borrador("CAIDA_MAXIMA_MEDIANA", porcentaje(Math.abs(r.caidaMaximaMediana)), FUENTES.PROYECCION, estimacion),
    ...hechosDeLaHistoria(r, hoy, calculo),
  ];
  const cortas = r.supuestos.posiciones.filter((p) => p.tipo === "ACCION" && p.estado === "FIJA_HISTORIA_CORTA");
  const especies = cortas.map((p) => {
    const especie = borrador("ESPECIE_NOMBRE", p.nombre, FUENTES.REGISTRO, marcasDeHoy(hoy, "REGISTRO"));
    const hechos: readonly Borrador[] = [especie, borrador("DIAS_HISTORIA_ESPECIE", deEntero(p.diasTotales), FUENTES.PROYECCION, calculo, { sujeto: especie })];
    return { prioridad: PRIORIDAD.ESPECIES, hechos };
  });
  const avisos = [...new Set(r.supuestos.avisos.map((a) => a.codigo))];
  return cerrarPaquete("ESCENARIOS", hoy, [{ grupos: [{ prioridad: PRIORIDAD.PROYECCION, hechos: proyeccion }, ...especies], avisos: [] }], { proyecciones: r.versionMetodo }, avisos);
}
