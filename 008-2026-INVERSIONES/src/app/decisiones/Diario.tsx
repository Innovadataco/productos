/**
 * El diario de decisiones (fase B, corte 3). Componente del servidor, sin JavaScript en el navegador. Cada
 * resultado enlaza a la cadena de su decisión y cada regla citada a su fila del plan. Mide decisiones pasadas;
 * no recomienda comprar ni vender.
 */
import { TOPE_DIARIO } from "@/plan/lectura";
import { fecha, n, numero } from "../tablero/formato";
import { Encabezado } from "../_plan/Encabezado";
import { Resultado } from "../_plan/Resultado";
import { PIE_DIARIO, filaImportada, textoAccionDecision, textoConteos, textoRegla } from "../_plan/textos";
import type { DecisionVista, OrdenVista, VistaDiario } from "../_plan/tipos";
import "../_plan/plan.css";

const SIN_DATO = "—";
const LADO = { COMPRA: "Compra", VENTA: "Venta" } as const;

function Fila({ d }: { readonly d: DecisionVista }) {
  const enlace = `/decisiones/${encodeURIComponent(d.id)}`;
  return (
    <tr id={`decision-${d.id}`}>
      <th scope="row">{fecha(d.fecha)}</th>
      <td className="texto">{d.especie}</td>
      <td className="texto">
        <span className="dato">{textoAccionDecision(d.accion, d.excepcion)}</span>
        {d.corrige ? <span className="frase">{`corrige la del ${fecha(d.corrige.fecha)}`}</span> : null}
      </td>
      <td className="num">{d.cantidad === null ? SIN_DATO : numero(n(d.cantidad))}</td>
      <td className="texto">
        {d.regla ? <a href={`/plan?version=${d.regla.version}#regla-${encodeURIComponent(d.regla.id)}`}>{`v${d.regla.version} · ${textoRegla(d.regla.condicion, d.regla.nivel, d.regla.accion)}`}</a> : "sin regla citada"}
      </td>
      <td className="texto">{d.motivo}</td>
      <td className="num">{d.accion === "NO_ACTUAR" ? SIN_DATO : d.ordenes}</td>
      {d.corregidaPor ? (
        <td className="texto" colSpan={2}>
          Corregida:{" "}
          <a href={`/decisiones/${encodeURIComponent(d.corregidaPor.id)}`} aria-label={`ver la corrección del ${fecha(d.corregidaPor.fecha)} (de la decisión del ${fecha(d.fecha)})`}>ver la corrección</a>
        </td>
      ) : (
        <>
          <td className="texto">{d.d30 ? <Resultado resultado={d.d30} href={enlace} /> : SIN_DATO}</td>
          <td className="texto">{d.d90 ? <Resultado resultado={d.d90} href={enlace} /> : SIN_DATO}</td>
        </>
      )}
    </tr>
  );
}

function TablaDecisiones({ vista }: { readonly vista: VistaDiario }) {
  return (
    <div className="tabla" role="region" aria-labelledby="t-decisiones" tabIndex={0}>
      <table aria-labelledby="t-decisiones">
        <thead>
          <tr>
            <th scope="col">Fecha</th><th scope="col">Especie</th><th scope="col">Decidió</th><th scope="col" className="num">Cantidad</th><th scope="col">Regla</th>
            <th scope="col">Motivo</th><th scope="col" className="num">Órdenes</th><th scope="col">A 30 días</th><th scope="col">A 90 días</th>
          </tr>
        </thead>
        <tbody>{vista.decisiones.map((d) => <Fila key={d.id} d={d} />)}</tbody>
      </table>
    </div>
  );
}

function Decisiones({ vista }: { readonly vista: VistaDiario }) {
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">Una por una</div><h2 id="t-decisiones">Decisiones</h2></div></div>
      {vista.decisiones.length === 0 ? <p>Todavía no hay decisiones registradas.</p> : <TablaDecisiones vista={vista} />}
      {vista.truncado ? <p className="nota aviso">{`Se muestran las ${TOPE_DIARIO} decisiones más recientes.`}</p> : null}
    </section>
  );
}

function TablaOrdenes({ ordenes, id }: { readonly ordenes: readonly OrdenVista[]; readonly id: string }) {
  return (
    <div className="tabla" role="region" aria-labelledby={id} tabIndex={0}>
      <table aria-labelledby={id} className="angosta">
        <thead><tr><th scope="col">Fecha</th><th scope="col">Especie</th><th scope="col">Operación</th><th scope="col" className="num">Cantidad</th><th scope="col">Origen</th></tr></thead>
        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id}>
              <th scope="row">{fecha(o.fecha)}</th><td className="texto">{o.especie}</td><td className="texto">{LADO[o.lado]}</td>
              <td className="num">{numero(n(o.cantidad))}</td><td className="texto">{filaImportada(o.filaNo, o.cargadaEl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SinDecision({ vista }: { readonly vista: VistaDiario }) {
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">Trazabilidad</div><h2 id="t-sin-decision">Órdenes sin decisión registrada</h2></div></div>
      {vista.inicioPlan ? <p className="nota">{`Órdenes aprobadas de Trii desde que rige el plan (${fecha(vista.inicioPlan)}) que todavía no están enlazadas a una decisión.`}</p> : null}
      {vista.sinDecision.length > 0 ? <TablaOrdenes ordenes={vista.sinDecision} id="t-sin-decision" /> : <p className="nota">Todas las órdenes desde que rige el plan tienen su decisión.</p>}
      {vista.anteriores.length > 0 ? (
        <details>
          <summary id="t-anteriores">{`${vista.anteriores.length} ${vista.anteriores.length === 1 ? "orden anterior" : "órdenes anteriores"} al plan`}</summary>
          <TablaOrdenes ordenes={vista.anteriores} id="t-anteriores" />
        </details>
      ) : null}
    </section>
  );
}

function Filtro({ vista }: { readonly vista: VistaDiario }) {
  if (vista.filtroInvalido) return <p className="nota aviso" role="status">No hay una regla con ese identificador; se muestran todas las decisiones.</p>;
  if (!vista.filtro) return null;
  const de = vista.filtro.especie ? `de ${vista.filtro.especie}` : "de portafolio";
  return <p className="nota">{`Decisiones que citan la regla ${de} de la versión ${vista.filtro.version}. `}<a href="/decisiones">Ver todas las decisiones</a></p>;
}

export function Diario({ vista }: { readonly vista: VistaDiario }) {
  return (
    <>
      <Encabezado actual="decisiones" />
      <main className="wrap plan">
        <section className="hero plan-hero" aria-labelledby="t-hero">
          <div className="eyebrow">Plan de inversión</div>
          <h1 id="t-hero">Diario de decisiones</h1>
          <p className="resumen-horizonte">{textoConteos(30, vista.resumen.d30)}</p>
          <p className="resumen-horizonte">{textoConteos(90, vista.resumen.d90)}</p>
          <Filtro vista={vista} />
        </section>
        <Decisiones vista={vista} />
        <SinDecision vista={vista} />
        <footer className="pie"><p>{PIE_DIARIO}</p></footer>
      </main>
    </>
  );
}
