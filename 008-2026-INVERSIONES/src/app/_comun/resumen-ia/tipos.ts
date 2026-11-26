/**
 * La tarjeta de resumen (fase E, E5) ya serializada para la pantalla: solo texto, así cruza del servidor a un componente
 * de cliente (el tablero) sin cambiar. La arma `elegirResumen` (elegir.ts) en el servidor; la pantalla no valida nada.
 */
import type { TipoResumen } from "@/ia/contrato";
import type { DiaIso, InstanteColombia } from "../fecha-dato/tipos";

/** IA: el último PUBLICADO (de cualquier día) que volvió a pasar el validador. SIN_IA: la plantilla del paquete de hoy. NO_DISPONIBLE: ninguno. */
export type EstadoResumenIa = "IA" | "SIN_IA" | "NO_DISPONIBLE";
/** Solo con IA: si los hechos de hoy son los mismos con los que se redactó (hash), si cambiaron o si no se pudo saber. */
export type VigenciaResumenIa = "AL_DIA" | "DESACTUALIZADO" | "SIN_COMPROBAR";

export interface CifraVista {
  readonly id: string;
  readonly etiqueta: string;
  readonly presentacion: string;
  readonly fuente: string;
  readonly fecha: DiaIso;
  readonly fechaPresentada: string;
  /** La calidad del dato, en palabras (textos.ts). */
  readonly calidad: string;
}

export interface VistaResumenIa {
  readonly tipo: TipoResumen;
  readonly titulo: string;
  readonly estado: EstadoResumenIa;
  readonly frases: readonly string[];
  /** El aviso fijo del tipo, que pone el validador; null si no hay resumen. */
  readonly aviso: string | null;
  readonly cifras: readonly CifraVista[];
  /** «Redactado por IA … · cifras calculadas por Inversiones y cotejadas», «Resumen sin IA» o el de no disponible. */
  readonly pie: string;
  readonly vigencia: VigenciaResumenIa | null;
  /** Cuándo se redactó (la hora de la base, en Colombia); null sin IA. */
  readonly redactadoEn: InstanteColombia | null;
  /** Por qué no hay resumen; null si lo hay. */
  readonly nota: string | null;
  /** «Análisis de la IA del 25-nov-2026, 19:05»: la fecha y hora del último análisis válido; null sin IA. */
  readonly analisisDel: string | null;
  /** Si el último análisis fue rechazado por el validador: el motivo en palabras simples; null si no. */
  readonly rechazo: string | null;
  /** Solo el dueño, con el interruptor de config_ia encendido: la tarjeta trae el botón «Analizar con IA». */
  readonly puedeAnalizar: boolean;
}
