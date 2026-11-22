/**
 * Pantalla de la conciliación con la certificación de A&V (PR-C). Componente del servidor, sin estado ni
 * JavaScript en el navegador: el selector de cortes son enlaces. Textos para el dueño, sin comandos.
 * «A&V» es lo que dice la certificación; «Sistema», lo que calcula 008 con los archivos cargados, al corte.
 */
import type { ReactNode } from "react";
import { FechaDato, FechaDatoCompuesta } from "../_comun/fecha-dato/FechaDato";
import type { Procedencia, ProcedenciaCompuesta } from "../_comun/fecha-dato/tipos";
import { cop, fecha, n, numero } from "../tablero/formato";
import { MarcaSoloLectura } from "../tablero/SoloLectura";
import type { DatosConciliacion } from "./datos";
import type { ConciliacionVista, CorteVista, CuentasVista, FilaEspecieVista, FilaMontoVista, PorLiquidarVista, VistaCorte } from "./tipos";
import "./conciliacion.css";

const SIN_DATO = "—";

const cantidad = (s: string | null): string => (s === null ? SIN_DATO : numero(n(s)));
const cantidadConSigno = (s: string | null): string => (s === null ? SIN_DATO : `${n(s) > 0 ? "+" : ""}${numero(n(s))}`);
const monto = (s: string | null): string => (s === null ? SIN_DATO : cop(n(s)));
const montoConSigno = (s: string | null): string => (s === null ? SIN_DATO : cop(n(s), true));
const porcentaje = (s: string | null): string => (s === null ? SIN_DATO : `${n(s) > 0 ? "+" : ""}${numero(n(s), 2)} %`);

function calculadaEl(enColombia: string): string {
  const [diaIso = "", hora = ""] = enColombia.split(" ");
  return `Calculada el ${fecha(diaIso)} a las ${hora} (hora de Colombia).`;
}

const plural = (k: number, uno: string, varios: string): string => `${k} ${k === 1 ? uno : varios}`;
const textoDeCuentas = (c: CuentasVista): string =>
  [plural(c.cuadra, "cuadra", "cuadran"), plural(c.noCuadra, "no cuadra", "no cuadran"), `${c.porLiquidar} por liquidar`, plural(c.sinVerificar, "no se pudo verificar", "no se pudieron verificar")].join(" · ");

function Encabezado({ soloLectura }: { readonly soloLectura: boolean }) {
  return (
    <header className="top concilia-top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">008</span>Mi portafolio{soloLectura ? <>{" "}<MarcaSoloLectura /></> : null}</div>
        <a className="pill" href="/">Volver al portafolio</a>
      </div>
    </header>
  );
}

function Estado({ estado }: { estado: FilaEspecieVista["estado"] }) {
  return <span className={`estado tono-${estado.tono}`}>{estado.texto}</span>;
}

function Porque({ frases, precios }: { frases: readonly string[]; precios?: FilaEspecieVista["precios"] }) {
  return (
    <td className="porque">
      {frases.map((f) => <span key={f} className="frase">{f}</span>)}
      {precios ? <span className="frase muted">Cierre del sistema {cop(n(precios.cierre))} · precio de A&amp;V {cop(n(precios.precioAv))}</span> : null}
    </td>
  );
}

/**
 * El «Valor sistema» con el dato con que se calculó (frente fecha-hora-datos): el cierre o el valor de unidad del corte,
 * cuándo lo trajo 008 y la fuente; el total, por el cierre más viejo que lo compone. Sin cifra, sin procedencia.
 */
function ValorSistema({ valor, procedencia, compuesta, etiqueta }: {
  valor: string | null; procedencia?: Procedencia; compuesta?: ProcedenciaCompuesta | null; etiqueta: string;
}) {
  return (
    <td className="num">
      {monto(valor)}
      {valor !== null && procedencia ? <FechaDato procedencia={procedencia} etiqueta={etiqueta} /> : null}
      {valor !== null && compuesta ? <FechaDatoCompuesta compuesta={compuesta} /> : null}
    </td>
  );
}

/** La procedencia de un id, solo si es propia del registro (nunca algo heredado del prototipo). */
const deId = (registro: Readonly<Record<string, Procedencia>>, id: string): Procedencia | undefined => (Object.hasOwn(registro, id) ? registro[id] : undefined);

function FilaEspecie({ f, procedencia }: { f: FilaEspecieVista; procedencia?: Procedencia }) {
  return (
    <tr>
      <th scope="row">{f.nemo}</th>
      <td className="num">{cantidad(f.cantidadAv)}</td>
      <td className="num">{cantidad(f.cantidadSistema)}</td>
      <td className="num">{cantidadConSigno(f.diferenciaCantidad)}</td>
      <td className="num">{monto(f.valorAv)}</td>
      <ValorSistema valor={f.valorSistema} procedencia={procedencia} etiqueta="Cierre" />
      <td className="num">{porcentaje(f.diferenciaPct)}</td>
      <td><Estado estado={f.estado} /></td>
      <Porque frases={f.porque} precios={f.precios} />
    </tr>
  );
}

interface PropsFilaMonto {
  f: FilaMontoVista;
  columnas: "acciones" | "montos";
  procedencia?: Procedencia;
  compuesta?: ProcedenciaCompuesta | null;
}

function FilaMonto({ f, columnas, procedencia, compuesta }: PropsFilaMonto) {
  const vacias = columnas === "acciones" ? <><td /><td /><td /></> : null;
  return (
    <tr>
      <th scope="row">{f.etiqueta}</th>
      {vacias}
      <td className="num">{monto(f.av)}</td>
      <ValorSistema valor={f.sistema} procedencia={procedencia} compuesta={compuesta} etiqueta="Valor de unidad" />
      {columnas === "montos" ? <td className="num">{montoConSigno(f.diferencia)}</td> : null}
      <td className="num">{porcentaje(f.diferenciaPct)}</td>
      <td><Estado estado={f.estado} /></td>
      <Porque frases={f.porque} />
    </tr>
  );
}

function TablaAcciones({ c }: { c: ConciliacionVista }) {
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">Una por una</div><h2 id="t-acciones">Acciones</h2></div></div>
      <div className="tabla" role="region" aria-labelledby="t-acciones" tabIndex={0}>
        <table aria-labelledby="t-acciones">
          <thead>
            <tr>
              <th scope="col">Especie</th><th scope="col">Cantidad A&amp;V</th><th scope="col">Cantidad sistema</th><th scope="col">Diferencia</th>
              <th scope="col">Valor A&amp;V</th><th scope="col">Valor sistema</th><th scope="col">Diferencia %</th><th scope="col">Resultado</th><th scope="col">Por qué</th>
            </tr>
          </thead>
          <tbody>{c.especies.map((f) => <FilaEspecie key={f.id} f={f} procedencia={deId(c.procedencias.especies, f.id)} />)}</tbody>
          {c.total ? <tfoot><FilaMonto f={c.total} columnas="acciones" compuesta={c.procedencias.total} /></tfoot> : null}
        </table>
      </div>
    </section>
  );
}

function TablaMontos({ c }: { c: ConciliacionVista }) {
  const filas = [...c.fondos, ...(c.efectivo ? [c.efectivo] : [])];
  if (filas.length === 0) return null;
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">Saldos</div><h2 id="t-montos">Fondo y efectivo</h2></div></div>
      <div className="tabla" role="region" aria-labelledby="t-montos" tabIndex={0}>
        <table aria-labelledby="t-montos" className="angosta">
          <thead>
            <tr>
              <th scope="col">Concepto</th><th scope="col">A&amp;V</th><th scope="col">Sistema</th><th scope="col">Diferencia</th>
              <th scope="col">Diferencia %</th><th scope="col">Resultado</th><th scope="col">Por qué</th>
            </tr>
          </thead>
          <tbody>{filas.map((f, i) => <FilaMonto key={`${f.id}-${i}`} f={f} columnas="montos" procedencia={deId(c.procedencias.fondos, f.id)} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function PorLiquidar({ filas }: { filas: readonly PorLiquidarVista[] }) {
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">T+2</div><h2 id="t-liquidar">Por liquidar al corte</h2></div></div>
      <p className="nota">Operaciones hechas hasta el corte que se liquidan después, según las órdenes que hay hoy en el sistema.</p>
      {filas.length === 0 ? (
        <p className="nota">No hay operaciones por liquidar al corte.</p>
      ) : (
        <div className="tabla" role="region" aria-labelledby="t-liquidar" tabIndex={0}>
          <table aria-labelledby="t-liquidar" className="angosta">
            <thead><tr><th scope="col">Especie</th><th scope="col">Operación</th><th scope="col">Cantidad</th><th scope="col">Fecha de operación</th><th scope="col">Se liquida</th></tr></thead>
            <tbody>
              {/* Lista estática (sin JS en el navegador): el índice desempata dos órdenes partidas idénticas. */}
              {filas.map((p, i) => (
                <tr key={`${p.nemo}-${p.fechaOperacion}-${i}`}>
                  <th scope="row">{p.nemo}</th><td>{p.operacion}</td><td className="num">{cantidad(p.cantidad)}</td><td>{fecha(p.fechaOperacion)}</td><td>{fecha(p.fechaLiquidacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cortes({ cortes }: { cortes: readonly CorteVista[] }) {
  return (
    <nav className="bloque" aria-labelledby="t-cortes">
      <div className="cabeza"><div><div className="eyebrow">Historia</div><h2 id="t-cortes">Otros cortes</h2></div></div>
      <ul className="cortes">
        {cortes.map((c) => (
          <li key={c.fecha}>
            <a href={`/conciliacion?corte=${c.fecha}`} aria-current={c.actual ? "page" : undefined}>{`${fecha(c.fecha)} · ${c.texto}`}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const AVISO_FRESCURA: Readonly<Record<Exclude<ConciliacionVista["frescura"], "AL_DIA">, string>> = {
  DESACTUALIZADA: "Los datos del sistema cambiaron después de este cálculo: el resultado puede no estar al día. Hay que volver a conciliar este corte.",
  NO_SE_PUDO_COMPROBAR: "No se pudo comprobar si está al día. Se muestra lo que se calculó.",
};

function Frescura({ frescura }: { frescura: ConciliacionVista["frescura"] }) {
  if (frescura === "AL_DIA") return <p className="nota">Está al día con los datos que hay hoy en el sistema.</p>;
  return <p className="nota aviso" role="status">{AVISO_FRESCURA[frescura]}</p>;
}

function Portada({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className="hero concilia-hero" aria-labelledby="t-hero">
      <div className="eyebrow">Conciliación con la certificación de A&amp;V</div>
      <h1 id="t-hero">{titulo}</h1>
      {children}
    </section>
  );
}

function Corte({ vista }: { vista: VistaCorte }) {
  const c = vista.conciliacion;
  const titulo = `Corte del ${fecha(vista.fechaCorte)}: ${c ? c.resultado.texto : "sin conciliar"}`;
  return (
    <>
      <Portada titulo={titulo}>
        {c ? (
          <>
            <p className={`resumen tono-${c.resultado.tono}`}>{textoDeCuentas(c.cuentas)}</p>
            <p className="nota">{calculadaEl(c.calculadaEn)}</p>
            <Frescura frescura={c.frescura} />
            <p className="nota">A&amp;V es lo que dice la certificación. Sistema es lo que calcula 008 con los archivos cargados, a la fecha del corte.</p>
            {c.noReconocidos > 0 ? <p className="nota aviso">{`Hay ${plural(c.noReconocidos, "comprobación", "comprobaciones")} que esta pantalla todavía no sabe mostrar.`}</p> : null}
          </>
        ) : (
          <p>La certificación de este corte está cargada, pero todavía no se ha conciliado.</p>
        )}
      </Portada>
      {c ? <><TablaAcciones c={c} /><TablaMontos c={c} /></> : null}
      <PorLiquidar filas={vista.porLiquidar} />
    </>
  );
}

function Contenido({ datos }: { datos: DatosConciliacion }) {
  switch (datos.estado) {
    case "SIN_CERTIFICACION":
      return (
        <Portada titulo="Todavía no hay certificación de A&V">
          <p>Cuando se cargue la certificación de Acciones &amp; Valores, aquí se verá si cuadra con el sistema.</p>
        </Portada>
      );
    case "CORTE_INVALIDO":
      return (
        <>
          <Portada titulo="No hay certificación con esa fecha de corte"><p>Elija uno de los cortes cargados.</p></Portada>
          <Cortes cortes={datos.cortes} />
        </>
      );
    case "CORTE":
      return <><Corte vista={datos.vista} /><Cortes cortes={datos.cortes} /></>;
  }
}

export function Conciliacion({ datos, soloLectura = false }: { readonly datos: DatosConciliacion; readonly soloLectura?: boolean }) {
  return (
    <>
      <Encabezado soloLectura={soloLectura} />
      <main className="wrap concilia">
        <Contenido datos={datos} />
        <footer className="pie">El sistema calcula y muestra; no recomienda comprar ni vender. Datos guardados en este sistema.</footer>
      </main>
    </>
  );
}
