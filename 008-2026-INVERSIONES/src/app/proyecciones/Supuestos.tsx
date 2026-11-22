"use client";
/**
 * Los supuestos del escenario en texto llano (frente proyecciones-pantalla): los escribe el motor
 * (src/proyecciones/supuestos.ts: método, ventana histórica, días por especie, dividendos, aportes, caída) con sus
 * avisos (historia corta, años sin calendario…), y la nota de hechos si la historia no empalma con el valor de hoy.
 * Siempre a la vista: nunca una cifra sin sus supuestos.
 */
import type { VistaProyeccion } from "./vista";

export function Supuestos({ vista, nota }: { readonly vista: VistaProyeccion | null; readonly nota: string | null }) {
  return (
    <section className="bloque proy-bloque" aria-labelledby="t-supuestos">
      <div className="cabeza">
        <div><div className="eyebrow">Visibles siempre</div><h2 id="t-supuestos">Supuestos</h2></div>
        {vista ? <div className="meta">Método <b>{vista.versionMetodo}</b></div> : null}
      </div>
      {nota ? <p className="nota aviso">{nota}</p> : null}
      {vista ? (
        <ul className="proy-supuestos">{vista.textos.map((t) => <li key={t}>{t}</li>)}</ul>
      ) : (
        <p className="nota">Los supuestos aparecen con el primer cálculo.</p>
      )}
      {vista && vista.avisos.length > 0 ? (
        <>
          <h3 className="proy-subtitulo">Avisos del cálculo</h3>
          <ul className="proy-avisos">{vista.avisos.map((a) => <li key={`${a.codigo}-${a.texto}`}>{a.texto}</li>)}</ul>
        </>
      ) : null}
    </section>
  );
}
