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

  it("lo que se mueve va dentro de prefers-reduced-motion: no-preference", () => {
    const fuera = sinComentarios.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    expect(fuera).not.toMatch(/\b(animation|transition)\s*:/);
    expect(sinComentarios).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });
});
