// Análisis INVENTADOS armados a mano para probar las observaciones: ids FICTICIA-*, días de 2021 y números raros. Nada
// sale de una base. No es una prueba.
import type { Analisis, AnalisisEspecie, EstadoCierre, ReglaParaAnalisis, ResumenHorizonte } from "@/analisis/tipos";
import { VERSION_ANALISIS } from "@/analisis/tipos";
import { D, dia, sumar } from "./portafolio.ficticio";

export const HOY = "2021-06-15";
export const MAS = (n: number) => sumar(dia(HOY), n).toISOString().slice(0, 10);
export const AL_DIA: EstadoCierre = { estado: "AL_DIA", dia: "2021-06-14", precio: D("1237") };

export const vacio = (h: 30 | 90): ResumenHorizonte => ({
  horizonteDias: h, veredictos: { FUNCIONO: 0, NO_FUNCIONO: 0, NEUTRO: 0 }, sinVeredicto: 0, pendientes: 0, sinPrecio: 0, sinOrden: 0, totalPesos: D(0), sinDividendos: 0, noVerificadas: 0,
});

export const especie = (id: string, cambios: Partial<AnalisisEspecie> = {}): AnalisisEspecie => ({
  instrumentoId: id, nemotecnico: id, valor: D("4613.27"), peso: 0.2, cierre: AL_DIA, historia: { estado: "SIN_CIERRES" }, dividendo12m: null,
  riesgo: { estado: "SIN_VALOR" }, efectoCaida: null, proximaEx: null, ...cambios,
});

export const analisis = (cambios: Partial<Analisis> = {}): Analisis => ({
  version: VERSION_ANALISIS, hoy: HOY, valorAcciones: D("4613.27"), referencia: { dia: "2021-06-14", cargaDetenida: false },
  especies: [], sinTenencia: [], concentracion: null, riesgo: { estado: "SIN_HISTORIA" },
  decisiones: { d30: vacio(30), d90: vacio(90), medidas: [] }, avisos: [], ...cambios,
});

export const regla = (id: string, cambios: Partial<ReglaParaAnalisis> = {}): ReglaParaAnalisis => ({
  id, instrumentoId: "FICTICIA-A", condicion: "NINGUNA", nivel: null, plazoHasta: null, ...cambios,
});

export const concentracion = (primera: number, tres: number, especies: number) => ({
  especies, primera: { instrumentoId: "FICTICIA-A", peso: primera }, tresPrimeras: { instrumentoIds: ["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"].slice(0, especies), peso: tres },
  hhi: 0.3, especiesEfectivas: 3.33333333,
});

export const riesgo = (ids: readonly string[], valores: (number | null)[][]): Analisis["riesgo"] => ({
  estado: "CALCULADO", ventana: { desde: "2020-06-15", hasta: "2021-06-14", ruedas: 251, limitadaPor: null }, factorAnualizacion: 250.12, volatilidadAnual: 0.21,
  fraccionCubierta: 1, correlacion: { ids, valores },
});

export const cubierta = (pesoCubierto: number, contribucionPct: number | null): AnalisisEspecie["riesgo"] => ({
  estado: "CUBIERTA", volatilidadAnual: 0.3, pesoCubierto, contribucion: contribucionPct === null ? null : { marginal: 0.27, contribucion: 0.1, contribucionPct },
});

/** Un análisis que dispara todas las claves del catálogo. */
export function analisisConTodo(): { readonly a: Analisis; readonly reglas: readonly ReglaParaAnalisis[] } {
  const a = analisis({
    referencia: { dia: "2021-06-04", cargaDetenida: true },
    concentracion: concentracion(0.5, 0.9, 4),
    riesgo: riesgo(["FICTICIA-A", "FICTICIA-B"], [[1, 0.93], [0.93, 1]]),
    especies: [
      especie("FICTICIA-B", { riesgo: cubierta(0.3, 0.7), proximaEx: { dia: MAS(3), decretoId: "FICTICIA-DEC-1" } }),
      especie("FICTICIA-A", { riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 }, cierre: { estado: "SIN_CIERRE" } }),
      especie("FICTICIA-C"),
    ],
    decisiones: { d30: vacio(30), d90: vacio(90), medidas: [{ decisionId: "FICTICIA-DEC-A", horizonteDias: 90, veredicto: "NO_FUNCIONO", resultadoPesos: D("-4613.27"), conocidoEl: MAS(-2) }] },
  });
  const reglas = [
    regla("FICTICIA-R1", { instrumentoId: "FICTICIA-C", condicion: "CIERRE_BAJO", nivel: D("1300"), plazoHasta: dia(MAS(-4)) }),
    regla("FICTICIA-R2", { instrumentoId: "FICTICIA-C", condicion: "CIERRE_SOBRE", nivel: D("1261.37"), plazoHasta: dia(MAS(6)) }),
  ];
  return { a, reglas };
}

