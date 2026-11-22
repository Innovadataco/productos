/**
 * La conciliación ya serializada para la pantalla (texto decimal exacto; el formato va en el componente).
 * Sin encargo, cuenta, titular ni crudo: la lectura (src/conciliacion/leer.ts) ni siquiera los trae.
 */
import type { Procedencia, ProcedenciaCompuesta } from "@/app/_comun/fecha-dato/tipos";
import type { Frescura } from "@/conciliacion/leer";
import type { Estado } from "./motivos";

/** Una especie: cantidad y valor de A&V frente a los del sistema. */
export interface FilaEspecieVista {
  readonly id: string;
  readonly nemo: string;
  readonly cantidadAv: string | null;
  readonly cantidadSistema: string | null;
  readonly diferenciaCantidad: string | null;
  readonly valorAv: string | null;
  readonly valorSistema: string | null;
  /** (A&V − sistema) / |A&V| × 100, con 2 decimales; null si no hay con qué calcularlo. */
  readonly diferenciaPct: string | null;
  /** Si el valor no cuadra por precio: el cierre del sistema y el precio con el que valoró A&V. */
  readonly precios: { readonly cierre: string; readonly precioAv: string } | null;
  readonly estado: Estado;
  /** Las frases del porqué (cantidad primero), sin repetir. */
  readonly porque: readonly string[];
}

/** Total de acciones, un fondo o el efectivo. */
export interface FilaMontoVista {
  readonly id: string;
  readonly etiqueta: string;
  readonly av: string | null;
  readonly sistema: string | null;
  readonly diferencia: string | null;
  readonly diferenciaPct: string | null;
  readonly estado: Estado;
  readonly porque: readonly string[];
}

export interface PorLiquidarVista {
  readonly nemo: string;
  readonly operacion: "Compra" | "Venta" | "Escisión";
  readonly cantidad: string;
  readonly fechaOperacion: string;
  readonly fechaLiquidacion: string;
}

export interface CorteVista {
  readonly fecha: string;
  /** El resultado de su última conciliación en palabras, o «Sin conciliar». */
  readonly texto: string;
  readonly actual: boolean;
}

export interface CuentasVista {
  readonly cuadra: number;
  readonly noCuadra: number;
  readonly porLiquidar: number;
  readonly sinVerificar: number;
}

/**
 * De dónde y de cuándo es cada «Valor sistema» (frente fecha-hora-datos): el cierre o el valor de unidad del corte con
 * que se calculó, por id de la especie o del fondo; el total de acciones, por el cierre más viejo que lo compone.
 */
export interface ProcedenciasVista {
  readonly especies: Readonly<Record<string, Procedencia>>;
  readonly fondos: Readonly<Record<string, Procedencia>>;
  readonly total: ProcedenciaCompuesta | null;
}

export interface ConciliacionVista {
  readonly resultado: Estado;
  /** Día y hora en Colombia: «AAAA-MM-DD HH:MM». */
  readonly calculadaEn: string;
  readonly frescura: Frescura;
  readonly especies: readonly FilaEspecieVista[];
  readonly total: FilaMontoVista | null;
  readonly fondos: readonly FilaMontoVista[];
  readonly efectivo: FilaMontoVista | null;
  readonly cuentas: CuentasVista;
  /** Controles de un tipo que esta pantalla no sabe mostrar (el cálculo v1 no los produce). */
  readonly noReconocidos: number;
  readonly procedencias: ProcedenciasVista;
}

export interface VistaCorte {
  readonly fechaCorte: string;
  /** null: la certificación está cargada pero todavía no se concilió. */
  readonly conciliacion: ConciliacionVista | null;
  readonly porLiquidar: readonly PorLiquidarVista[];
}
