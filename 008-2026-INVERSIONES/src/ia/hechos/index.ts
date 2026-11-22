/**
 * Los armadores de hechos (E1b): la API pública. Cada uno recibe estructuras ya calculadas por 008 y devuelve un
 * PaqueteHechos armado con `construirPaquete` (cierra en fallo con ErrorArmado o ErrorPaquete). Puros: sin base, sin
 * red y sin reloj; `hoy` entra como parámetro. Al modelo solo va la vista ciega del paquete (src/ia/vista-ciega.ts).
 */
export { armarDiario } from "./diario";
export { armarReglas } from "./reglas";
export { armarEscenarios, HORIZONTES_ESCENARIOS } from "./escenarios";
export { CODIGOS_AVISO_ARMADO, FUENTES, VERSION_ARMADORES, type CodigoAvisoArmado } from "./constantes";
export { CODIGOS_ERROR_ARMADO, ErrorArmado, type CodigoErrorArmado } from "./errores";
export { UMBRAL_CERCANIA_REGLA_PCT } from "./derivar";
export type {
  CierreParaReglas, CorteParaHechos, EntradaArmadoDiario, EntradaArmadoEscenarios, EntradaArmadoReglas, FilaParaHechos, FondoParaHechos,
  MovimientoParaHechos, ProximoParaHechos, ReglaParaHechos, ResultadoParaHechos, SerieParaHechos, TableroParaHechos,
} from "./entradas";
export type { DecimalLike } from "./decimal";
