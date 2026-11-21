"use client";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { cop, fecha, n, numero, pct } from "./formato";
import { Linea, Peso } from "./Graficas";
import type { FilaVista, Vista } from "./tipos";

const MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";
const SISTEMA_CLARO = "(prefers-color-scheme: light)";
const SIN_DATO = "—";

type Fase = "espera" | "anima" | "fin";
interface Contador { readonly valor: number; readonly fase: Fase }

const salida = (k: number): number => 1 - Math.pow(1 - k, 4);

/**
 * Cuenta desde 0 hasta `fin`. Sin animación (servidor, «reducir movimiento», pestaña oculta) vale `fin`.
 * En fase «espera» el CSS oculta la cifra: así no se ve el valor final y luego el 0.
 */
function useContador(fin: number, ms = 1500, espera = 150): Contador {
  const [estado, setEstado] = useState<Contador>({ valor: fin, fase: "espera" });
  useEffect(() => {
    if (document.hidden || window.matchMedia(MOVIMIENTO_REDUCIDO).matches) {
      setEstado({ valor: fin, fase: "fin" });
      return;
    }
    let raf = 0;
    const t0 = performance.now() + espera;
    const paso = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms));
      setEstado({ valor: fin * salida(k), fase: k < 1 ? "anima" : "fin" });
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [fin, ms, espera]);
  return estado;
}

/** El lector de pantalla oye siempre el valor final; la cuenta animada es solo visual. */
function Cifra({ valor, signo = false, clase = "" }: { valor: number; signo?: boolean; clase?: string }) {
  const { valor: v, fase } = useContador(valor);
  return (
    <span className={`num ${clase}`}>
      <span className="sr">{cop(valor, signo)}</span>
      <span className="cifra" data-fase={fase} aria-hidden="true">{cop(v, signo)}</span>
    </span>
  );
}

function temaClaro(): boolean {
  const elegido = document.documentElement.dataset.theme;
  if (elegido === "light" || elegido === "dark") return elegido === "light";
  return window.matchMedia(SISTEMA_CLARO).matches;
}

function suscribirTema(aviso: () => void): () => void {
  const sistema = window.matchMedia(SISTEMA_CLARO);
  const observador = new MutationObserver(aviso);
  sistema.addEventListener("change", aviso);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    sistema.removeEventListener("change", aviso);
    observador.disconnect();
  };
}

const claroEnServidor = (): boolean => false;

function Encabezado({ vista }: { vista: Vista }) {
  const claro = useSyncExternalStore(suscribirTema, temaClaro, claroEnServidor);
  const alternarTema = () => { document.documentElement.dataset.theme = claro ? "dark" : "light"; };
  return (
    <header className="top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">008</span>Mi portafolio</div>
        <div className="meta">
          Cierre <b>{fecha(vista.ultimoCierre)}</b> · última carga <b>{fecha(vista.ultimaCarga)}</b>
        </div>
        <button type="button" className="pill" onClick={alternarTema} aria-pressed={claro}>Tema claro</button>
      </div>
    </header>
  );
}

function Avisos({ vista }: { vista: Vista }) {
  const sinCierre = vista.especiesSinPrecio;
  return (
    <>
      {sinCierre > 0 ? (
        <p className="nota aviso">{sinCierre} especie(s) sin cierre: su valor y su ganancia sin vender no entran en los totales.</p>
      ) : null}
      {vista.incompletas.length > 0 ? (
        <p className="nota aviso">
          Con datos incompletos (no entran en el total): {vista.incompletas.join(" · ")}. Tienen ventas que sus lotes no cubren; se corrige completando la carga de órdenes.
        </p>
      ) : null}
    </>
  );
}

function Respuesta({ vista }: { vista: Vista }) {
  const total = n(vista.gananciaTotal);
  const gana = total >= 0;
  const piezas = [
    { k: "Sin vender", v: n(vista.sinVender), c: "var(--gain)" },
    { k: "Por ventas", v: n(vista.porVentas), c: "var(--gold)" },
    { k: "Dividendos", v: n(vista.dividendos), c: "var(--muted)" },
    { k: "Comisiones", v: -n(vista.comisiones), c: "var(--loss)" },
  ];
  const abs = piezas.reduce((s, p) => s + Math.abs(p.v), 0) || 1;
  return (
    <section className="hero entra" aria-labelledby="t-hero">
      <div className="eyebrow">Su portafolio en acciones</div>
      <h1 id="t-hero">
        <em className={gana ? "gain" : "loss"}>¿Gano?</em> {gana ? "Sí." : "Por ahora, no."}
        <Cifra valor={total} signo clase={`grande ${gana ? "" : "loss"}`} />
      </h1>
      <div className="desglose" role="img" aria-label="Composición de la ganancia">
        {piezas.map((p) => <span key={p.k} style={{ width: `${(Math.abs(p.v) / abs) * 100}%`, background: p.c }} />)}
      </div>
      <div className="leyenda num">
        {piezas.map((p) => <span key={p.k}><i style={{ background: p.c }} />{p.k} {cop(p.v, true)}</span>)}
      </div>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Valor en acciones</div><Cifra valor={n(vista.valorAcciones)} /></div>
        <div className="kpi"><div className="eyebrow">Caja</div><span className="muted">llega con la certificación de A&amp;V</span>
          <div className="nota">Los CSV de Trii no traen el aporte al fondo ni sus rendimientos: la caja calculada con ellos no es real.</div></div>
        <div className="kpi"><div className="eyebrow">Especies vivas</div><span className="num">{vista.filas.length}</span></div>
        <div className="kpi"><div className="eyebrow">Fondo inmobiliario</div><span className="muted">llega con su SPEC</span></div>
      </div>
      <Avisos vista={vista} />
    </section>
  );
}

interface Movimiento { readonly f: FilaVista; readonly aporte: number; readonly p: number }

/** Último cierre frente al anterior; null si el anterior falta o no es positivo (nada de Infinity ni NaN). */
function movimiento(f: FilaVista): Movimiento | null {
  const anterior = n(f.serie.at(-2)?.precio);
  const ultimo = n(f.serie.at(-1)?.precio);
  if (!(anterior > 0) || !Number.isFinite(ultimo)) return null;
  return { f, aporte: (ultimo - anterior) * n(f.cantidad), p: (ultimo / anterior - 1) * 100 };
}

function Movimientos({ filas }: { filas: FilaVista[] }) {
  const movs = filas
    .map(movimiento)
    .filter((m): m is Movimiento => m !== null)
    .sort((x, y) => Math.abs(y.aporte) - Math.abs(x.aporte));
  const max = Math.max(1, ...movs.map((m) => Math.abs(m.aporte)));
  const neto = movs.reduce((s, m) => s + m.aporte, 0);
  const [lleno, setLleno] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLleno(true), 500); return () => clearTimeout(t); }, []);
  return (
    <section className="bloque entra d2" aria-labelledby="t-mov">
      <div className="cabeza">
        <div><div className="eyebrow">Último cierre</div><h2 id="t-mov">Qué movió su portafolio</h2></div>
        <div className="meta">Neto <b className={`num ${neto >= 0 ? "gain" : "loss"}`}>{cop(neto, true)}</b></div>
      </div>
      <div className="movers">
        {movs.map((m) => (
          <div className="mover" key={m.f.id}>
            <span><b>{m.f.nemo}</b><br /><span className={`num chico ${m.aporte >= 0 ? "gain" : "loss"}`}>{pct(m.p)}</span></span>
            <span className="barra" aria-hidden="true">
              <span className={`barra-fill ${m.aporte >= 0 ? "bg-gain" : "bg-loss"}`} style={{ transform: `scaleX(${lleno ? Math.abs(m.aporte) / max : 0})` }} />
            </span>
            <span className={`num der ${m.aporte >= 0 ? "gain" : "loss"}`}>{cop(m.aporte, true)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Detalle({ f, cerrar }: { f: FilaVista; cerrar: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [f.id]);
  const alTeclear = (e: KeyboardEvent<HTMLElement>) => { if (e.key === "Escape") cerrar(); };
  const cu = n(f.cantidad) > 0 ? n(f.costo) / n(f.cantidad) : null;
  const ultimo = f.serie.length ? n(f.serie[f.serie.length - 1]!.precio) : null;
  return (
    <aside className="detalle" aria-label={`Detalle de ${f.nemo}`} onKeyDown={alTeclear}>
      <div className="cabeza">
        <div><div className="eyebrow">{f.lotesVivos} lote(s) vivo(s)</div><h3 ref={titulo} tabIndex={-1}>{f.nemo}</h3></div>
        <button type="button" className="pill" onClick={cerrar}>Cerrar</button>
      </div>
      <Linea serie={f.serie} costoUnitario={cu} ancho={320} alto={90} grosor={2.2} sube={ultimo !== null && cu !== null ? ultimo >= cu : true} />
      <p className="nota">Línea punteada: su costo promedio por acción{cu ? ` (${cop(cu)})` : ""}. Últimos {f.serie.length} cierres.</p>
      <dl className="pares num">
        <dt>Cantidad</dt><dd>{numero(n(f.cantidad))}</dd>
        <dt>Costo (A&amp;V o Trii, sin comisión)</dt><dd>{cop(n(f.costo))}</dd>
        <dt>Valor al cierre</dt><dd>{f.valor ? cop(n(f.valor)) : "sin cierre"}</dd>
        <dt>Ganancia sin vender</dt><dd className={n(f.sinVender) >= 0 ? "gain" : "loss"}>{f.sinVender ? `${cop(n(f.sinVender), true)} · ${pct(n(f.rentabilidadPct))}` : SIN_DATO}</dd>
        <dt>Ganancia por ventas</dt><dd>{cop(n(f.realizada), true)}</dd>
        <dt>Dividendos netos</dt><dd>{cop(n(f.dividendos))}</dd>
        <dt>Comisiones pagadas</dt><dd>{cop(n(f.comisiones))}</dd>
      </dl>
    </aside>
  );
}

type Orden = "valor" | "sinVender" | "rentabilidadPct" | "dividendos" | "nemo";
type OrdenCifra = Exclude<Orden, "nemo">;
type Comparador = (a: FilaVista, b: FilaVista) => number;

/** Alfabético por nemotécnico (comparación por código: igual en servidor y navegador). */
const porNemo: Comparador = (a, b) => (a.nemo < b.nemo ? -1 : a.nemo > b.nemo ? 1 : 0);

/** De mayor a menor; los nulos siempre al final. */
const porCifra = (k: OrdenCifra): Comparador => (a, b) => {
  const x = a[k], y = b[k];
  if (x == null || y == null) return Number(x == null) - Number(y == null);
  return Number(y) - Number(x);
};

/** Sentido del orden activo: la especie va A→Z; las cifras, de mayor a menor. */
const sentido = (k: Orden): "ascending" | "descending" => (k === "nemo" ? "ascending" : "descending");

function FilaPosicion({ f, activa, idBoton, elegir }: { f: FilaVista; activa: boolean; idBoton: string; elegir: (id: string) => void }) {
  const sube = n(f.sinVender) >= 0;
  const elegirEsta = () => elegir(f.id);
  /** El botón no deja subir el clic a la fila: si no, se elegiría dos veces. */
  const elegirDesdeBoton = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    elegirEsta();
  };
  return (
    // El clic en la fila es un atajo de ratón; con teclado se usa el botón de la primera celda.
    <tr className={activa ? "sel" : ""} onClick={elegirEsta}>
      <td><button type="button" id={idBoton} className="especie" aria-pressed={activa} onClick={elegirDesdeBoton}>{f.nemo}</button></td>
      <td className="num">{numero(n(f.cantidad))}</td>
      <td className="num">{f.cierre ? cop(n(f.cierre.precio)) : SIN_DATO}<br />
        <span className={`chip ${f.cierre?.verificado ? "ok" : ""}`}>{f.cierre?.verificado ? "verificado A&V" : `sin verificar · ${fecha(f.cierre?.fecha ?? null)}`}</span></td>
      <td><Linea serie={f.serie} sube={f.serie.length > 1 && n(f.serie[f.serie.length - 1]!.precio) >= n(f.serie[0]!.precio)} /></td>
      <td className="num"><b>{f.valor ? cop(n(f.valor)) : SIN_DATO}</b></td>
      <td className="num">{f.pesoPct ? <><Peso pct={n(f.pesoPct)} /> {numero(n(f.pesoPct), 1)} %</> : SIN_DATO}</td>
      <td className={`num ${sube ? "gain" : "loss"}`}><b>{f.sinVender ? cop(n(f.sinVender), true) : SIN_DATO}</b></td>
      <td className={`num ${sube ? "gain" : "loss"}`}>{f.rentabilidadPct ? pct(n(f.rentabilidadPct)) : SIN_DATO}</td>
      <td className="num">{cop(n(f.dividendos))}</td>
      <td className="num">{cop(n(f.comisiones))}</td>
    </tr>
  );
}

function Posiciones({ vista }: { vista: Vista }) {
  const [orden, setOrden] = useState<Orden>("valor");
  const [elegida, setElegida] = useState<string | null>(null);
  const base = useId();
  const idBoton = (id: string) => `${base}-especie-${id}`;
  const filas = useMemo(() => [...vista.filas].sort(orden === "nemo" ? porNemo : porCifra(orden)), [vista.filas, orden]);
  const sel = filas.find((f) => f.id === elegida) ?? null;
  /** Devuelve el foco al botón de la especie antes de quitar el panel. */
  const cerrar = () => {
    if (elegida) document.getElementById(idBoton(elegida))?.focus();
    setElegida(null);
  };
  const col = (k: Orden, t: string) => (
    <th scope="col" aria-sort={orden === k ? sentido(k) : undefined}><button type="button" onClick={() => setOrden(k)}>{t}</button></th>
  );
  return (
    <section className="bloque entra d3" aria-labelledby="t-pos">
      <div className="cabeza">
        <div><div className="eyebrow">Especies</div><h2 id="t-pos">Una por una</h2></div>
        <div className="meta">Costo según Acciones &amp; Valores · ventas por FIFO · toque una fila</div>
      </div>
      <div className="con-detalle">
        <div className="tabla">
          <table>
            <thead><tr>
              {col("nemo", "Especie")}
              <th scope="col">Cantidad</th><th scope="col">Cierre</th><th scope="col">60 cierres</th>
              {col("valor", "Valor")}<th scope="col">Peso</th>{col("sinVender", "Sin vender")}{col("rentabilidadPct", "%")}{col("dividendos", "Dividendos")}
              <th scope="col">Comisiones</th>
            </tr></thead>
            <tbody>
              {filas.map((f) => <FilaPosicion key={f.id} f={f} activa={f.id === elegida} idBoton={idBoton(f.id)} elegir={setElegida} />)}
            </tbody>
          </table>
        </div>
        {sel ? <Detalle f={sel} cerrar={cerrar} /> : null}
      </div>
      {vista.cerradas.length > 0 ? (
        <p className="nota">Vendidas por completo: {vista.cerradas.map((f) => `${f.nemo} (ganancia por ventas ${cop(n(f.realizada), true)})`).join(" · ")}</p>
      ) : null}
    </section>
  );
}

function Falta() {
  return (
    <section className="bloque entra d4" aria-labelledby="t-falta">
      <div className="cabeza"><div><div className="eyebrow">En camino</div><h2 id="t-falta">Lo que todavía no está</h2></div></div>
      <ul className="falta">
        <li><b>Mis reglas</b> y qué tan cerca está cada nivel · con el diario de decisiones</li>
        <li><b>Dividendos que vienen</b> con fecha ex y monto esperado</li>
        <li><b>Fondo inmobiliario</b> con su valor de unidad (SFC)</li>
        <li><b>Caja oficial</b> de la certificación de A&amp;V y su cuadre</li>
        <li><b>Rentabilidad TWR</b> y escenarios</li>
      </ul>
    </section>
  );
}

export function Tablero({ vista }: { vista: Vista }) {
  return (
    <>
      <Encabezado vista={vista} />
      <main className="wrap">
        <Respuesta vista={vista} />
        <Movimientos filas={vista.filas} />
        <Posiciones vista={vista} />
        <Falta />
        <footer className="pie">El sistema calcula y muestra; no recomienda comprar ni vender. Datos de su base local.</footer>
      </main>
    </>
  );
}
