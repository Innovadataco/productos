/**
 * Las pantallas de 008, en el orden de la navegación. Una sola lista para el tablero (componente de cliente) y para el
 * encabezado de las pantallas del plan (de servidor): módulo puro, sin imports.
 */
export const SECCIONES = [
  { clave: "portafolio", texto: "Portafolio", href: "/" },
  { clave: "plan", texto: "Plan", href: "/plan" },
  { clave: "decisiones", texto: "Decisiones", href: "/decisiones" },
  { clave: "conciliacion", texto: "Conciliación", href: "/conciliacion" },
  { clave: "proyecciones", texto: "Proyecciones", href: "/proyecciones" },
] as const;

export type Seccion = (typeof SECCIONES)[number]["clave"];
