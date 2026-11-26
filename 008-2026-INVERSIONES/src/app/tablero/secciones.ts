/**
 * Las pantallas de 008, en el orden de la navegación. Una sola lista para el tablero (componente de cliente) y para el
 * encabezado de las pantallas del plan (de servidor): módulo puro, sin imports.
 *
 * «Configuración» (frente menu-configuracion) es solo del dueño: `seccionesVisibles(true)` (la familia, solo lectura)
 * la deja fuera. Es presentación: /edicion le da 404 a la familia igual (exigirDueno, src/auth/sesion.ts).
 */
interface EntradaSeccion {
  readonly clave: string;
  readonly texto: string;
  readonly href: string;
  readonly soloDueno?: true;
}

export const SECCIONES = [
  { clave: "portafolio", texto: "Portafolio", href: "/" },
  { clave: "plan", texto: "Plan", href: "/plan" },
  { clave: "operar", texto: "Operar", href: "/operar" },
  { clave: "decisiones", texto: "Decisiones", href: "/decisiones" },
  { clave: "conciliacion", texto: "Conciliación", href: "/conciliacion" },
  { clave: "proyecciones", texto: "Proyecciones", href: "/proyecciones" },
  { clave: "datos-oficiales", texto: "Datos oficiales", href: "/datos-oficiales" },
  { clave: "analisis", texto: "Análisis", href: "/analisis" },
  { clave: "configuracion", texto: "Configuración", href: "/edicion", soloDueno: true },
] as const satisfies readonly EntradaSeccion[];

export type Seccion = (typeof SECCIONES)[number]["clave"];

const esDeTodos = (s: EntradaSeccion): boolean => s.soloDueno !== true;

/** Las secciones del menú según el rol: la familia (solo lectura) no ve las del dueño. */
export function seccionesVisibles(soloLectura: boolean): readonly (typeof SECCIONES)[number][] {
  return soloLectura ? SECCIONES.filter(esDeTodos) : SECCIONES;
}
