/**
 * Lo que /edicion/ia (E8) muestra sin editar, componentes del servidor: el resumen (la versión vigente, la que se acaba
 * de guardar, la lista de PI, el gasto del mes de la nube frente al tope, la llave solo como sí/no y la sonda), lo que
 * no se configura con su razón y la historia de las versiones.
 */
import { AVISOS_IA, FIJOS_IA, TEXTOS_IA, mensajeIa } from "./textos-ia";
import type { DatosEdicionIa, GastoVista, VersionVista } from "./tipos-ia";

function textoGasto(g: GastoVista): string {
  if (g.estado === "NO_VERIFICABLE") return "Gasto de la nube del mes: no se puede verificar (demasiadas corridas). La nube no llama.";
  const tope = g.tope === null ? `(sin tope: ${AVISOS_IA.SIN_TOPE.toLowerCase()})` : `de USD ${g.tope} (tope)`;
  return `Gasto de la nube en ${g.mes}: USD ${g.usado} ${tope} · ${g.corridas} ${g.corridas === 1 ? "corrida" : "corridas"}.`;
}

export function Resumen({ datos }: { readonly datos: DatosEdicionIa }) {
  const { vigente, listaPi, guardada } = datos;
  return (
    <section className="ia-bloque" aria-labelledby="t-resumen">
      <h2 id="t-resumen">Resumen</h2>
      {guardada === null ? null : <p className="nota ia-guardada" role="status">{`Se guardó la versión ${guardada}.`}</p>}
      <p>{TEXTOS_IA.INTRO}</p>
      <ul className="ia-resumen">
        <li>{vigente === null ? "Todavía no hay una versión: la IA está apagada." : `Versión vigente: ${vigente.version}, desde el ${vigente.desde}.`}</li>
        <li>
          {listaPi.estado === "LISTA"
            ? `Lista de modelos de PI: publicada por ${listaPi.publicadoPor ?? "PI"} el ${listaPi.fecha ?? "—"}.`
            : `Lista de modelos de PI: ${mensajeIa(listaPi.detalle)} ${AVISOS_IA.SIN_LISTA}`}
        </li>
        <li>{textoGasto(datos.gasto)} <span className="nota">{TEXTOS_IA.PRECIOS}</span></li>
        <li>{datos.llaveCargada ? TEXTOS_IA.LLAVE_SI : TEXTOS_IA.LLAVE_NO}. <span className="nota">{TEXTOS_IA.LLAVE_NUNCA}</span></li>
        {datos.sonda === "PENDIENTE" ? <li>{AVISOS_IA.SONDA_PENDIENTE}</li> : null}
      </ul>
    </section>
  );
}

export function Fijos() {
  return (
    <section className="ia-bloque" aria-labelledby="t-fijos">
      <h2 id="t-fijos">Lo que no se configura</h2>
      <ul className="ia-fijos">
        {FIJOS_IA.map((f) => <li key={f.que}><strong>{f.que}</strong>{`: ${f.porque}`}</li>)}
      </ul>
    </section>
  );
}

export function Historia({ historia }: { readonly historia: readonly VersionVista[] }) {
  return (
    <section className="ia-bloque" aria-labelledby="t-historia">
      <h2 id="t-historia">Historia de las versiones</h2>
      {historia.length === 0 ? <p className="nota">Todavía no hay versiones.</p> : (
        <ol className="ia-historia" reversed>
          {historia.map((v) => (
            <li key={v.version}>
              <strong>{`Versión ${v.version}`}</strong>{` · ${v.modo} · ${v.fecha} · ${v.autor}`}
              <p>{v.motivo}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
