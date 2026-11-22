"use client";
/**
 * Gráfica de tiempo reutilizable (frente graficas-tablero): líneas, relleno entre una serie y otra (o una constante)
 * con un tono arriba y otro abajo, bandas bajo/alto (P5–P95 y P25–P75 de las proyecciones) y un corte («Hoy»).
 * - Sin medir la pantalla: el SVG usa un viewBox de 1000 de ancho estirado al contenedor (trazos sin deformar) y el
 *   texto, los puntos y el detalle van en HTML, posicionados en %. Lo que pinta el servidor es lo que hidrata.
 * - Al cambiar la ventana se anima el dominio (un zoom); con «reducir movimiento», salta.
 * - Detalle con el puntero y con el teclado: la capa enfocable es un deslizador por los días (src/app/_graficas/mira.ts)
 *   cuyo aria-valuetext dice el día y sus cifras. La tabla de datos está en «Ver los datos».
 * - La leyenda y la tabla no se vuelven a pintar en los cuadros de la animación (memo con la ventana en primitivos).
 * - Con `dibujo` (proyecciones: un resultado que se interpola hacia el siguiente), el SVG y los puntos trazan los
 *   valores del cuadro; el dominio, la leyenda, el detalle, el deslizador y la tabla usan los finales. Esos reciben
 *   unas props «finales» que solo cambian si cambia lo que leen (título, días, series, bandas y formatos): un cuadro
 *   que solo trae otro `dibujo` no los vuelve a armar.
 * - Una banda con `degradado` se rellena con un linearGradient horizontal propio, por la variable --g-relleno-banda
 *   (así la regla de alto contraste de graficas.css sigue mandando).
 */
import { Fragment, memo, useId, useMemo, type CSSProperties } from "react";
import { useHidratado, useTransicion, useVisible } from "./animacion";
import { DetalleDia, textoDelDia } from "./DetalleDia";
import { ticksBonitos } from "./escalas";
import { ANCHO, MARCAS_Y, bandas, dominioObjetivo, escalasDe, lineas, rellenos, ultimoEnVentana, ultimoIndice, ventanaDe, type Dominio, type Escalas } from "./geometria";
import { idSeguro } from "./ids";
import { useMira } from "./mira";
import { TablaDatos } from "./TablaDatos";
import { diaANumero, ticksTiempo } from "./tiempo";
import type { Banda, PropsGraficaTiempo, Ventana } from "./tipos";

const ALTO = 220;
const MARCAS_X = 6;
const pct = (x: number) => Math.round((x / ANCHO) * 10000) / 100;
const px = (y: number) => `${Math.round(y * 10) / 10}px`;

const Leyenda = memo(function Leyenda({ p, desde, hasta }: { readonly p: PropsGraficaTiempo; readonly desde: number; readonly hasta: number }) {
  if (p.series.length < 2) return null;
  const v: Ventana = { desde, hasta };
  return (
    <ul className="g-leyenda">
      {p.series.map((s) => {
        const u = ultimoEnVentana(s.valores, v);
        return <li key={s.id}><i className={`g-clave t-${s.tono}${s.trazo === "punteado" ? " g-clave-punteada" : ""}`} aria-hidden="true" /><b>{u === null ? "—" : p.formatoY(u)}</b> {s.nombre}</li>;
      })}
      {(p.bandas ?? []).map((b) => <li key={b.id}><i className={`g-clave-banda g-banda-${b.intensidad} t-${b.tono}${b.degradado ? " g-clave-degradada" : ""}`} aria-hidden="true" /> {b.nombre}</li>)}
    </ul>
  );
});

/** Los puntos de la mira (o el final de cada serie) en HTML: redondos aunque el SVG se estire. */
function Puntos({ p, xs, e, indice, clase }: { readonly p: PropsGraficaTiempo; readonly xs: readonly number[]; readonly e: Escalas; readonly indice: (valores: readonly (number | null)[]) => number | null; readonly clase: string }) {
  return (
    <>
      {p.series.map((s) => {
        const i = indice(s.valores);
        const val = i === null ? null : s.valores[i];
        if (i === null || val === null || val === undefined) return null;
        return <span key={s.id} className={`${clase} t-${s.tono}`} style={{ left: `${pct(e.x.a(xs[i]!))}%`, top: px(e.y.a(val)) }} />;
      })}
    </>
  );
}

interface PropsDibujo { readonly p: PropsGraficaTiempo; readonly xs: readonly number[]; readonly e: Escalas; readonly alto: number; readonly ticksY: readonly number[]; readonly base: string; readonly xActivo: number | null; readonly xCorte: number | null }

/** El degradado horizontal de una banda: el tono entero al principio y más tenue al final (lo pinta graficas.css). */
function Degradado({ id, b }: { readonly id: string; readonly b: Banda }) {
  return (
    <linearGradient id={id} className={`t-${b.tono}`} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" className="g-parada-ini" />
      <stop offset="1" className="g-parada-fin" />
    </linearGradient>
  );
}

const rellenoDegradado = (id: string): CSSProperties => ({ ["--g-relleno-banda" as string]: `url(#${id})` });

/** El SVG decorativo: rejilla, bandas, rellenos recortados arriba/abajo, corte, líneas y la mira. */
function Dibujo({ p, xs, e, alto, ticksY, base, xActivo, xCorte }: PropsDibujo) {
  const capas = rellenos(p.rellenos ?? [], p.series, xs, e, alto);
  const lista = p.bandas ?? [];
  const idDegradado = (k: number) => `${base}-g${k}`;
  const vertical = (clase: string, x: number) => <line className={clase} x1={x} x2={x} y1={0} y2={alto} vectorEffect="non-scaling-stroke" />;
  return (
    <svg className="g-svg" viewBox={`0 0 ${ANCHO} ${alto}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        {capas.map((r, k) => (
          <Fragment key={k}>
            <clipPath id={`${base}-a${k}`}><path d={r.recorteArriba} /></clipPath>
            <clipPath id={`${base}-b${k}`}><path d={r.recorteAbajo} /></clipPath>
          </Fragment>
        ))}
        {lista.map((b, k) => (b.degradado ? <Degradado key={b.id} id={idDegradado(k)} b={b} /> : null))}
      </defs>
      {ticksY.map((t) => <line key={t} className="g-grid" x1={0} x2={ANCHO} y1={e.y.a(t)} y2={e.y.a(t)} vectorEffect="non-scaling-stroke" />)}
      {bandas(lista, xs, e).map((b, k) => (
        <path
          key={b.id} className={`g-banda g-banda-${b.intensidad} t-${b.tono}${b.degradado ? " g-banda-degradada" : ""}`} d={b.d}
          style={b.degradado ? rellenoDegradado(idDegradado(k)) : undefined}
        />
      ))}
      {capas.map((r, k) => (
        <Fragment key={k}>
          <path className={`g-relleno t-${r.arriba}`} d={r.d} clipPath={`url(#${base}-a${k})`} />
          <path className={`g-relleno t-${r.abajo}`} d={r.d} clipPath={`url(#${base}-b${k})`} />
          {r.base === null ? null : <line className="g-base" x1={0} x2={ANCHO} y1={r.base} y2={r.base} vectorEffect="non-scaling-stroke" />}
        </Fragment>
      ))}
      {xCorte === null ? null : vertical("g-corte-linea", xCorte)}
      {lineas(p.series, xs, e).map((l) => <path key={l.id} data-serie={l.id} className={`g-linea${l.punteado ? " g-punteado" : ""} t-${l.tono}`} d={l.d} vectorEffect="non-scaling-stroke" />)}
      {xActivo === null ? null : vertical("g-mira", xActivo)}
    </svg>
  );
}

/**
 * Las marcas del eje Y en su propia columna, a la izquierda del dibujo (nunca encima de las líneas). Una copia
 * invisible de la marca más larga le da el ancho a la columna (las marcas van posicionadas y no ocupan lugar).
 */
function EjeY({ p, e, ticks, alto }: { readonly p: PropsGraficaTiempo; readonly e: Escalas; readonly ticks: readonly number[]; readonly alto: number }) {
  const textos = ticks.map((t) => p.formatoEje(t));
  const larga = textos.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <div className="g-ticks-y" aria-hidden="true" style={{ height: `${alto}px` }}>
      <span className="g-tick-medida">{larga}</span>
      {ticks.map((t, k) => <span key={t} className="g-tick-y" style={{ top: px(Math.round(e.y.a(t))) }}>{textos[k]}</span>)}
    </div>
  );
}

function EjeX({ p, e, desde, hasta }: { readonly p: PropsGraficaTiempo; readonly e: Escalas; readonly desde: number; readonly hasta: number }) {
  const marcas = ticksTiempo(desde, hasta, MARCAS_X).map((m) => ({ ...m, pos: pct(e.x.a(m.valor)) })).filter((m) => m.pos >= 0 && m.pos <= 100);
  return (
    <div className="g-eje-x" aria-hidden="true">
      {marcas.map((m) => <span key={m.dia} className="g-tick-x" data-borde={m.pos < 8 ? "ini" : m.pos > 92 ? "fin" : undefined} style={{ left: `${m.pos}%` }}>{p.formatoTick(m.dia, m.etiqueta)}</span>)}
    </div>
  );
}

/** Las props con lo que se traza en este cuadro: las de `dibujo` si las hay (las bandas, si no trae, las finales). */
const conDibujo = (p: PropsGraficaTiempo): PropsGraficaTiempo =>
  p.dibujo ? { ...p, series: p.dibujo.series, bandas: p.dibujo.bandas ?? p.bandas } : p;

export function GraficaTiempo(p: PropsGraficaTiempo) {
  const trazo = conDibujo(p);
  // Lo que leen la leyenda, la tabla y el texto del deslizador (memo): estable mientras solo cambie `dibujo`.
  const { titulo, dias, series, bandas: lasBandas, formatoY, formatoDia, extraDetalle } = p;
  const finales = useMemo(
    () => ({ ...p, dibujo: undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a propósito: solo los campos que leen.
    [titulo, dias, series, lasBandas, formatoY, formatoDia, extraDetalle],
  );
  const alto = p.alto ?? ALTO;
  const base = idSeguro(useId());
  const xs = useMemo(() => p.dias.map(diaANumero), [p.dias]);
  const v = ventanaDe(p.ventana, p.dias.length);
  const objetivo = dominioObjetivo(p, xs, v);
  const e = escalasDe(useTransicion(objetivo) as Dominio, alto);
  const { ref, visible } = useVisible<HTMLDivElement>();
  const hidratado = useHidratado();
  const { activo, manejadores } = useMira(xs, v, e.x);
  const indiceValor = activo ?? v.hasta;
  const valorTexto = useMemo(() => textoDelDia(finales, indiceValor), [finales, indiceValor]);
  const ticksY = ticksBonitos(objetivo[2], objetivo[3], MARCAS_Y);
  const xActivo = activo === null ? null : e.x.a(xs[activo]!);
  const corte = p.corte && xs[p.corte.indice] !== undefined ? { nombre: p.corte.nombre, x: e.x.a(xs[p.corte.indice]!) } : null;
  return (
    <figure className="g-figura g-tiempo" aria-labelledby={`${base}-t`}>
      <figcaption className="g-cabeza">
        <span className="g-titulo" id={`${base}-t`}>{p.titulo}</span>
        {p.encabezado ? <span className="g-encabezado">{p.encabezado}</span> : null}
      </figcaption>
      <Leyenda p={finales} desde={v.desde} hasta={v.hasta} />
      <div className="g-marco">
        <EjeY p={p} e={e} ticks={ticksY} alto={alto} />
        <div className="g-plot" ref={ref} data-visible={visible ? "" : undefined} data-hidratado={hidratado ? "" : undefined} style={{ height: `${alto}px` }}>
          <Dibujo p={trazo} xs={xs} e={e} alto={alto} ticksY={ticksY} base={base} xActivo={xActivo} xCorte={corte?.x ?? null} />
          {corte ? <span className="g-corte" aria-hidden="true" style={{ left: `${pct(corte.x)}%` }}>{corte.nombre}</span> : null}
          <Puntos p={trazo} xs={xs} e={e} clase="g-fin" indice={(valores) => ultimoIndice(valores, v)} />
          {activo === null ? null : <Puntos p={trazo} xs={xs} e={e} clase="g-punto" indice={() => activo} />}
          {activo === null || xActivo === null ? null : <DetalleDia p={p} indice={activo} posicion={pct(xActivo)} />}
          <div
            className="g-toque" role="slider" tabIndex={0} aria-orientation="horizontal" aria-labelledby={`${base}-t`} aria-describedby={`${base}-r`}
            aria-valuemin={v.desde} aria-valuemax={v.hasta} aria-valuenow={indiceValor} aria-valuetext={valorTexto} {...manejadores}
          />
        </div>
        <EjeX p={p} e={e} desde={objetivo[0]} hasta={objetivo[1]} />
      </div>
      <p id={`${base}-r`} className="g-sr">{p.resumen}</p>
      <TablaDatos p={finales} desde={v.desde} hasta={v.hasta} />
    </figure>
  );
}
