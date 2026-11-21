/**
 * Encabezado de las pantallas del plan y del diario: la marca y la navegación entre secciones, con la actual marcada
 * (`aria-current="page"`). Componente del servidor, sin JavaScript en el navegador.
 */
const SECCIONES = [
  { clave: "portafolio", texto: "Portafolio", href: "/" },
  { clave: "plan", texto: "Plan", href: "/plan" },
  { clave: "decisiones", texto: "Decisiones", href: "/decisiones" },
  { clave: "conciliacion", texto: "Conciliación", href: "/conciliacion" },
] as const;

export type Seccion = (typeof SECCIONES)[number]["clave"];

export function Encabezado({ actual }: { readonly actual: Seccion }) {
  return (
    <header className="top plan-top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">008</span>Mi portafolio</div>
        <nav aria-label="Secciones">
          <ul className="secciones">
            {SECCIONES.map((s) => (
              <li key={s.clave}><a href={s.href} aria-current={s.clave === actual ? "page" : undefined}>{s.texto}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
