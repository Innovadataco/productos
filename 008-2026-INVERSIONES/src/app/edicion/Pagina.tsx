/**
 * El marco de las páginas del área de edición (fase B, PR-B): el encabezado con la sección marcada, el título, el
 * contenido (formulario o aviso) y el pie. Componente del servidor; el formulario es de cliente. Los atajos a la IA y a
 * las tarifas se omiten en el índice /edicion, que ya los lista (`atajos={false}`).
 */
import type { ReactNode } from "react";
import { Encabezado } from "../_plan/Encabezado";
import type { Seccion } from "../tablero/secciones";
import { PIE_EDICION } from "./textos";
import "../_plan/plan.css";
import "./edicion.css";

type Props = {
  readonly seccion: Seccion;
  readonly titulo: string;
  readonly volver: { readonly href: string; readonly texto: string };
  readonly atajos?: boolean;
  readonly children: ReactNode;
};

export function PaginaEdicion({ seccion, titulo, volver, atajos = true, children }: Props) {
  return (
    <>
      {/* Explícito: el área de edición es solo del dueño (exigirDueno en cada página), y ve «Configuración». */}
      <Encabezado actual={seccion} soloLectura={false} />
      <main className="wrap plan edicion">
        <section className="hero plan-hero" aria-labelledby="t-hero">
          <div className="eyebrow">Área de edición · solo el dueño</div>
          <h1 id="t-hero">{titulo}</h1>
          <p><a href={volver.href}>{volver.texto}</a></p>
          {atajos ? <p className="nota"><a href="/edicion/ia">Configuración de la IA</a> · <a href="/edicion/tarifas">Tarifas de comisión</a> · <a href="/edicion/alertas">Alertas</a></p> : null}
        </section>
        <section className="bloque">{children}</section>
      </main>
      {/* Fuera de <main>: así es el landmark contentinfo de la página. */}
      <footer className="wrap plan pie"><p>{PIE_EDICION}</p></footer>
    </>
  );
}
