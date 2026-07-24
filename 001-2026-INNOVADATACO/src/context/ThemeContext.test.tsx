// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { ThemeProvider, useTheme } from "./ThemeContext";

/**
 * Red de seguridad de `ThemeContext` (spec 009, T-a del radicado 001-IDC-014).
 *
 * En el turno anterior este caso se **declaró pendiente** en vez de tocarlo: su
 * `useEffect` es justo lo que evita el desajuste de hidratación, y sin test no
 * había forma de probar que un cambio no rompía el tema del CEO.
 *
 * Estas pruebas fijan el comportamiento **antes** de cambiar la implementación:
 *
 *  1. el servidor pinta SIEMPRE `dark`, aunque el navegador tenga otro tema
 *     guardado — es la propiedad que impide el desajuste;
 *  2. tras montar, el tema guardado se aplica;
 *  3. hidratar no produce ninguna queja de desajuste de React;
 *  4. alternar el tema lo persiste.
 *
 * Son el primer test de componente del proyecto. `vitest.config.ts` ya lo
 * contemplaba: entorno `node` por defecto y `jsdom` declarado por archivo.
 */

function Sonda() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} data-testid="sonda">
      {theme}
    </button>
  );
}

const arbol = (
  <ThemeProvider>
    <Sonda />
  </ThemeProvider>
);

let contenedor: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  contenedor.remove();
  vi.restoreAllMocks();
});

describe("ThemeContext — hidratación (spec 009, T-a)", () => {
  it("el servidor pinta 'dark' aunque el navegador tenga 'light' guardado", () => {
    localStorage.setItem("theme", "light");

    // `renderToString` no ve `localStorage`: es exactamente lo que ocurre en el
    // servidor. Si el marcado dependiera del tema guardado, el HTML del
    // servidor y el del cliente no coincidirían.
    const html = renderToString(arbol);

    expect(html).toContain("dark");
    expect(html).not.toContain(">light<");
  });

  it("hidratar con un tema guardado distinto NO produce queja de desajuste", async () => {
    localStorage.setItem("theme", "light");
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    contenedor.innerHTML = renderToString(arbol);

    await act(async () => {
      root = hydrateRoot(contenedor, arbol);
    });

    const quejas = errores.mock.calls
      .map((args) => String(args[0]))
      .filter((mensaje) => /hydrat|did not match|mismatch/i.test(mensaje));
    expect(quejas).toEqual([]);
  });

  it("tras montar aplica el tema guardado en el navegador", async () => {
    localStorage.setItem("theme", "light");

    await act(async () => {
      root = createRoot(contenedor);
      root.render(arbol);
    });

    expect(contenedor.querySelector("[data-testid=sonda]")?.textContent).toBe("light");
  });

  it("sin nada guardado se queda en 'dark'", async () => {
    await act(async () => {
      root = createRoot(contenedor);
      root.render(arbol);
    });

    expect(contenedor.querySelector("[data-testid=sonda]")?.textContent).toBe("dark");
  });
});

describe("ThemeContext — alternar (spec 009, T-a)", () => {
  it("alterna el tema y lo persiste en el navegador", async () => {
    await act(async () => {
      root = createRoot(contenedor);
      root.render(arbol);
    });

    const sonda = contenedor.querySelector("[data-testid=sonda]") as HTMLButtonElement;
    expect(sonda.textContent).toBe("dark");

    await act(async () => sonda.click());

    expect(sonda.textContent).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("alternar dos veces vuelve al punto de partida", async () => {
    await act(async () => {
      root = createRoot(contenedor);
      root.render(arbol);
    });

    const sonda = contenedor.querySelector("[data-testid=sonda]") as HTMLButtonElement;
    await act(async () => sonda.click());
    await act(async () => sonda.click());

    expect(sonda.textContent).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("el contenedor del proveedor lleva la clase del tema vigente", async () => {
    localStorage.setItem("theme", "light");

    await act(async () => {
      root = createRoot(contenedor);
      root.render(arbol);
    });

    expect(contenedor.querySelector("div.light")).not.toBeNull();
  });
});
