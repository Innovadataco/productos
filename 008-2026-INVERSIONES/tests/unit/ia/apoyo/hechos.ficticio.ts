/**
 * Entradas de paquetes de hechos INVENTADAS para las pruebas de `src/ia/`: especies FICTICIA-*, valores no redondos y
 * fechas de 2027. Nada sale de una base ni de datos reales.
 *
 * Las presentaciones salen de `presentar(valor, unidad del catálogo)` (E1b): `construirPaquete` ya no acepta otra. Las
 * exportaciones no cambian (las usan E2, E3 y E4); `entradaReglasConAnclas` es nueva y muestra varias reglas por
 * especie con su ancla (REGLA_DEL_PLAN).
 */
import { CLAVE_ANCLA_REGLA, entradaDeCatalogo, type ClaveDe, type ClaveHecho } from "@/ia/catalogo";
import type { EntradaHecho, EntradaPaquete, IdHecho, TipoResumen } from "@/ia/contrato";
import { presentar } from "@/ia/presentar";

export const HOY_FICTICIO = "2027-03-17";
export const AYER_FICTICIO = "2027-03-16";
export const ESPECIE_ALFA = "FICTICIA-ALFA";
export const ESPECIE_BETA = "FICTICIA-BETA";
export const ESPECIE_GAMMA = "FICTICIA-GAMMA";
export const FUENTE_FICTICIA = "fuente-ficticia";
/** El día desde el que rige el plan inventado de `entradaReglasConAnclas`. */
export const VIGENTE_DESDE_FICTICIO = "2027-02-03";

type Extra<C extends ClaveHecho> = Partial<Omit<EntradaHecho<C>, "id" | "clave" | "valor" | "presentacion">>;

export function hecho<C extends ClaveHecho>(id: IdHecho, clave: C, valor: string, presentacion: string, extra: Extra<C> = {}): EntradaHecho<C> {
  return {
    id,
    clave,
    valor,
    presentacion,
    fuente: FUENTE_FICTICIA,
    fecha: AYER_FICTICIO,
    calidad: "VERIFICADO",
    direccion: "NO_APLICA",
    cercania: "NO_APLICA",
    frescura: "RECIENTE",
    obligatorio: false,
    ...extra,
  };
}

/** Un hecho del tipo con la presentación que da `presentar` para la unidad que el catálogo le pone a la clave. */
function presentado<T extends TipoResumen>(tipo: T) {
  return <C extends ClaveDe<T>>(id: IdHecho, clave: C, valor: string, extra: Extra<C> = {}): EntradaHecho<C> => {
    const entrada = entradaDeCatalogo(tipo, clave);
    if (entrada === null) throw new Error("Clave fuera del catálogo en un apoyo de prueba.");
    return hecho(id, clave, valor, presentar(valor, entrada.unidad), extra);
  };
}

const deDiario = presentado("DIARIO");
const deReglas = presentado("REGLAS");
const deEscenarios = presentado("ESCENARIOS");

export function entradaDiario(): EntradaPaquete<"DIARIO"> {
  return {
    tipo: "DIARIO",
    hoy: HOY_FICTICIO,
    versionesCalculo: { tablero: "tablero-ficticio-v7" },
    avisos: ["AVISO_FICTICIO"],
    hechos: [
      deDiario("H01", "ESPECIE_NOMBRE", ESPECIE_ALFA),
      deDiario("H02", "VALOR_ESPECIE", "4613.27", { sujeto: "H01", direccion: "SUBE" }),
      deDiario("H03", "VALOR_ACCIONES", "37911.47", { direccion: "SUBE", obligatorio: true }),
      deDiario("H04", "GANANCIA_TOTAL", "-1237.53", { direccion: "BAJA", calidad: "CALCULADO" }),
      deDiario("H05", "FECHA_CIERRE_RECIENTE", AYER_FICTICIO),
      deDiario("H06", "ESPECIES_ATRASADAS", "7", { frescura: "ATRASADO", calidad: "ATRASADO" }),
      deDiario("H07", "PESO_ESPECIE", "12.37", { sujeto: "H01", direccion: "IGUAL", frescura: "HOY" }),
    ],
  };
}

export function entradaReglas(): EntradaPaquete<"REGLAS"> {
  return {
    tipo: "REGLAS",
    hoy: HOY_FICTICIO,
    versionesCalculo: { plan: "plan-ficticio-v3" },
    avisos: [],
    hechos: [
      deReglas("H01", "ESPECIE_NOMBRE", ESPECIE_BETA),
      deReglas("H02", "REGLA_NIVEL", "2713.9", { sujeto: "H01" }),
      deReglas("H03", "REGLA_DISTANCIA", "-2.47", { sujeto: "H01", direccion: "BAJA", cercania: "CERCA", obligatorio: true }),
      deReglas("H04", "REGLA_PLAZO", "2027-09-23", { fecha: HOY_FICTICIO }),
      deReglas("H05", "REGLA_DIAS_AL_PLAZO", "190", { cercania: "LEJOS", calidad: "CALCULADO" }),
    ],
  };
}

/**
 * REGLAS con dos reglas de la misma especie y una de portafolio, cada una con su ancla: los hechos de la regla citan
 * al ancla y el ancla cita a la especie (o a nadie). Es la forma que arma `armarReglas`.
 */
export function entradaReglasConAnclas(): EntradaPaquete<"REGLAS"> {
  const vigente = { fecha: HOY_FICTICIO, frescura: "HOY" } as const;
  return {
    tipo: "REGLAS",
    hoy: HOY_FICTICIO,
    versionesCalculo: { plan: "plan-ficticio-v3" },
    avisos: [],
    hechos: [
      deReglas("H01", "ESPECIE_NOMBRE", ESPECIE_BETA, { obligatorio: true }),
      deReglas("H02", CLAVE_ANCLA_REGLA, VIGENTE_DESDE_FICTICIO, { sujeto: "H01", ...vigente }),
      deReglas("H03", "REGLA_NIVEL", "2713.9", { sujeto: "H02", ...vigente }),
      deReglas("H04", "REGLA_DISTANCIA", "-2.47", { sujeto: "H02", direccion: "BAJA", cercania: "CERCA", calidad: "CALCULADO", obligatorio: true }),
      deReglas("H05", CLAVE_ANCLA_REGLA, VIGENTE_DESDE_FICTICIO, { sujeto: "H01", ...vigente }),
      deReglas("H06", "REGLA_NIVEL", "3109.17", { sujeto: "H05", ...vigente }),
      deReglas("H07", "REGLA_TOCADA", AYER_FICTICIO, { sujeto: "H05", direccion: "SUBE", calidad: "CALCULADO", obligatorio: true }),
      deReglas("H08", CLAVE_ANCLA_REGLA, VIGENTE_DESDE_FICTICIO, vigente),
      deReglas("H09", "REGLA_PLAZO", "2027-09-23", { sujeto: "H08", ...vigente }),
      deReglas("H10", "REGLA_DIAS_AL_PLAZO", "190", { sujeto: "H08", calidad: "CALCULADO", ...vigente }),
      deReglas("H11", "PROXIMO_EX_DIVIDENDO", "2027-04-07", { sujeto: "H01", calidad: "NO_VERIFICADO", ...vigente }),
    ],
  };
}

export function entradaEscenarios(): EntradaPaquete<"ESCENARIOS"> {
  return {
    tipo: "ESCENARIOS",
    hoy: HOY_FICTICIO,
    versionesCalculo: { proyecciones: "proyecciones-ficticio-v5" },
    avisos: ["HISTORIA_CORTA"],
    hechos: [
      deEscenarios("H01", "HORIZONTE_CORTO", "3", { calidad: "CALCULADO" }),
      deEscenarios("H02", "ESCENARIO_CENTRAL_CORTO", "41377.19", { direccion: "SUBE", calidad: "ESTIMADO" }),
      deEscenarios("H03", "PROBABILIDAD_BAJO_APORTADO", "17.3", { calidad: "ESTIMADO" }),
      deEscenarios("H04", "ESPECIE_NOMBRE", ESPECIE_GAMMA),
      deEscenarios("H05", "DIAS_HISTORIA_ESPECIE", "417", { sujeto: "H04" }),
    ],
  };
}

export const ENTRADAS_FICTICIAS: { readonly [T in TipoResumen]: () => EntradaPaquete<T> } = {
  DIARIO: entradaDiario,
  REGLAS: entradaReglas,
  ESCENARIOS: entradaEscenarios,
};
