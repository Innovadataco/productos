/**
 * Pantalla /operar (frente operar-informe, hito O1 de la fase E): el informe para el día de operar, determinista y sin
 * IA. El aviso fijo arriba; después el estado del portafolio, sus reglas hoy, las fechas de los próximos días y el
 * enlace a los escenarios (no se recalculan aquí). Componente del servidor: sin estado, sin formularios ni botones.
 */
import { EncabezadoOperar } from "./EncabezadoOperar";
import { Estado } from "./Estado";
import { Fechas } from "./Fechas";
import { Reglas } from "./Reglas";
import { AVISO_DECISION, PIE_OPERAR, textoDelDia, textoPrecios, textoPreciosAtrasados } from "./textos";
import type { VistaOperar } from "./tipos";
import "../_plan/plan.css";
import "./operar.css";

function Portada({ vista }: { readonly vista: VistaOperar }) {
  return (
    <section className="hero plan-hero" aria-labelledby="t-hero">
      <div className="eyebrow">{textoDelDia(vista.hoy)}</div>
      <h1 id="t-hero">Informe para operar</h1>
      <p>Lo que dice su plan frente a los últimos cierres, el estado de sus especies y las fechas que se acercan.</p>
      {/* Contenido del servidor, presente al cargar: sin región viva (role=status solo anuncia cambios posteriores). */}
      <div className="op-aviso" role="note" aria-label="Aviso">
        <p>{AVISO_DECISION}</p>{" "}
        <p className="op-precios">{textoPrecios(vista.referencia)}</p>
        {vista.preciosAtrasados && vista.referencia ? <>{" "}<p className="aviso">{textoPreciosAtrasados(vista.referencia)}</p></> : null}
      </div>
    </section>
  );
}

function Escenarios() {
  return (
    <section className="bloque" aria-labelledby="t-escenarios">
      <div className="cabeza"><div><div className="eyebrow">Rangos posibles</div><h2 id="t-escenarios">Escenarios</h2></div></div>
      <p>Los rangos de los escenarios están en <a href="/proyecciones">Proyecciones</a>; aquí no se recalculan.</p>
    </section>
  );
}

export function Operar({ vista, soloLectura = false }: { readonly vista: VistaOperar; readonly soloLectura?: boolean }) {
  return (
    <>
      <EncabezadoOperar soloLectura={soloLectura} />
      <main className="wrap plan operar">
        <Portada vista={vista} />
        <Estado estado={vista.estado} referencia={vista.referencia} />
        <Reglas reglas={vista.reglas} preciosAtrasados={vista.preciosAtrasados} />
        <Fechas fechas={vista.fechas} hoy={vista.hoy} hasta={vista.hasta} />
        <Escenarios />
        <footer className="pie"><p>{PIE_OPERAR}</p></footer>
      </main>
    </>
  );
}
