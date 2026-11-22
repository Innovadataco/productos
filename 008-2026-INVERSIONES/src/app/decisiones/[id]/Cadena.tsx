/**
 * La cadena de una decisión (fase B, corte 3): versión del plan → regla → decisión → órdenes con su fila importada →
 * resultado a 30 y 90 días con cada precio y cada dividendo usado. Componente del servidor, sin JavaScript en el
 * navegador. Mide una decisión pasada; no recomienda comprar ni vender.
 */
import { cop, fecha, n, numero } from "../../tablero/formato";
import { Encabezado } from "../../_plan/Encabezado";
import { fechaHora, precio } from "../../_plan/formato";
import { Resultado } from "../../_plan/Resultado";
import { MOTIVOS_SIN_DIVIDENDOS, NOTA_FUENTES, PIE_DIARIO, filaImportada, textoAccionDecision, textoRegla } from "../../_plan/textos";
import type { DatosDecision, DividendoVista, EnlaceVista, HorizonteVista, TramoVista, VistaDecision } from "../../_plan/tipos";
import "../../_plan/plan.css";

const SIN_DATO = "—";
const LADO = { COMPRA: "Compra", VENTA: "Venta" } as const;
/** Lo que escribe la corrección de una decisión al mover sus enlaces (src/plan/decisiones.ts). */
const MOTIVO_CORRECCION = /^correccion:/;

function Pasos({ v }: { readonly v: VistaDecision }) {
  const d = v.decision;
  const ordenes = d.accion === "NO_ACTUAR" ? <>no aplica: «no actuar» no tiene órdenes</> : <a href="#ordenes">{d.ordenes === 1 ? "1 orden enlazada" : `${d.ordenes} órdenes enlazadas`}</a>;
  return (
    <nav className="bloque cadena" aria-label="Cadena de la decisión">
      <ol>
        <li><span className="paso">Plan</span> · <a href={`/plan?version=${v.version.numero}`}>{`versión ${v.version.numero}, desde el ${fecha(v.version.desde)}`}</a></li>
        <li>
          <span className="paso">Regla</span> ·{" "}
          {d.regla ? <a href={`/plan?version=${d.regla.version}#regla-${encodeURIComponent(d.regla.id)}`}>{textoRegla(d.regla.condicion, d.regla.nivel, d.regla.accion)}</a> : "sin regla citada"}
        </li>
        <li aria-current="step"><span className="paso">Decisión</span> · {textoAccionDecision(d.accion, d.excepcion)}</li>
        <li><span className="paso">Órdenes</span> · {ordenes}</li>
        <li><span className="paso">Resultado</span> · {v.horizontes ? <a href="#resultado">a 30 y 90 días</a> : "no se mide (corregida)"}</li>
      </ol>
    </nav>
  );
}

function Decision({ v }: { readonly v: VistaDecision }) {
  const d = v.decision;
  return (
    <section className="bloque" aria-labelledby="t-decision">
      <div className="cabeza"><div><div className="eyebrow">Qué, por qué y cuándo</div><h2 id="t-decision">La decisión</h2></div></div>
      <dl className="pares">
        <dt>Qué</dt><dd>{textoAccionDecision(d.accion, d.excepcion)}</dd>
        <dt>Cantidad</dt><dd>{d.cantidad === null ? SIN_DATO : numero(n(d.cantidad))}</dd>
        <dt>Por qué</dt><dd>{d.motivo}</dd>
        <dt>Fecha</dt><dd>{fecha(d.fecha)}</dd>
        <dt>Registrada</dt><dd>{`${fechaHora(v.registradaEl)} (hora de Colombia)`}</dd>
      </dl>
      {d.corregidaPor ? <p className="nota aviso">{`Esta decisión se corrigió el ${fecha(d.corregidaPor.fecha)}: `}<a href={`/decisiones/${encodeURIComponent(d.corregidaPor.id)}`} aria-label={`ver la corrección del ${fecha(d.corregidaPor.fecha)}`}>ver la corrección</a></p> : null}
      {d.corrige ? <p className="nota">{`Corrige la decisión del ${fecha(d.corrige.fecha)}: `}<a href={`/decisiones/${encodeURIComponent(d.corrige.id)}`} aria-label={`ver la decisión anterior, del ${fecha(d.corrige.fecha)}`}>ver la anterior</a></p> : null}
    </section>
  );
}

const textoEnlace = (e: EnlaceVista): string => {
  const motivo = e.motivo === null ? "" : ` · ${MOTIVO_CORRECCION.test(e.motivo) ? "movido desde la decisión corregida" : e.motivo}`;
  return `Enlace del ${fecha(e.creadoEl)} · ${e.vigente ? "vigente" : "reemplazado"}${motivo}`;
};

function Ordenes({ v }: { readonly v: VistaDecision }) {
  return (
    <section className="bloque" id="ordenes">
      <div className="cabeza"><div><div className="eyebrow">De Trii</div><h2 id="t-ordenes">Órdenes enlazadas</h2></div></div>
      {v.ordenes.length === 0 ? <p className="nota">Todavía no tiene órdenes enlazadas.</p> : (
        <div className="tabla" role="region" aria-labelledby="t-ordenes" tabIndex={0}>
          <table aria-labelledby="t-ordenes" className="angosta">
            <thead><tr><th scope="col">Fecha</th><th scope="col">Operación</th><th scope="col" className="num">Cantidad</th><th scope="col" className="num">Total con comisión</th><th scope="col">Fila importada</th></tr></thead>
            <tbody>
              {v.ordenes.map((o) => (
                <tr key={o.id}>
                  <th scope="row">{fecha(o.fecha)}</th><td className="texto">{LADO[o.lado]}</td><td className="num">{numero(n(o.cantidad))}</td>
                  <td className="num">{cop(n(o.totalEstimado))}</td><td className="texto">{filaImportada(o.filaNo, o.cargadaEl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {v.enlaces.length > 0 ? <ul className="lista">{v.enlaces.map((e) => <li key={e.id}>{textoEnlace(e)}</li>)}</ul> : null}
    </section>
  );
}

const cierre = (c: TramoVista["precioBase"]): string => (c === null ? SIN_DATO : `${precio(c.precio)} · ${fecha(c.fecha)}`);

function celdaDividendos(t: TramoVista): string {
  if (t.dividendos === null) return SIN_DATO;
  return t.dividendos.medible ? cop(n(t.dividendos.total), true) : "no se pudieron medir";
}

const textoDividendo = (u: DividendoVista): string =>
  `Pagado el ${fecha(u.fechaPago)}: ${cop(n(u.montoNeto))} netos sobre ${numero(n(u.tenencia))} acciones (${precio(u.porAccion)} por acción) → ${cop(n(u.atribuido))}`;

function Dividendos({ tramos }: { readonly tramos: readonly TramoVista[] }) {
  const lineas = tramos.flatMap((t) => {
    if (t.dividendos === null) return [];
    if (!t.dividendos.medible) return [`Sin dividendos en el tramo desde el ${fecha(t.desde)}: ${MOTIVOS_SIN_DIVIDENDOS[t.dividendos.motivo]}`];
    return t.dividendos.usados.map(textoDividendo);
  });
  return lineas.length === 0 ? null : <ul className="lista">{lineas.map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}</ul>;
}

function Horizonte({ h }: { readonly h: HorizonteVista }) {
  const id = `t-h${h.dias}`;
  return (
    <div className="horizonte">
      <h3 id={id}>{`A ${h.dias} días`}</h3>
      <Resultado resultado={h.resultado} href={null} />
      {h.tramos.length > 0 ? (
        <div className="tabla" role="region" aria-labelledby={id} tabIndex={0}>
          <table aria-labelledby={id} className="angosta">
            <thead><tr><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col" className="num">Cierre inicial</th><th scope="col" className="num">Cierre final</th><th scope="col" className="num">Precio</th><th scope="col" className="num">Dividendos</th></tr></thead>
            <tbody>
              {h.tramos.map((t, i) => (
                // Lista estática (sin JS en el navegador): dos ejecuciones del mismo día comparten fechas; el índice desempata.
                <tr key={`${t.desde}-${i}`}>
                  <th scope="row">{fecha(t.desde)}</th><td className="texto">{fecha(t.hasta)}</td><td className="num">{cierre(t.precioBase)}</td><td className="num">{cierre(t.precioObjetivo)}</td>
                  <td className="num">{t.resultadoPrecio === null ? SIN_DATO : cop(n(t.resultadoPrecio), true)}</td><td className="num">{celdaDividendos(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Dividendos tramos={h.tramos} />
    </div>
  );
}

function Resultados({ v }: { readonly v: VistaDecision }) {
  return (
    <section className="bloque" id="resultado" aria-labelledby="t-resultado">
      <div className="cabeza"><div><div className="eyebrow">Funcionó o no funcionó</div><h2 id="t-resultado">Resultado a 30 y 90 días</h2></div></div>
      {v.horizontes === null ? <p>No se mide: sus órdenes pasaron a la corrección.</p> : (
        <>
          {v.horizontes.map((h) => <Horizonte key={h.dias} h={h} />)}
          <p className="nota">{NOTA_FUENTES}</p>
        </>
      )}
    </section>
  );
}

/** Las entradas al área de edición: solo el dueño, solo en una decisión vigente; enlaces, no formularios. */
function Entradas({ v }: { readonly v: VistaDecision }) {
  if (v.decision.corregidaPor) return null;
  const id = encodeURIComponent(v.decision.id);
  return (
    <p className="entradas-edicion">
      <a className="entrada-edicion" href={`/edicion/decision?corrige=${id}`}>Corregir esta decisión</a>
      {v.decision.accion === "NO_ACTUAR" ? null : <a className="entrada-edicion" href={`/edicion/enlace?decision=${id}`}>Enlazar una orden de Trii</a>}
    </p>
  );
}

function Contenido({ datos, soloLectura }: { readonly datos: DatosDecision; readonly soloLectura: boolean }) {
  if (datos.estado === "NO_EXISTE") {
    return (
      <section className="hero plan-hero" aria-labelledby="t-hero">
        <div className="eyebrow">Diario de decisiones</div>
        <h1 id="t-hero">No hay una decisión con ese identificador</h1>
        <p><a href="/decisiones">Volver al diario</a></p>
      </section>
    );
  }
  const v = datos.vista;
  return (
    <>
      <section className="hero plan-hero" aria-labelledby="t-hero">
        <div className="eyebrow">Diario de decisiones</div>
        <h1 id="t-hero">{`${textoAccionDecision(v.decision.accion, false)} · ${v.decision.especie} · ${fecha(v.decision.fecha)}`}</h1>
        {soloLectura ? null : <Entradas v={v} />}
      </section>
      <Pasos v={v} />
      <Decision v={v} />
      {v.decision.accion === "NO_ACTUAR" ? null : <Ordenes v={v} />}
      <Resultados v={v} />
    </>
  );
}

export function Cadena({ datos, soloLectura = false }: { readonly datos: DatosDecision; readonly soloLectura?: boolean }) {
  return (
    <>
      <Encabezado actual="decisiones" soloLectura={soloLectura} />
      <main className="wrap plan">
        <Contenido datos={datos} soloLectura={soloLectura} />
        <footer className="pie"><p>{PIE_DIARIO}</p></footer>
      </main>
    </>
  );
}
