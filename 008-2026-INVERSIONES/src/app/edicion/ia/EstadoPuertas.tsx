/**
 * El estado de cada puerta (E8), componente del servidor: por requisito, «Listo», «Falta» o «Por verificar» con su
 * explicación. Lo que la app no puede saber sale «por verificar»: por eso ninguna puerta se presenta como lista.
 */
import { ESTADOS_IA, PUERTAS_IA, REQUISITOS_IA, mensajeIa } from "./textos-ia";
import type { EstadoPuertaVista } from "./tipos-ia";

export function EstadoPuertas({ puertas }: { readonly puertas: readonly EstadoPuertaVista[] }) {
  return (
    <section className="ia-bloque" aria-labelledby="t-puertas">
      <h2 id="t-puertas">Estado de las puertas</h2>
      <div className="ia-puertas">
        {puertas.map((p) => (
          <article key={p.puerta} className={`ia-puerta ia-${p.estado.toLowerCase()}`} aria-labelledby={`t-puerta-${p.puerta}`}>
            <h3 id={`t-puerta-${p.puerta}`}>{PUERTAS_IA[p.puerta]}</h3>
            <p className="nota">{`${p.enUso ? "En uso con el modo vigente" : "Sin uso con el modo vigente"} · ${ESTADOS_IA[p.estado]}`}</p>
            <ul className="ia-requisitos">
              {p.requisitos.map((r) => (
                <li key={r.clave}>
                  <span className={`ia-marca ia-${r.estado.toLowerCase()}`}>{ESTADOS_IA[r.estado]}</span>
                  <span>{`${REQUISITOS_IA[r.clave] ?? r.clave}: ${mensajeIa(r.detalle)}`}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
