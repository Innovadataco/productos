/**
 * El marco de las páginas del área de edición (fase B, PR-B): el encabezado con la sección marcada, el título, el
 * contenido (formulario o aviso) y el pie. Componente del servidor; el formulario es de cliente.
 */
import type { ReactNode } from "react";
import { Encabezado } from "../_plan/Encabezado";
import type { Seccion } from "../tablero/secciones";
import { PIE_EDICION } from "./textos";
import "../_plan/plan.css";
import "./edicion.css";

type Props = { readonly seccion: Seccion; readonly titulo: string; readonly volver: { readonly href: string; readonly texto: string }; readonly children: ReactNode };

export function PaginaEdicion({ seccion, titulo, volver, children }: Props) {
  return (
    <>
      <Encabezado actual={seccion} />
      <main className="wrap plan edicion">
        <section className="hero plan-hero" aria-labelledby="t-hero">
          <div className="eyebrow">Área de edición · solo el dueño</div>
          <h1 id="t-hero">{titulo}</h1>
          <p><a href={volver.href}>{volver.texto}</a></p>
          <p className="nota"><a href="/edicion/ia">Configuración de la IA</a> · <a href="/edicion/tarifas">Tarifas de comisión</a></p>
        </section>
        <section className="bloque">{children}</section>
      </main>
      {/* Fuera de <main>: así es el landmark contentinfo de la página. */}
      <footer className="wrap plan pie"><p>{PIE_EDICION}</p></footer>
    </>
  );
}
