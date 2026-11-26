import { exigirDueno } from "@/auth/sesion";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { PaginaEdicion } from "./Pagina";
import { TEXTOS_CONFIGURACION } from "./textos";

// Revalida la sesión en cada visita: el rol sale de la base, nunca de una página guardada.
export const dynamic = "force-dynamic";

/** /edicion · el índice de la configuración, solo del dueño (la familia recibe 404). No lee nada más que la sesión. */
export default async function PaginaConfiguracion() {
  try {
    await exigirDueno();
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-indice", error);
    return <SinBase />;
  }
  return (
    <PaginaEdicion seccion="configuracion" titulo={TEXTOS_CONFIGURACION.TITULO} volver={{ href: "/", texto: "Volver al portafolio" }} atajos={false}>
      <ul className="configuracion">
        {TEXTOS_CONFIGURACION.ENTRADAS.map((e) => (
          <li key={e.clave}>
            <a href={e.href} aria-describedby={`para-${e.clave}`}>{e.texto}</a>
            <p className="nota" id={`para-${e.clave}`}>{e.para}</p>
          </li>
        ))}
      </ul>
    </PaginaEdicion>
  );
}
