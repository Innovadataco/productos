/**
 * Módulo de gráficas reutilizable (frente graficas-tablero): SVG + React propio, sin dependencias, animación con CSS
 * y requestAnimationFrame. Lo usan el tablero y, después, la pantalla de proyecciones (bandas P5–P95 y P25–P75).
 * Solo importa react y sus propios archivos (candado: tests/unit/graficas/frontera.test.ts).
 */
import "./graficas.css";

export { useHidratado, useMovimientoReducido, useTransicion, useVisible } from "./animacion";
export { Barras } from "./Barras";
export { Dona } from "./Dona";
export { GraficaTiempo } from "./GraficaTiempo";
export { Selector } from "./Selector";
export type {
  Banda, Contra, DiaIso, EtiquetaTiempo, FilaBarra, Formato, OpcionSelector, PropsBarras, PropsDona, PropsGraficaTiempo, PropsSelector,
  Relleno, Segmento, SerieTiempo, Tono, Ventana,
} from "./tipos";
