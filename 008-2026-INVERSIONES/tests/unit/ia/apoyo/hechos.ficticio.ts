/**
 * Entradas de paquetes de hechos INVENTADAS para las pruebas de `src/ia/`: especies FICTICIA-*, valores no redondos y
 * fechas de 2027. Nada sale de una base ni de datos reales.
 */
import type { ClaveHecho } from "@/ia/catalogo";
import type { EntradaHecho, EntradaPaquete, IdHecho, TipoResumen } from "@/ia/contrato";

export const HOY_FICTICIO = "2027-03-17";
export const AYER_FICTICIO = "2027-03-16";
export const ESPECIE_ALFA = "FICTICIA-ALFA";
export const ESPECIE_BETA = "FICTICIA-BETA";
export const ESPECIE_GAMMA = "FICTICIA-GAMMA";
export const FUENTE_FICTICIA = "fuente-ficticia";

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

export function entradaDiario(): EntradaPaquete<"DIARIO"> {
  return {
    tipo: "DIARIO",
    hoy: HOY_FICTICIO,
    versionesCalculo: { tablero: "tablero-ficticio-v7" },
    avisos: ["AVISO_FICTICIO"],
    hechos: [
      hecho("H01", "ESPECIE_NOMBRE", ESPECIE_ALFA, ESPECIE_ALFA),
      hecho("H02", "VALOR_ESPECIE", "4613.27", "$ 4.613", { sujeto: "H01", direccion: "SUBE" }),
      hecho("H03", "VALOR_ACCIONES", "37911.47", "$ 37.911", { direccion: "SUBE", obligatorio: true }),
      hecho("H04", "GANANCIA_TOTAL", "-1237.53", "−$ 1.238", { direccion: "BAJA", calidad: "CALCULADO" }),
      hecho("H05", "FECHA_CIERRE_RECIENTE", AYER_FICTICIO, "16-mar-2027"),
      hecho("H06", "ESPECIES_ATRASADAS", "7", "7", { frescura: "ATRASADO", calidad: "ATRASADO" }),
      hecho("H07", "PESO_ESPECIE", "12.37", "12,4 %", { sujeto: "H01", direccion: "IGUAL", frescura: "HOY" }),
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
      hecho("H01", "ESPECIE_NOMBRE", ESPECIE_BETA, ESPECIE_BETA),
      hecho("H02", "REGLA_NIVEL", "2713.9", "$ 2.714", { sujeto: "H01" }),
      hecho("H03", "REGLA_DISTANCIA", "-2.47", "−2,5 %", { sujeto: "H01", direccion: "BAJA", cercania: "CERCA", obligatorio: true }),
      hecho("H04", "REGLA_PLAZO", "2027-09-23", "23-sep-2027", { fecha: HOY_FICTICIO }),
      hecho("H05", "REGLA_DIAS_AL_PLAZO", "190", "190 días", { cercania: "LEJOS", calidad: "CALCULADO" }),
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
      hecho("H01", "HORIZONTE_CORTO", "3", "3 meses", { calidad: "CALCULADO" }),
      hecho("H02", "ESCENARIO_CENTRAL_CORTO", "41377.19", "$ 41.377", { direccion: "SUBE", calidad: "ESTIMADO" }),
      hecho("H03", "PROBABILIDAD_BAJO_APORTADO", "17.3", "17,3 %", { calidad: "ESTIMADO" }),
      hecho("H04", "ESPECIE_NOMBRE", ESPECIE_GAMMA, ESPECIE_GAMMA),
      hecho("H05", "DIAS_HISTORIA_ESPECIE", "417", "417 días", { sujeto: "H04" }),
    ],
  };
}

export const ENTRADAS_FICTICIAS: { readonly [T in TipoResumen]: () => EntradaPaquete<T> } = {
  DIARIO: entradaDiario,
  REGLAS: entradaReglas,
  ESCENARIOS: entradaEscenarios,
};
