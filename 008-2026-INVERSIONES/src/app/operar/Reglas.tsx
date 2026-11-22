/**
 * «Sus reglas hoy» de /operar: las reglas de la versión vigente en tres grupos (se cumplen o están en el nivel, cerca de
 * su nivel y el resto), cada una con «Su regla … dice …» tal como está en el plan, su estado frente al nivel y su plazo.
 * Componente del servidor, sin estado.
 */
import { TITULOS_GRUPO, VACIOS_GRUPO, fraseRegla, textoEstadoRegla, textoPlazoRegla, textoVersion } from "./textos";
import type { ReglaOperarVista, ReglasVista } from "./tipos";

type Grupo = keyof typeof TITULOS_GRUPO;
const GRUPOS: readonly { readonly clave: Grupo; readonly id: string }[] = [
  { clave: "seCumplen", id: "t-se-cumplen" },
  { clave: "cercanas", id: "t-cercanas" },
  { clave: "resto", id: "t-resto" },
];

function Regla({ regla, preciosAtrasados }: { readonly regla: ReglaOperarVista; readonly preciosAtrasados: boolean }) {
  const estado = textoEstadoRegla(regla.estado, preciosAtrasados);
  return (
    <li className="op-regla">
      <p className="op-frase">{fraseRegla(regla)}</p>
      <p className={estado.aviso ? "op-estado aviso" : "op-estado"}>{estado.principal}</p>
      <p className={regla.plazoVencido ? "op-plazo aviso" : "op-plazo"}>{textoPlazoRegla(regla.plazo, regla.plazoVencido)}</p>
    </li>
  );
}

function Grupo({ reglas, clave, id, preciosAtrasados }: { readonly reglas: ReglasVista; readonly clave: Grupo; readonly id: string; readonly preciosAtrasados: boolean }) {
  const lista = reglas[clave];
  return (
    <section className={`op-grupo op-${clave}`} aria-labelledby={id}>
      <h3 id={id}>{TITULOS_GRUPO[clave]}</h3>
      {lista.length === 0
        ? <p className="nota">{VACIOS_GRUPO[clave]}</p>
        : <ul className="op-reglas">{lista.map((r) => <Regla key={r.id} regla={r} preciosAtrasados={preciosAtrasados} />)}</ul>}
    </section>
  );
}

export function Reglas({ reglas, preciosAtrasados }: { readonly reglas: ReglasVista; readonly preciosAtrasados: boolean }) {
  return (
    <section className="bloque" aria-labelledby="t-reglas">
      <div className="cabeza"><div><div className="eyebrow">Lo que dice su plan</div><h2 id="t-reglas">Sus reglas hoy</h2></div></div>
      <p className="nota">{textoVersion(reglas.version)}{reglas.version ? <>{" "}<a href="/plan">Ver el plan completo</a></> : null}</p>
      {reglas.version ? GRUPOS.map((g) => <Grupo key={g.clave} reglas={reglas} clave={g.clave} id={g.id} preciosAtrasados={preciosAtrasados} />) : null}
    </section>
  );
}
