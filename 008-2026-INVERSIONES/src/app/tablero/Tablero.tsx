"use client";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { ContadorAlertas } from "@/app/_comun/alertas/ContadorAlertas";
import { FechaDato, FechaDatoCompuesta } from "@/app/_comun/fecha-dato/FechaDato";
import { TarjetaResumenIa } from "@/app/_comun/resumen-ia/TarjetaResumenIa";
import type { VistaResumenIa } from "@/app/_comun/resumen-ia/tipos";
import { DECIMALES_PESO } from "@/operar/analisis/decimales";
import { pieDePrecios } from "@/precios/fuentes";
import { Evolucion } from "./Evolucion";
import { cop, fecha, n, numero, pct } from "./formato";
import { Foto } from "./Foto";
import { procedenciaDeCierre, procedenciaDeFilas } from "./procedencia";
import { MarcaSoloLectura } from "./SoloLectura";
import { Linea, Peso } from "./Graficas";
import { seccionesVisibles } from "./secciones";
import type { EvolucionVista, FilaVista, LineaConciliacionVista, MovimientoVista, Vista } from "./tipos";

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

/**
 * «Salir» (D-014): POST /api/sesion/salir cierra TODAS las sesiones de la cuenta, borra la cookie y se
 * vuelve a /ingresar. Un doble clic hace un solo pedido. Si no hubo respuesta (sin red), se avisa en vez
 * de navegar: con la cookie viva, /ingresar devolvería al tablero; al reintentar, el aviso se limpia.
 */
function BotonSalir() {
  const [fallo, setFallo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const enCurso = useRef(false);
  const salir = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setSaliendo(true);
    setFallo(false);
    const r = await fetch("/api/sesion/salir", { method: "POST", cache: "no-store" }).catch(() => null);
    if (r && (r.ok || r.status === 401)) {
      window.location.assign("/ingresar");
      return;
    }
    enCurso.current = false;
    setSaliendo(false);
    setFallo(true);
  };
  return (
    <>
      <button type="button" className="pill" onClick={salir} aria-disabled={saliendo} aria-busy={saliendo}>Salir</button>
      {fallo ? <span className="nota aviso" role="status">No se pudo cerrar la sesión. Intente de nuevo.</span> : null}
    </>
  );
}

/** «Cierre 20-nov-2026», o las dos puntas si las especies vivas cerraron en fechas distintas. */
function FechaDeCierres({ vista }: { vista: Vista }) {
  const { fechaReferencia: ref, cierreMasViejo: viejo } = vista;
  if (ref !== null && viejo !== null && viejo !== ref) {
    return <>Cierres de fechas distintas: del <b>{fecha(viejo)}</b> al <b>{fecha(ref)}</b></>;
  }
  return <>Cierre <b>{fecha(ref)}</b></>;
}

/** Las otras pantallas; el portafolio es la actual. El familiar (solo lectura) no ve «Configuración». */
function Secciones({ soloLectura }: { readonly soloLectura: boolean }) {
  return (
    <nav aria-label="Secciones">
      <ul className="secciones">
        {seccionesVisibles(soloLectura).map((s) => <li key={s.clave}><a href={s.href} aria-current={s.clave === "portafolio" ? "page" : undefined}>{s.texto}{s.clave === "alertas" ? <ContadorAlertas /> : null}</a></li>)}
      </ul>
    </nav>
  );
}

function Encabezado({ vista, soloLectura }: { vista: Vista; soloLectura: boolean }) {
  const claro = useSyncExternalStore(suscribirTema, temaClaro, claroEnServidor);
  const alternarTema = () => { document.documentElement.dataset.theme = claro ? "dark" : "light"; };
  return (
    <header className="top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">Inv</span>Inversiones · Mi portafolio{soloLectura ? <>{" "}<MarcaSoloLectura /></> : null}</div>
        <Secciones soloLectura={soloLectura} />
        <div className="meta">
          <FechaDeCierres vista={vista} /> · última carga <b>{fecha(vista.ultimaCarga)}</b>
        </div>
        <button type="button" className="pill" onClick={alternarTema} aria-pressed={claro}>Tema claro</button>
        <BotonSalir />
      </div>
    </header>
  );
}

function Avisos({ vista }: { vista: Vista }) {
  const sinCierre = vista.especiesSinPrecio;
  const atrasadas = vista.filas.filter((f) => f.cierre?.atrasado);
  return (
    <>
      {atrasadas.length > 0 ? (
        <p className="nota aviso">
          Con precio de otra fecha (entra en los totales con su último cierre): {atrasadas.map((f) => `${f.nemo}, precio del ${fecha(f.cierre?.fecha ?? null)}`).join(" · ")}.
        </p>
      ) : null}
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

/**
 * El titular no afirma a secas si el total no es completo y de un solo día:
 * «con datos parciales» si algo queda fuera del total (sin precio o incompleta) y
 * «con precios de fechas distintas» si todo entra pero alguna especie trae un cierre anterior.
 */
function condicion(vista: Vista): string {
  if (vista.especiesSinPrecio > 0 || vista.incompletas.length > 0) return ", con datos parciales";
  if (vista.especiesAtrasadas > 0) return ", con precios de fechas distintas";
  return "";
}

function Respuesta({ vista }: { vista: Vista }) {
  const total = n(vista.gananciaTotal);
  const gana = total >= 0;
  const condicionada = condicion(vista);
  const piezas = [
    { k: "Sin vender", v: n(vista.sinVender), c: "var(--gain)" },
    { k: "Por ventas", v: n(vista.porVentas), c: "var(--gold)" },
    { k: "Dividendos", v: n(vista.dividendos), c: "var(--muted)" },
    { k: "Comisiones", v: -n(vista.comisiones), c: "var(--loss)" },
  ];
  const abs = piezas.reduce((s, p) => s + Math.abs(p.v), 0) || 1;
  // De cuándo son los cierres que suman el valor en acciones (y la ganancia sin vender del total): el más viejo
  // (frente fecha-hora-datos). Una sola nota en la portada, junto a la cifra que suma los cierres (revisión a11y y React).
  const compuesta = procedenciaDeFilas(vista.filas);
  return (
    <section className="hero entra" aria-labelledby="t-hero">
      <div className="eyebrow">Su portafolio en acciones</div>
      <h1 id="t-hero">
        <em className={condicionada ? "muted" : gana ? "gain" : "loss"}>¿Gano?</em> {gana ? "Sí" : "Por ahora, no"}{condicionada}.{" "}
        <Cifra valor={total} signo clase={`grande ${gana ? "" : "loss"}`} />
      </h1>
      <div className="desglose" role="img" aria-label="Composición de la ganancia">
        {piezas.map((p) => <span key={p.k} style={{ width: `${(Math.abs(p.v) / abs) * 100}%`, background: p.c }} />)}
      </div>
      <div className="leyenda num">
        {piezas.map((p) => <span key={p.k}><i style={{ background: p.c }} />{p.k} {cop(p.v, true)}</span>)}
      </div>
      <div className="kpis">
        <div className="kpi"><div className="eyebrow">Valor en acciones</div><Cifra valor={n(vista.valorAcciones)} />{compuesta ? <FechaDatoCompuesta compuesta={compuesta} /> : null}</div>
        <div className="kpi"><div className="eyebrow">Caja</div><span className="muted">llega con la certificación de A&amp;V</span>
          <div className="nota">Los CSV de Trii no traen el aporte al fondo ni sus rendimientos: la caja calculada con ellos no es real.</div></div>
        <div className="kpi"><div className="eyebrow">Especies vivas</div><span className="num">{vista.filas.length}</span></div>
        <div className="kpi"><div className="eyebrow">Fondo inmobiliario</div><span className="muted">llega con su SPEC</span></div>
      </div>
      <Avisos vista={vista} />
    </section>
  );
}

/** Por qué «Qué movió» no compara, o cuántas especies se quedaron fuera del par de ruedas. */
function notaMovimiento(m: MovimientoVista): string | null {
  if (m.motivo === "SIN_CIERRES") return "Sin cierres para comparar.";
  if (m.motivo === "CALENDARIO_NO_CUBRE") return `El calendario de la BVC no cubre la fecha del cierre (${fecha(m.referencia)}): no se compara.`;
  if (m.motivo === "REFERENCIA_NO_HABIL") return `El cierre más reciente (${fecha(m.referencia)}) no es día hábil de la BVC: no se compara.`;
  if (m.motivo === "SIN_RUEDA_PREVIA") return `No se encontró la rueda anterior al ${fecha(m.referencia)} en el calendario de la BVC: no se compara.`;
  if (m.omitidas === 1) return "Se omite 1 especie: no tiene cierre en las dos ruedas.";
  if (m.omitidas > 1) return `Se omiten ${m.omitidas} especies: no tienen cierre en las dos ruedas.`;
  return null;
}

/**
 * Solo formato: el par de ruedas, los aportes y el neto vienen calculados en Decimal desde el servidor. Cada tarjeta
 * dice cuándo se trajo el cierre de la referencia (el último de su fila: el cálculo exige que sea ese) y de dónde; su
 * fecha ya la dice el periodo de la sección. El neto, el más viejo de los que entraron: todos son del día de la
 * referencia y sus cierres previos, del día de la rueda anterior (movimiento.ts solo admite ese par).
 */
function Movimientos({ mov, filas }: { mov: MovimientoVista; filas: readonly FilaVista[] }) {
  const max = Math.max(1, ...mov.especies.map((m) => Math.abs(n(m.aporte))));
  const neto = mov.neto === null ? null : n(mov.neto);
  const nota = notaMovimiento(mov);
  const periodo = mov.previa ? `Del ${fecha(mov.previa)} al ${fecha(mov.referencia)} · sobre su cantidad actual` : "Último cierre";
  const [lleno, setLleno] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLleno(true), 500); return () => clearTimeout(t); }, []);
  const cierreDe = new Map(filas.flatMap((f) => (f.cierre ? [[f.id, procedenciaDeCierre(f.cierre)] as const] : [])));
  const entraron = new Set(mov.especies.map((m) => m.id));
  const compuesta = procedenciaDeFilas(filas.filter((f) => entraron.has(f.id)));
  return (
    <section className="bloque entra d2" aria-labelledby="t-mov">
      <div className="cabeza">
        <div><div className="eyebrow">{periodo}</div><h2 id="t-mov">Qué movió su portafolio</h2></div>
        <div className="meta">Neto {neto === null ? <b className="num">{SIN_DATO}</b> : <b className={`num ${neto >= 0 ? "gain" : "loss"}`}>{cop(neto, true)}</b>}</div>
      </div>
      <div className="movers" role="list">
        {mov.especies.map((m) => {
          const aporte = n(m.aporte);
          const tono = aporte >= 0 ? "gain" : "loss";
          const procedencia = cierreDe.get(m.id);
          return (
            <div className="mover" role="listitem" key={m.id}>
              <span><b>{m.nemo}</b><br /><span className={`num chico ${tono}`}>{pct(n(m.variacionPct))}</span></span>
              <span className="barra" aria-hidden="true">
                <span className={`barra-fill bg-${tono}`} style={{ transform: `scaleX(${lleno ? Math.abs(aporte) / max : 0})` }} />
              </span>
              <span className={`num der ${tono}`}>{cop(aporte, true)}</span>
              {procedencia ? <FechaDato procedencia={procedencia} sinFecha ancho /> : null}
            </div>
          );
        })}
      </div>
      {compuesta ? <FechaDatoCompuesta compuesta={compuesta} /> : null}
      {nota ? <p className="nota">{nota}</p> : null}
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
        <dt>{f.cierre ? `Valor al cierre del ${fecha(f.cierre.fecha)}` : "Valor al cierre"}</dt><dd>{f.valor ? cop(n(f.valor)) : "sin cierre"}</dd>
        {/* Otra definición del mismo término: cuándo se trajo ese cierre y de dónde (la fecha ya la dice el término). */}
        {f.cierre ? <dd className="pares-ancho"><FechaDato procedencia={procedenciaDeCierre(f.cierre)} sinFecha /></dd> : null}
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

/** El chip del cierre lleva SIEMPRE su fecha; uno atrasado se marca como aviso («precio del <fecha>»). */
function ChipCierre({ cierre }: { cierre: FilaVista["cierre"] }) {
  if (!cierre) return <span className="chip">sin cierre</span>;
  const estado = cierre.verificado ? "verificado A&V" : "sin verificar";
  const dia = fecha(cierre.fecha);
  if (cierre.atrasado) return <span className="chip aviso">precio del {dia} · {estado}</span>;
  return <span className={`chip ${cierre.verificado ? "ok" : ""}`}>{estado} · {dia}</span>;
}

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
      <td className="num">
        {f.cierre ? cop(n(f.cierre.precio)) : SIN_DATO}<br /><ChipCierre cierre={f.cierre} />
        {f.cierre ? <FechaDato procedencia={procedenciaDeCierre(f.cierre)} sinFecha /> : null}
      </td>
      <td><Linea serie={f.serie} sube={f.serie.length > 1 && n(f.serie[f.serie.length - 1]!.precio) >= n(f.serie[0]!.precio)} /></td>
      <td className="num"><b>{f.valor ? cop(n(f.valor)) : SIN_DATO}</b></td>
      <td className="num">{f.pesoPct ? <><Peso pct={n(f.pesoPct)} /> {numero(n(f.pesoPct), DECIMALES_PESO)} %</> : SIN_DATO}</td>
      <td className={`num ${sube ? "gain" : "loss"}`}><b>{f.sinVender ? cop(n(f.sinVender), true) : SIN_DATO}</b></td>
      <td className={`num ${sube ? "gain" : "loss"}`}>{f.rentabilidadPct ? pct(n(f.rentabilidadPct)) : SIN_DATO}</td>
      <td className="num">{cop(n(f.dividendos))}</td>
      <td className="num">{cop(n(f.comisiones))}</td>
    </tr>
  );
}

/** La especie del panel de detalle y desde dónde se abrió (una gráfica): a ese botón vuelve el foco al cerrar. */
interface Elegida {
  readonly id: string;
  readonly origen: HTMLElement | null;
}

interface PropsPosiciones {
  readonly vista: Vista;
  readonly elegida: Elegida | null;
  readonly elegir: (id: string, origen: HTMLElement | null) => void;
  readonly alCerrar: () => void;
}

function Posiciones({ vista, elegida, elegir, alCerrar }: PropsPosiciones) {
  const [orden, setOrden] = useState<Orden>("valor");
  const base = useId();
  const idBoton = (id: string) => `${base}-especie-${id}`;
  const filas = useMemo(() => [...vista.filas].sort(orden === "nemo" ? porNemo : porCifra(orden)), [vista.filas, orden]);
  const sel = filas.find((f) => f.id === elegida?.id) ?? null;
  const elegirDesdeTabla = (id: string) => elegir(id, null);
  /** Devuelve el foco a donde se abrió (la gráfica o el botón de la especie) antes de quitar el panel. */
  const cerrar = () => {
    if (elegida) (elegida.origen?.isConnected ? elegida.origen : document.getElementById(idBoton(elegida.id)))?.focus();
    alCerrar();
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
              {filas.map((f) => <FilaPosicion key={f.id} f={f} activa={f.id === elegida?.id} idBoton={idBoton(f.id)} elegir={elegirDesdeTabla} />)}
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
        <li><b>Dividendos que vienen</b> con fecha ex y monto esperado</li>
        <li><b>Fondo inmobiliario</b> con su valor de unidad (SFC)</li>
        <li><b>Caja oficial</b> de A&amp;V en este resumen · su cuadre ya se ve en <a href="/conciliacion">Conciliación</a></li>
      </ul>
    </section>
  );
}

const RESULTADO_CONCILIACION: Readonly<Record<"CUADRA" | "NO_CUADRA" | "PARCIAL", string>> = {
  CUADRA: "cuadra",
  NO_CUADRA: "no cuadra",
  PARCIAL: "cuadra, con operaciones por liquidar",
};

/** La última conciliación con A&V, tal como quedó guardada; el detalle (y si sigue al día) está en /conciliacion. */
function LineaConciliacion({ linea }: { linea: LineaConciliacionVista }) {
  const texto = linea === null
    ? "Conciliación con A&V: todavía no hay certificación de A&V cargada"
    : `Conciliación con A&V al ${fecha(linea.fechaCorte)}: ${linea.resultado === null ? "todavía sin conciliar" : RESULTADO_CONCILIACION[linea.resultado]}`;
  return <p className="nota"><a href="/conciliacion">{texto}</a></p>;
}

interface PropsTablero {
  readonly vista: Vista;
  /** Opcional: sin el dato (pruebas de otras partes del tablero) no se pinta la línea. */
  readonly conciliacion?: LineaConciliacionVista;
  /** La evolución diaria y la TWR (src/tablero/evolucion.ts). Opcional, como la conciliación; null = no se pudo calcular. */
  readonly evolucion?: EvolucionVista | null;
  /** El familiar ve «Solo lectura» (frente familia-lectura); lo decide la página con la sesión revalidada. */
  readonly soloLectura?: boolean;
  /** La tarjeta del resumen DIARIO (E5), ya armada en el servidor. Opcional: sin ella no se pinta. */
  readonly resumenIa?: VistaResumenIa;
}

export function Tablero({ vista, conciliacion, evolucion, soloLectura = false, resumenIa }: PropsTablero) {
  const [elegida, setElegida] = useState<Elegida | null>(null);
  const elegir = (id: string, origen: HTMLElement | null) => setElegida({ id, origen });
  return (
    <>
      <Encabezado vista={vista} soloLectura={soloLectura} />
      <main className="wrap">
        {conciliacion === undefined ? null : <LineaConciliacion linea={conciliacion} />}
        <Respuesta vista={vista} />
        {resumenIa === undefined ? null : <TarjetaResumenIa vista={resumenIa} />}
        {evolucion === undefined ? null : <Evolucion evolucion={evolucion} />}
        <Movimientos mov={vista.movimiento} filas={vista.filas} />
        <Foto vista={vista} elegir={elegir} />
        <Posiciones vista={vista} elegida={elegida} elegir={elegir} alCerrar={() => setElegida(null)} />
        <Falta />
        <p className="nota">{pieDePrecios()}</p>
        <footer className="pie">El sistema calcula y muestra; no recomienda comprar ni vender. Datos de su base local.</footer>
      </main>
    </>
  );
}
