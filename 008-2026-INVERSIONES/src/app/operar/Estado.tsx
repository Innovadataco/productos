/**
 * «Estado» de /operar: las especies vivas del tablero con su cantidad, su último cierre y su fecha, el valor, el peso y
 * la ganancia o pérdida sin vender, y los totales. La de cierre atrasado lleva su marca. Componente del servidor.
 */
import { cop, fecha, n, numero, pct } from "../tablero/formato";
import { precio } from "../_plan/formato";
import type { EspecieVista, EstadoVista } from "./tipos";

const SIN_DATO = "—";
const DECIMALES_PESO = 1;
const CAPTION = "Estado por especie: cantidad, último cierre, valor, peso y ganancia o pérdida sin vender";

/** La celda de una ganancia o pérdida: el color sigue al signo del TEXTO (lo que redondea a cero no lleva color). */
function CeldaSigno({ texto }: { readonly texto: string }) {
  const tono = texto.startsWith("+") ? " gain" : texto.startsWith("−") ? " loss" : "";
  return <td className={`num${tono}`}>{texto}</td>;
}

function CeldaCierre({ e }: { readonly e: EspecieVista }) {
  if (e.cierre === null) return <td className="texto">sin cierre</td>;
  return (
    <td className="texto">
      <span className={e.atrasado ? "dato aviso" : "dato"}>{`${precio(e.cierre.precio)} · ${fecha(e.cierre.fecha)}`}</span>
      {e.atrasado ? <>{" "}<span className="chip aviso">cierre atrasado</span></> : null}
    </td>
  );
}

function Fila({ e }: { readonly e: EspecieVista }) {
  return (
    <tr>
      <th scope="row">{e.nemo}</th>
      <td className="num">{numero(n(e.cantidad))}</td>
      <CeldaCierre e={e} />
      <td className="num">{e.valor === null ? SIN_DATO : cop(n(e.valor))}</td>
      <td className="num">{e.pesoPct === null ? SIN_DATO : `${numero(n(e.pesoPct), DECIMALES_PESO)} %`}</td>
      <CeldaSigno texto={e.sinVender === null ? SIN_DATO : cop(n(e.sinVender), true)} />
      <CeldaSigno texto={e.sinVenderPct === null ? SIN_DATO : pct(n(e.sinVenderPct))} />
    </tr>
  );
}

function Tabla({ estado }: { readonly estado: EstadoVista }) {
  return (
    <div className="tabla" role="region" aria-label="Estado por especie" tabIndex={0}>
      <table className="angosta">
        <caption className="sr">{CAPTION}</caption>
        <thead>
          <tr>
            <th scope="col">Especie</th><th scope="col" className="num">Cantidad</th><th scope="col">Último cierre</th><th scope="col" className="num">Valor</th>
            <th scope="col" className="num">Peso</th><th scope="col" className="num">Ganancia o pérdida sin vender</th><th scope="col" className="num">Sobre el costo (%)</th>
          </tr>
        </thead>
        <tbody>{estado.especies.map((e) => <Fila key={e.id} e={e} />)}</tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th><td /><td />
            <td className="num">{cop(n(estado.valorAcciones))}</td><td />
            <CeldaSigno texto={cop(n(estado.sinVender), true)} /><td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Notas({ estado, referencia }: { readonly estado: EstadoVista; readonly referencia: string | null }) {
  const sinPrecio = estado.especies.filter((e) => e.cierre === null).map((e) => e.nemo);
  return (
    <>
      {estado.especiesAtrasadas > 0 && referencia !== null
        ? <p className="nota">{`«Cierre atrasado»: su último cierre es anterior al ${fecha(referencia)}; su valor es el de ese día.`}</p>
        : null}
      {sinPrecio.length > 0 ? <p className="nota aviso">{`Sin cierre (no suman al valor): ${sinPrecio.join(" · ")}.`}</p> : null}
      {estado.incompletas.length > 0 ? <p className="nota">{`No entran porque tienen ventas sin asignar: ${estado.incompletas.join(" · ")}.`}</p> : null}
      <p className="nota">Ganancia o pérdida sin vender = valor al último cierre − costo de lo que tiene. Las cifras son las del portafolio.</p>
    </>
  );
}

export function Estado({ estado, referencia }: { readonly estado: EstadoVista; readonly referencia: string | null }) {
  return (
    <section className="bloque" aria-labelledby="t-estado">
      <div className="cabeza"><div><div className="eyebrow">Por especie</div><h2 id="t-estado">Estado</h2></div></div>
      {estado.especies.length === 0 ? <p>No hay especies vivas en el portafolio.</p> : <Tabla estado={estado} />}
      <Notas estado={estado} referencia={referencia} />
    </section>
  );
}
