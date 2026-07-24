/**
 * Adaptador de Oportunidades para el tablero Kanban (spec 007, FR-002).
 *
 * Traduce el dominio (estados del catálogo, oportunidades) al contrato genérico
 * de `@/lib/kanban`. La dependencia va en un solo sentido: aquí se conoce el
 * tablero, pero el tablero no conoce esto (RZ-1).
 *
 * Las funciones son puras para que la suite las cubra sin DOM ni BD.
 */
import type { ColumnaKanban, TarjetaKanban } from "./kanban";

/** Estado del catálogo `LicitacionStatus` tal como lo devuelve la API. */
export interface EstadoCatalogo {
  id: number;
  key: string;
  nombreOficial: string;
}

/** Oportunidad tal como la necesita el tablero (subconjunto de `Licitacion`). */
export interface OportunidadTablero {
  id: string;
  titulo: string;
  numero: string | null;
  estadoId: number;
  tipo?: { nombreOficial: string } | null;
}

/**
 * Acento visual por clave de estado. Es PRESENTACIÓN, no reglas: un estado que
 * no esté aquí se pinta con el acento por defecto y aparece igual en el tablero
 * (§0.7 / RZ-2 — añadir un estado al catálogo no exige tocar código).
 */
const ACENTO_POR_KEY: Record<string, string> = {
  "en-proceso": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  abierta: "bg-green-500/20 text-green-400 border-green-500/30",
  cerrada: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  adjudicada: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cancelada: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ACENTO_NEUTRO = "bg-white/5 text-foreground/60 border-white/10";

/**
 * Una columna por estado del catálogo, en el orden en que llega (FR-003).
 * Las columnas NO están cableadas: salen de `LicitacionStatus`.
 */
export function columnasDeEstados(estados: EstadoCatalogo[]): ColumnaKanban[] {
  return estados.map((estado) => ({
    id: String(estado.id),
    titulo: estado.nombreOficial,
    acento: ACENTO_POR_KEY[estado.key] || ACENTO_NEUTRO,
  }));
}

/**
 * Una tarjeta por oportunidad, en la columna de su estado actual (FR-004).
 * Muestra lo esencial para identificarla sin abrirla: título, número y tipo.
 */
export function tarjetasDeOportunidades(oportunidades: OportunidadTablero[]): TarjetaKanban[] {
  return oportunidades.map((op) => ({
    id: op.id,
    columnaId: String(op.estadoId),
    titulo: op.titulo,
    referencia: op.numero || undefined,
    etiqueta: op.tipo?.nombreOficial || undefined,
  }));
}
