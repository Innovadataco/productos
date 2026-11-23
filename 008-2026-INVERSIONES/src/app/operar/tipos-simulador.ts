/**
 * Lo que viaja entre el simulador «¿Y si…?» de /operar y POST /api/operar/simular: solo texto ya formateado por el
 * servidor (src/app/operar/serializar-simulacion.ts), así la pantalla de cliente no calcula ni importa el dominio.
 */
import type { VistaAnalisisSimulacion } from "@/operar/analisis/vista";

export interface EspecieSimulable {
  readonly id: string;
  readonly nemotecnico: string;
  /** Acciones de hoy, ya formateadas («3.172»). */
  readonly cantidad: string;
}

export interface FilaSimulada {
  readonly nemotecnico: string;
  readonly operada: boolean;
  readonly cantidadAntes: string;
  readonly cantidadDespues: string;
  readonly pesoAntes: string;
  readonly pesoDespues: string;
}

export type FuenteComision = "TARIFA" | "HISTORIA" | "SIN_HISTORIA";

export interface VistaSimulacion {
  readonly especies: readonly FilaSimulada[];
  readonly valorOrden: string;
  readonly comision: { readonly fuente: FuenteComision; readonly valor: string | null; readonly texto: string };
  readonly cajaAntes: string;
  readonly cajaDespues: string;
  /** De dónde sale la caja de antes. */
  readonly cajaFuente: string;
  readonly valorAccionesAntes: string;
  readonly valorAccionesDespues: string;
  readonly reglas: readonly { readonly texto: string; readonly afectaciones: readonly string[] }[];
  readonly avisos: readonly string[];
  readonly notas: readonly string[];
  /** El análisis del antes y el después; null si no se pudo calcular. */
  readonly analisis: VistaAnalisisSimulacion | null;
}

export type RespuestaSimulacion =
  | { readonly ok: true; readonly vista: VistaSimulacion }
  | { readonly ok: false; readonly errores: readonly string[] };
