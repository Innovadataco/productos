/**
 * Pantalla /analisis (frente analisis-pantalla, A2): el análisis del portafolio, ya en texto (vista.ts). Por especie, el
 * portafolio, sus decisiones y los puntos para revisar, cada uno con su umbral. Componente del servidor: sin estado, sin
 * formularios ni botones (la familia lo ve igual, en solo lectura). Las tablas se desplazan en su caja con el teclado.
 */
import { Encabezado } from "../_plan/Encabezado";
import { FechaDato, FechaDatoCompuesta } from "../_comun/fecha-dato/FechaDato";
import { NOTA_VENTANAS, NOTA_VOLATILIDAD, PIE_ANALISIS, SIN_PUNTOS, TITULO } from "./textos";
import type { VistaAnalisis } from "./vista";
import "../_plan/plan.css";
import "./analisis.css";

type Props = { readonly vista: VistaAnalisis };

function Portada({ vista }: Props) {
  return (
    <section className="hero plan-hero" aria-labelledby="t-hero">
      <div className="eyebrow">{`Hoy, ${vista.hoy}`}</div>
      <h1 id="t-hero">{TITULO}</h1>
      <p>Qué tanto se mueven sus especies, cómo se reparte el riesgo y qué datos cruzan un umbral. Cálculo {vista.version}.</p>
      <p className="an-referencia">
        {vista.referencia}{" "}
        {vista.procedenciaAcciones ? <FechaDatoCompuesta compuesta={vista.procedenciaAcciones} /> : null}
      </p>
      {vista.cargaDetenida ? <p className="nota aviso">{vista.cargaDetenida}</p> : null}
    </section>
  );
}

function Composicion({ vista }: Props) {
  const c = vista.composicion;
  return (
    <div className="an-composicion">
      <h3>Composición</h3>
      <ul>
        {c.filas.map((f) => (
          <li key={f.id}>
            <strong>{f.nombre}</strong>: {f.valor}{f.peso === null ? null : ` · ${f.peso}`}
            {f.procedencia ? <>{" "}<FechaDato procedencia={f.procedencia} etiqueta="Valor de unidad" /></> : null}
          </li>
        ))}
        {c.total === null ? null : <li><strong>Total</strong>: {c.total}</li>}
      </ul>
      {c.sinValor ? <p className="nota aviso">{c.sinValor}</p> : null}
      <p className="nota">{c.nota}</p>
    </div>
  );
}

function PorEspecie({ vista }: Props) {
  return (
    <section className="bloque" aria-labelledby="t-especies">
      <div className="cabeza"><div><div className="eyebrow">Historia propia de cada una</div><h2 id="t-especies">Por especie</h2></div></div>
      {vista.especies.length === 0 ? <p className="nota">Sin especies vivas en el tablero.</p> : (
      <div className="tabla" role="region" aria-label="Por especie" tabIndex={0}>
        <table className="an-ancha">
          <caption className="sr">Por especie: peso, rendimiento total por ventana, volatilidad, caída máxima, dividendo y contribución al riesgo</caption>
          <thead>
            <tr>
              <th scope="col">Especie</th><th scope="col" className="num">Peso</th>
              <th scope="col" className="num">1 mes</th><th scope="col" className="num">3 meses</th><th scope="col" className="num">6 meses</th><th scope="col" className="num">12 meses</th>
              <th scope="col" className="num">{vista.titulos.volatilidad}</th><th scope="col" className="num">Caída máxima</th>
              <th scope="col" className="num">Dividendo sobre precio (12 meses)</th><th scope="col" className="num">Contribución al riesgo</th>
            </tr>
          </thead>
          <tbody>
            {vista.especies.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.nombre}</th><td className="num">{e.peso}</td>
                {e.ventanas.map((t, k) => <td key={k} className="num">{t}</td>)}
                <td className="num">{e.volatilidad}</td><td className="num">{e.caida}</td><td className="num">{e.dividendo}</td><td className="num">{e.contribucion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <p className="nota">{NOTA_VENTANAS}</p>
      <p className="nota">{NOTA_VOLATILIDAD}</p>
    </section>
  );
}

function Matriz({ vista }: Props) {
  const m = vista.portafolio.matriz;
  if (m === null) return <p className="nota">Sin correlación: no hay historia común suficiente.</p>;
  return (
    <div className="tabla" role="region" aria-label="Matriz de correlación" tabIndex={0}>
      <table className="an-matriz">
        <caption className="sr">Matriz de correlación de los retornos diarios de precio</caption>
        <thead><tr><th scope="col">Especie</th>{m.nombres.map((x, k) => <th key={m.ids[k]} scope="col" className="num">{x}</th>)}</tr></thead>
        <tbody>
          {m.filas.map((f) => (
            <tr key={f.id}><th scope="row">{f.nombre}</th>{f.celdas.map((c, k) => <td key={k} className="num">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Portafolio({ vista }: Props) {
  const p = vista.portafolio;
  return (
    <section className="bloque" aria-labelledby="t-portafolio">
      <div className="cabeza"><div><div className="eyebrow">Concentración y riesgo</div><h2 id="t-portafolio">Portafolio</h2></div></div>
      <Composicion vista={vista} />
      <h3>Concentración</h3>
      <ul className="an-lista">{p.concentracion.map((t, k) => <li key={k}>{t}</li>)}</ul>
      <h3>{`${vista.titulos.volatilidad} del portafolio`}</h3>
      <p><strong>{p.volatilidad}</strong>{p.ventana ? ` · ${p.ventana}` : null}{p.cubierta ? ` ${p.cubierta}` : null}</p>
      <h3>Correlación</h3>
      <Matriz vista={vista} />
      <h3>Efecto de una caída</h3>
      <p className="nota">Si cada especie cae como en su mayor caída histórica (las demás quietas), así cambia el valor de las acciones:</p>
      {p.efectos.length === 0
        ? <p className="nota">Sin especies con historia propia.</p>
        : <ul className="an-lista">{p.efectos.map((e) => <li key={e.id}><strong>{e.nombre}</strong>: {e.pesos}{e.fraccion === null ? null : ` (${e.fraccion} del valor de las acciones)`}</li>)}</ul>}
    </section>
  );
}

function Decisiones({ vista }: Props) {
  return (
    <section className="bloque" aria-labelledby="t-decisiones">
      <div className="cabeza"><div><div className="eyebrow">Del diario</div><h2 id="t-decisiones">Sus decisiones</h2></div></div>
      {vista.decisiones.horizontes.map((h) => (
        <div key={h.titulo} className="an-horizonte">
          <h3>{h.titulo}</h3>
          {h.lineas.map((l, k) => <p key={k}>{l}</p>)}
        </div>
      ))}
      {vista.decisiones.truncado ? <p className="nota aviso">{vista.decisiones.truncado}</p> : null}
      <p className="nota">El detalle de cada una está en <a href="/decisiones">Decisiones</a>.</p>
    </section>
  );
}

function Puntos({ vista }: Props) {
  return (
    <section className="bloque" aria-labelledby="t-puntos">
      <div className="cabeza"><div><div className="eyebrow">Datos que cruzan un umbral</div><h2 id="t-puntos">Puntos para revisar</h2></div></div>
      {vista.puntos.length === 0
        ? <p>{SIN_PUNTOS}</p>
        : (
          <ul className="an-puntos">
            {vista.puntos.map((p, k) => <li key={k}><p>{p.texto}</p><p className="an-umbral">{p.umbral}</p></li>)}
          </ul>
        )}
      {vista.avisos.length === 0 ? null : (
        <>
          <h3>Avisos de la historia de precios</h3>
          <ul className="an-lista">{vista.avisos.map((t, k) => <li key={k}>{t}</li>)}</ul>
        </>
      )}
    </section>
  );
}

export function Analisis({ vista, soloLectura = false }: { readonly vista: VistaAnalisis; readonly soloLectura?: boolean }) {
  return (
    <>
      <Encabezado actual="analisis" soloLectura={soloLectura} />
      <main className="wrap plan analisis">
        <Portada vista={vista} />
        <PorEspecie vista={vista} />
        <Portafolio vista={vista} />
        <Decisiones vista={vista} />
        <Puntos vista={vista} />
        <footer className="pie"><p>{PIE_ANALISIS}</p></footer>
      </main>
    </>
  );
}
