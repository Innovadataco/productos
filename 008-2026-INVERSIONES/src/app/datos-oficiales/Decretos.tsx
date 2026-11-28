/**
 * La sección de dividendos decretados de /datos-oficiales (frente datos-oficiales-decretos-pantalla, C6b). Componente del
 * servidor, sin estado ni JavaScript en el navegador. Dos tablas, cada una en una región con nombre que se desplaza con
 * el teclado (a 375 px la tabla es más ancha que la pantalla):
 * - próximos ex-dividendos (C5b, proximos.ts): por decreto, el valor por acción, las fechas, la tenencia y el bruto
 *   ESTIMADO (con una tenencia negativa no se estima), con la referencia oficial y su versión;
 * - el cruce con lo recibido de Trii (C5b, cruce.ts): una fila por grupo (especie y fecha de pago) con sus decretos, el
 *   bruto esperado, el neto de Trii y la «diferencia bruto − neto»; el estado en texto (no solo en color) y por qué. El
 *   pago en disputa va marcado en el estado y en la fila.
 * La referencia oficial es enlace SOLO si es https a la SFC o a la BVC (fuentes.ts, la condición de C1), sin target y
 * sin mandar la página de origen; el radicado de la SFC y lo demás, texto. Sin formularios ni botones: la familia la ve
 * en solo lectura. Ningún texto recomienda comprar ni vender (formato-decretos.ts).
 */
import type { ReactNode } from "react";
import type { TipoDividendo } from "@prisma/client";
import { fecha } from "../tablero/formato";
import { SIN_DATO } from "./formato";
import {
  EXPLICACION_ESTADO, NOTA_BRUTO, NOTA_DIFERENCIA, TEXTO_ESTADO_CRUCE, TEXTO_MOTIVO, acciones, notaVentana, pesos, sinTenencia, tipoYCuota, tipoYCuotaEnFrase,
} from "./formato-decretos";
import { referenciaOficial } from "./fuentes";
import type { DecretoDelCruceVista, DecretosVista, DiaIso, FilaCruceVista, ProximoVista } from "./tipos";

const NO_SE_ESTIMA = "No se estima: la tenencia sale negativa (faltan órdenes cargadas).";
const DESLIZA = "Deslice la tabla hacia los lados para ver todas las columnas.";

/** Las palabras de la sección, en corto, para la familia (revisión a11y-architect de C6b). Informan; no recomiendan nada. */
const GLOSARIO: readonly (readonly [string, string])[] = [
  ["Fecha ex", "Según la regla que usa Inversiones (por verificar), el dividendo es de quien tenía las acciones al cierre del día anterior a esta fecha."],
  ["Tenencia", "Las acciones de la especie que había, contadas por fecha de operación."],
  ["Bruto", "El valor por acción del decreto por la tenencia, antes de cualquier descuento. Es una estimación de Inversiones."],
  ["Neto", "Lo que pagó Trii, según los archivos cargados."],
  ["Cuota", "Un decreto puede pagarse en varias partes; cada cuota tiene su fecha ex y su fecha de pago."],
  ["Revisar", "Algo no cuadra entre los decretos y lo que hay cargado; al lado dice qué."],
];
/** Una columna: su encabezado y si es de cifras (alineada a la derecha, como sus celdas). */
interface Columna {
  readonly titulo: string;
  readonly num?: true;
}
const COLUMNAS_PROXIMOS: readonly Columna[] = [
  { titulo: "Especie" }, { titulo: "Decreto" }, { titulo: "Valor por acción", num: true }, { titulo: "Fecha ex" }, { titulo: "Fecha de pago" },
  { titulo: "Tenencia", num: true }, { titulo: "Bruto estimado", num: true }, { titulo: "Referencia oficial" },
];
const COLUMNAS_CRUCE: readonly Columna[] = [
  { titulo: "Especie" }, { titulo: "Fecha de pago" }, { titulo: "Decretos" }, { titulo: "Bruto esperado (estimado)", num: true }, { titulo: "Neto de Trii", num: true },
  { titulo: "Diferencia bruto − neto", num: true }, { titulo: "Estado" }, { titulo: "Por qué" },
];

interface PropsReferencia {
  readonly texto: string;
  readonly version: number;
  /** De qué decreto es, para el lector de pantalla: «FICTA, ordinario cuota 2». */
  readonly de: string;
}

/** La referencia oficial con su versión: enlace solo si es https de la lista; si no, texto. */
function Referencia({ texto, version, de }: PropsReferencia) {
  const r = referenciaOficial(texto);
  const cual =
    r.tipo === "ENLACE" ? <a href={r.href} rel="noopener noreferrer" referrerPolicy="no-referrer">Referencia oficial<span className="sr"> de {de} (sitio externo)</span></a>
      : r.tipo === "RADICADO" ? <span className="do-radicado">Radicado SFC <span className="do-codigo">{r.radicado}</span></span>
        : <span className="do-codigo">{r.texto}</span>;
  return <>{cual} <span className="do-version">· versión {version}</span></>;
}

const deQue = (especie: string, tipo: TipoDividendo, cuota: number): string => `${especie}, ${tipoYCuotaEnFrase(tipo, cuota)}`;

interface PropsTabla {
  readonly id: string;
  readonly columnas: readonly Columna[];
  readonly children: ReactNode;
}

/** La tabla dentro de una región con el nombre de su título, que se enfoca para desplazarla con las flechas; antes, la pista de deslizar (solo en el celular). */
function Tabla({ id, columnas, children }: PropsTabla) {
  return (
    <>
      <p className="do-nota do-desliza">{DESLIZA}</p>
      <div className="tabla do-tabla" role="region" aria-labelledby={id} tabIndex={0}>
        <table aria-labelledby={id}>
          <thead><tr>{columnas.map((c) => <th key={c.titulo} scope="col" className={c.num ? "num" : undefined}>{c.titulo}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </>
  );
}

function FilaProximo({ p }: { readonly p: ProximoVista }) {
  return (
    <tr>
      <th scope="row">{p.especie}</th>
      <td>{tipoYCuota(p.tipo, p.cuota)}</td>
      <td className="num">{pesos(p.valorPorAccion)}</td>
      <td>{fecha(p.fechaEx)}</td>
      <td>{fecha(p.fechaPago)}</td>
      <td className="num">{acciones(p.tenencia)}</td>
      <td className="num">{p.brutoEstimado === null ? <span className="do-no-estima">{NO_SE_ESTIMA}</span> : pesos(p.brutoEstimado)}</td>
      <td><Referencia texto={p.referencia} version={p.version} de={deQue(p.especie, p.tipo, p.cuota)} /></td>
    </tr>
  );
}

function Proximos({ filas }: { readonly filas: readonly ProximoVista[] }) {
  return (
    <div className="do-bloque">
      <h3 id="t-proximos">Próximos ex-dividendos</h3>
      <p className="do-nota">Decretos vigentes con fecha ex desde hoy, del más cercano al más lejano.</p>
      {filas.length === 0
        ? <p className="do-mensaje do-vacio-proximos">No hay decretos registrados con fecha ex desde hoy.</p>
        : <Tabla id="t-proximos" columnas={COLUMNAS_PROXIMOS}>{filas.map((p) => <FilaProximo key={p.clave} p={p} />)}</Tabla>}
      <p className="do-nota do-nota-bruto">{NOTA_BRUTO}</p>
    </div>
  );
}

function DecretoDelGrupo({ d, especie }: { readonly d: DecretoDelCruceVista; readonly especie: string }) {
  const cuenta = ` · ex ${fecha(d.fechaEx)} · ${pesos(d.valorPorAccion)} por acción × ${acciones(d.tenenciaAntesDeLaEx)} = ${pesos(d.bruto)} · `;
  return (
    <li>
      <span className="do-decreto">{tipoYCuota(d.tipo, d.cuota)}</span>{cuenta}
      <Referencia texto={d.referencia} version={d.version} de={deQue(especie, d.tipo, d.cuota)} />
    </li>
  );
}

function Neto({ f }: { readonly f: FilaCruceVista }) {
  if (f.pagos.length === 0) return <>{pesos(f.netoRecibido)}</>;
  const cuales = f.pagos.length === 1 ? "Pago de Trii" : "Pagos de Trii";
  return <>{pesos(f.netoRecibido)} <span className="do-pagos">{cuales}: {f.pagos.map((p) => fecha(p.fechaPago)).join(", ")}</span></>;
}

function Estado({ f, disputa }: { readonly f: FilaCruceVista; readonly disputa: boolean }) {
  return (
    <>
      <span className="do-cruce-estado" data-estado={f.estado}><span className="sr">Estado del cruce: </span><span className="do-cruce-estado-texto">{TEXTO_ESTADO_CRUCE[f.estado]}</span></span>
      {disputa ? <> <span className="do-disputa">Pago en disputa</span></> : null}
    </>
  );
}

function Porque({ f }: { readonly f: FilaCruceVista }) {
  if (f.motivos.length > 0) return <ul className="do-lista">{f.motivos.map((m) => <li key={m}>{TEXTO_MOTIVO[m]}</li>)}</ul>;
  return <>{f.estado === "REVISAR" ? SIN_DATO : EXPLICACION_ESTADO[f.estado]}</>;
}

function FilaDelCruce({ f }: { readonly f: FilaCruceVista }) {
  const disputa = f.motivos.includes("PAGO_EN_DISPUTA");
  return (
    <tr data-disputa={disputa ? "" : undefined}>
      <th scope="row">{f.especie}</th>
      <td>{fecha(f.fechaPago)}</td>
      <td>
        {f.decretos.length === 0
          ? "Ningún decreto registrado le corresponde."
          : <ul className="do-lista">{f.decretos.map((d) => <DecretoDelGrupo key={d.clave} d={d} especie={f.especie} />)}</ul>}
      </td>
      <td className="num">{pesos(f.brutoEsperado)}</td>
      <td className="num"><Neto f={f} /></td>
      <td className="num">{pesos(f.diferenciaBrutoNeto)}</td>
      <td><Estado f={f} disputa={disputa} /></td>
      <td><Porque f={f} /></td>
    </tr>
  );
}

interface PropsCruce {
  readonly filas: readonly FilaCruceVista[];
  readonly desde: DiaIso;
  readonly sinTenencia: number;
}

function Cruce({ filas, desde, sinTenencia: n }: PropsCruce) {
  return (
    <div className="do-bloque">
      <h3 id="t-cruce">Cruce con lo recibido de Trii</h3>
      <p className="do-nota">Decretos con fecha ex pasada y pagos de Trii con fecha de pago desde el {fecha(desde)}, lo más reciente primero.</p>
      {filas.length === 0
        ? <p className="do-mensaje do-vacio-cruce">No hay decretos con fecha ex pasada ni pagos de Trii con fecha de pago desde el {fecha(desde)}.</p>
        : <Tabla id="t-cruce" columnas={COLUMNAS_CRUCE}>{filas.map((f) => <FilaDelCruce key={`${f.estado}|${f.clave}`} f={f} />)}</Tabla>}
      {n > 0 ? <p className="do-nota do-sin-tenencia">{sinTenencia(n)}</p> : null}
      <p className="do-nota">{notaVentana()}</p>
      <p className="do-nota">{NOTA_DIFERENCIA}</p>
    </div>
  );
}

function Termino({ termino, explicacion }: { readonly termino: string; readonly explicacion: string }) {
  return <><dt>{termino}</dt><dd>{explicacion}</dd></>;
}

export function Decretos({ d }: { readonly d: DecretosVista }) {
  return (
    <section className="do-decretos" aria-labelledby="t-decretos">
      <div>
        <div className="eyebrow">Por cuota, como los publica la fuente oficial</div>
        <h2 id="t-decretos">Dividendos decretados</h2>
        <p className="do-lead">
          Los decretos que registra el dueño desde la página oficial de la SFC o de la BVC, y su cruce con lo que pagó Trii.
          El bruto es una estimación de Inversiones, no el extracto.
        </p>
        <dl className="do-glosario">
          {GLOSARIO.map(([termino, explicacion]) => <Termino key={termino} termino={termino} explicacion={explicacion} />)}
        </dl>
      </div>
      <Proximos filas={d.proximos} />
      <Cruce filas={d.cruce} desde={d.desde} sinTenencia={d.sinTenencia} />
    </section>
  );
}
