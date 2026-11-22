/**
 * Encabezado de /operar: la marca, la navegación con «Operar» como actual (después de «Plan») y la marca «Solo lectura»
 * del familiar. Mismo marcado que el encabezado común (src/app/_plan/Encabezado.tsx). Es propio porque «Operar» todavía
 * no está en la lista común de secciones (src/app/tablero/secciones.ts, fuera de la zona de este frente): cuando entre,
 * esta pantalla pasa a `<Encabezado actual="operar" />` y este archivo se borra. Componente del servidor, sin JavaScript.
 */
import { SECCIONES } from "../tablero/secciones";
import { MarcaSoloLectura } from "../tablero/SoloLectura";

interface EnlaceSeccion {
  readonly clave: string;
  readonly texto: string;
  readonly href: string;
}

const OPERAR: EnlaceSeccion = { clave: "operar", texto: "Operar", href: "/operar" };
const SECCIONES_OPERAR: readonly EnlaceSeccion[] = SECCIONES.flatMap((s): EnlaceSeccion[] => (s.clave === "plan" ? [s, OPERAR] : [s]));

export function EncabezadoOperar({ soloLectura }: { readonly soloLectura: boolean }) {
  return (
    <header className="top plan-top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">008</span>Mi portafolio{soloLectura ? <>{" "}<MarcaSoloLectura /></> : null}</div>
        <nav aria-label="Secciones">
          <ul className="secciones">
            {SECCIONES_OPERAR.map((s) => (
              <li key={s.clave}><a href={s.href} aria-current={s.clave === OPERAR.clave ? "page" : undefined}>{s.texto}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
