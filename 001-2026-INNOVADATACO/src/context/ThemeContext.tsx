"use client";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

/**
 * Tema de la aplicación (spec 009, T-a del radicado 001-IDC-014).
 *
 * El tema no es estado de React: es **estado del navegador** (`localStorage`),
 * que React solo lee. Por eso se sincroniza con `useSyncExternalStore`, que es
 * la herramienta exacta para eso, en vez de con `useState` + `useEffect`.
 *
 * Antes, el efecto leía `localStorage` al montar y hacía `setTheme`. Funcionaba,
 * pero incumplía §6.2 (`setState` síncrono dentro de un efecto) y el turno
 * anterior lo dejó **declarado** en vez de tocarlo, por no tener con qué probar
 * que un cambio no rompía el tema. Ahora hay red: `ThemeContext.test.tsx`.
 *
 * La razón de que aquel efecto existiera **sigue respetada**: el servidor no
 * tiene `localStorage`, así que `leerEnServidor` devuelve siempre el tema por
 * defecto y el marcado del servidor coincide con el primer render del cliente.
 * React aplica el tema guardado justo después de hidratar, sin desajuste.
 */

const CLAVE = "theme";
const TEMA_POR_DEFECTO = "dark";

/** Oyentes de React; `Set` para no duplicar suscripciones del mismo componente. */
const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  // El evento `storage` solo llega desde OTRAS pestañas. Suscribirse a él hace
  // que cambiar el tema en una pestaña se refleje en las demás, que antes no
  // ocurría: es una mejora que sale gratis del patrón.
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Avisa a esta pestaña; las otras se enteran por el evento `storage`. */
function avisarCambio(): void {
  for (const oyente of oyentes) oyente();
}

/**
 * Instantánea en el cliente. Devuelve un `string`, que React compara por valor:
 * no hace falta memorizarla.
 */
function leerEnCliente(): string {
  return localStorage.getItem(CLAVE) || TEMA_POR_DEFECTO;
}

/** Instantánea en el servidor: no hay navegador, así que siempre el de partida. */
function leerEnServidor(): string {
  return TEMA_POR_DEFECTO;
}

const ThemeContext = createContext({
  theme: TEMA_POR_DEFECTO,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useSyncExternalStore(suscribir, leerEnCliente, leerEnServidor);

  const toggleTheme = useCallback(() => {
    const siguiente = theme === "dark" ? "light" : "dark";
    // Se escribe primero y se avisa después: la fuente de verdad es el
    // navegador, y React vuelve a leerla. No hay estado duplicado que
    // pueda quedar desincronizado.
    localStorage.setItem(CLAVE, siguiente);
    avisarCambio();
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme}>{children}</div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
