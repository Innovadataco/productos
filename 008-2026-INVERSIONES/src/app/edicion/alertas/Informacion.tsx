/** La historia de versiones de los umbrales y el aviso de los valores de fábrica. Del servidor. */
import { TEXTOS_ALERTAS } from "./textos-alertas";
import type { DatosEdicionAlertas } from "./tipos-alertas";

export function Resumen({ datos }: { readonly datos: DatosEdicionAlertas }) {
  return (
    <section className="alertas-bloque" aria-labelledby="t-alertas-resumen">
      <h2 id="t-alertas-resumen">{TEXTOS_ALERTAS.VIGENTES}</h2>
      <p>{TEXTOS_ALERTAS.INTRO}</p>
      {datos.porOmision ? <p className="nota">{TEXTOS_ALERTAS.POR_OMISION}</p> : null}
      <p><a href="/alertas">{TEXTOS_ALERTAS.VER_ALERTAS}</a></p>
    </section>
  );
}

export function Historia({ datos }: { readonly datos: DatosEdicionAlertas }) {
  return (
    <section className="alertas-bloque" aria-labelledby="t-alertas-historia">
      <h2 id="t-alertas-historia">{TEXTOS_ALERTAS.HISTORIA}</h2>
      {datos.historia.length === 0 ? (
        <p className="nota">{TEXTOS_ALERTAS.SIN_HISTORIA}</p>
      ) : (
        <ol className="alertas-historia">
          {datos.historia.map((v) => (
            <li key={v.version}>
              <span className={v.version === datos.guardada ? "alertas-guardada" : undefined}>
                Versión {v.version} · guardada el {v.creada}{v.version === datos.guardada ? ` · ${TEXTOS_ALERTAS.GUARDADA}` : ""}
              </span>
              <p>{v.resumen}</p>
              <p>Motivo: «{v.motivo}»</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
