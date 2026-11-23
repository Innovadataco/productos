/**
 * Vista de /operar (frente operar-informe), ya serializada: fechas «AAAA-MM-DD» y cifras en texto decimal exacto, con
 * la misma forma del informe (src/operar/informe/tipos.ts). El formato (pesos, fechas en palabras) va en textos.ts y en
 * los componentes.
 */
import type { EspecieSimulable } from "./tipos-simulador";
import type { AccionPlan, CondicionRegla, TipoDividendo } from "@prisma/client";
import type { GrupoRegla } from "@/operar/informe/tipos";

export interface CierreVista {
  readonly precio: string;
  readonly fecha: string;
}

export interface EspecieVista {
  readonly id: string;
  readonly nemo: string;
  readonly cantidad: string;
  readonly cierre: CierreVista | null;
  readonly valor: string | null;
  readonly pesoPct: string | null;
  readonly sinVender: string | null;
  readonly sinVenderPct: string | null;
  readonly atrasado: boolean;
}

export interface EstadoVista {
  readonly especies: readonly EspecieVista[];
  readonly valorAcciones: string;
  readonly sinVender: string;
  readonly especiesAtrasadas: number;
  readonly incompletas: readonly string[];
}

export type EstadoReglaVista =
  | { readonly tipo: "TOCADA"; readonly lado: "BAJO" | "SOBRE"; readonly cierre: CierreVista }
  | { readonly tipo: "EN_EL_NIVEL"; readonly cierre: CierreVista }
  | { readonly tipo: "A_DISTANCIA"; readonly distanciaPct: string; readonly cierre: CierreVista }
  | { readonly tipo: "SIN_CIERRE_AL_DIA"; readonly ultimo: CierreVista | null }
  | { readonly tipo: "POR_ORDEN" }
  | { readonly tipo: "POSTURA" }
  | { readonly tipo: "SIN_ESPECIE" }
  | { readonly tipo: "SIN_NIVEL" };

export interface ReglaOperarVista {
  readonly id: string;
  readonly especie: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: string | null;
  readonly accion: AccionPlan;
  readonly cantidad: string | null;
  readonly plazo: string | null;
  readonly plazoVencido: boolean;
  readonly detalle: string;
  readonly estado: EstadoReglaVista;
  readonly grupo: GrupoRegla;
}

export interface ReglasVista {
  readonly version: { readonly numero: number; readonly desde: string } | null;
  readonly seCumplen: readonly ReglaOperarVista[];
  readonly cercanas: readonly ReglaOperarVista[];
  readonly resto: readonly ReglaOperarVista[];
}

export type FechaVista =
  | {
      readonly tipo: "EX_DIVIDENDO"; readonly fecha: string; readonly id: string; readonly especie: string | null;
      readonly tipoDividendo: TipoDividendo; readonly cuota: number; readonly valorPorAccion: string; readonly fechaPago: string; readonly tenencia: string;
    }
  | {
      readonly tipo: "PLAZO"; readonly fecha: string; readonly id: string; readonly especie: string | null;
      readonly accion: AccionPlan; readonly cantidad: string | null; readonly condicion: CondicionRegla; readonly nivel: string | null;
    };

export interface VistaOperar {
  readonly hoy: string;
  readonly hasta: string;
  readonly referencia: string | null;
  readonly preciosAtrasados: boolean;
  readonly estado: EstadoVista;
  readonly reglas: ReglasVista;
  readonly fechas: readonly FechaVista[];
  /** Las especies del simulador «¿Y si…?» (vivas y cerradas); sin el campo, la sección no se muestra. */
  readonly especies?: readonly EspecieSimulable[];
}
