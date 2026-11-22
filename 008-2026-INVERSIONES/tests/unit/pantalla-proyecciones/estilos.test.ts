// Estilos de la pantalla de proyecciones (frente proyecciones-pantalla): claro y oscuro salen de los tokens del
// tablero (ningún color fijo en la hoja), los controles se usan con el dedo (≥ 44 px) y la animación propia respeta
// «reducir movimiento». Candado sobre el CSS.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../../../src/app/proyecciones/proyecciones.css", import.meta.url)), "utf8");
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("proyecciones.css", () => {
  it("sin colores fijos: todo por los tokens (claro y oscuro los da tablero.css)", () => {
    expect(sinComentarios.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
    expect(sinComentarios).toMatch(/var\(--panel\)/);
  });

  it("los controles para el dedo: botones, deslizadores y el interruptor de al menos 44 px", () => {
    for (const regla of [/\.proy-controles \.g-opcion\s*\{[^}]*min-height:\s*44px/, /\.proy-rango\s*\{[^}]*min-height:\s*44px/, /\.proy-interruptor\s*\{[^}]*min-height:\s*44px/, /\.proy-campo input\[type="number"\]\s*\{[^}]*min-height:\s*44px/]) {
      expect(sinComentarios).toMatch(regla);
    }
  });

  it("contraste de los componentes (WCAG 1.4.11, hallazgo ALTO de a11y-architect): bordes y pistas con --muted, no con --line", () => {
    expect(sinComentarios).toMatch(/\.proy-campo input\[type="number"\]\s*\{[^}]*border:\s*1px solid var\(--muted\)/);
    expect(sinComentarios).toMatch(/\.proy-controles \.g-opcion\s*\{[^}]*border-color:\s*var\(--muted\)/);
    expect(sinComentarios).toMatch(/\.proy-interruptor::before\s*\{[^}]*border:\s*1px solid var\(--muted\)/);
    // La pista del deslizador: lo recorrido en dorado y lo que falta con --muted, por el --relleno del componente.
    expect(sinComentarios).toMatch(/\.proy-rango::-webkit-slider-runnable-track\s*\{[^}]*var\(--gold\) var\(--relleno[^)]*\)[^}]*var\(--muted\)/);
    expect(sinComentarios).toMatch(/\.proy-rango::-moz-range-track\s*\{[^}]*background:\s*var\(--muted\)/);
  });

  it("alto contraste (forced-colors): el botón elegido, el interruptor encendido y los deslizadores se distinguen (hallazgo ALTO de a11y-architect)", () => {
    const bloque = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(sinComentarios)?.[1] ?? "";
    expect(bloque).toMatch(/\.proy-controles \.g-opcion\[aria-pressed="true"\]\s*\{[^}]*forced-color-adjust:\s*none[^}]*background:\s*Highlight[^}]*color:\s*HighlightText/);
    expect(bloque).toMatch(/\.proy-interruptor:checked::after\s*\{[^}]*background:\s*Highlight/);
    expect(bloque).toMatch(/\.proy-rango::-webkit-slider-runnable-track\s*\{[^}]*CanvasText/);
  });

  it("el panel de controles solo queda fijo al bajar si cabe en la ventana (hallazgo MEDIO de a11y-architect)", () => {
    expect(sinComentarios).not.toMatch(/\.proy-controles\s*\{[^}]*position:\s*sticky/);
    expect(sinComentarios).toMatch(/@media \(min-width: 981px\) and \(min-height: 820px\)\s*\{\s*\.proy-controles\s*\{[^}]*position:\s*sticky/);
  });

  it("«Ver los datos» de la gráfica mide 44 px para el dedo (hallazgo MEDIO de a11y-architect)", () => {
    expect(sinComentarios).toMatch(/\.proy-resultado \.g-datos summary\s*\{[^}]*min-height:\s*44px/);
  });

  it("mientras calcula, el gráfico baja poco (la línea sigue ≥ 3:1)", () => {
    expect(sinComentarios).toMatch(/\.proy-resultado\[aria-busy="true"\] \.g-plot\s*\{[^}]*opacity:\s*0\.9[^\d]/);
  });

  it("las bandas con degradado llevan su borde en el tono (los dos percentiles se ven, WCAG 1.4.11; hallazgo MEDIO de a11y-architect)", () => {
    const graficas = readFileSync(fileURLToPath(new URL("../../../src/app/_graficas/graficas.css", import.meta.url)), "utf8");
    expect(graficas).toMatch(/\.g-banda-degradada\s*\{[^}]*stroke:\s*var\(--tono\)[^}]*vector-effect:\s*non-scaling-stroke/);
    expect(graficas).toMatch(/\.g-banda-degradada\.g-banda-suave\s*\{[^}]*opacity:\s*1;[^}]*fill-opacity/);
  });

  it("lo que se mueve va dentro de prefers-reduced-motion: no-preference", () => {
    const fuera = sinComentarios.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    expect(fuera).not.toMatch(/\b(animation|transition)\s*:/);
    expect(sinComentarios).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });
});
