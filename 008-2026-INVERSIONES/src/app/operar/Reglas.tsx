/**
 * «Sus reglas hoy» de /operar: las reglas de la versión vigente en tres grupos (se cumplen o están en el nivel, cerca de
 * su nivel y el resto), cada una con «Su regla … dice …» tal como está en el plan, su estado frente al nivel y su plazo.
 * Los grupos son bloques con su h3, no regiones (la sección del h2 ya lo es). Componente del servidor, sin estado.
 */
import { TITULOS_GRUPO, VACIOS_GRUPO, fraseRegla, textoEstadoRegla, textoPlazoRegla, textoVersion } from "./textos";
import type { ReglaOperarVista, ReglasVista } from "./tipos";

type ClaveGrupo = keyof typeof TITULOS_GRUPO;
const GRUPOS: readonly { readonly clave: ClaveGrupo; readonly id: string; readonly clase: string }[] = [
  { clave: "seCumplen", id: "t-se-cumplen", clase: "op-grupo op-se-cumplen" },
  { clave: "cercanas", id: "t-cercanas", clase: "op-grupo" },
  { clave: "resto", id: "t-resto", clase: "op-grupo" },
];

function Regla({ regla, preciosAtrasados }: { readonly regla: ReglaOperarVista; readonly preciosAtrasados: boolean }) {
  const estado = textoEstadoRegla(regla.estado, preciosAtrasados, regla.plazoVencido, regla);
  return (
    <li className="op-regla">
      <p className="op-frase">{fraseRegla(regla)}</p>
      <p className={estado.aviso ? "op-estado aviso" : "op-estado"}>{estado.principal}</p>
      <p className={regla.plazoVencido ? "op-plazo aviso" : "op-plazo"}>{textoPlazoRegla(regla.plazo, regla.plazoVencido)}</p>
    </li>
  );
}

interface PropsGrupo {
  readonly reglas: ReglasVista;
  readonly grupo: (typeof GRUPOS)[number];
  readonly preciosAtrasados: boolean;
}

function Grupo({ reglas, grupo, preciosAtrasados }: PropsGrupo) {
  const lista = reglas[grupo.clave];
  return (
    <div className={grupo.clase}>
      <h3 id={grupo.id}>{TITULOS_GRUPO[grupo.clave]}</h3>
      {lista.length === 0
        ? <p className="nota">{VACIOS_GRUPO[grupo.clave]}</p>
        : <ul className="op-reglas" role="list">{lista.map((r) => <Regla key={r.id} regla={r} preciosAtrasados={preciosAtrasados} />)}</ul>}
    </div>
  );
}

export function Reglas({ reglas, preciosAtrasados }: { readonly reglas: ReglasVista; readonly preciosAtrasados: boolean }) {
  return (
    <section className="bloque" aria-labelledby="t-reglas">
      <div className="cabeza"><div><div className="eyebrow">Lo que dice su plan</div><h2 id="t-reglas">Sus reglas hoy</h2></div></div>
      <p className="nota">{textoVersion(reglas.version)}{reglas.version ? <>{" "}<a href="/plan">Ver el plan completo</a></> : null}</p>
      {reglas.version ? GRUPOS.map((g) => <Grupo key={g.clave} reglas={reglas} grupo={g} preciosAtrasados={preciosAtrasados} />) : null}
    </section>
  );
}
