/**
 * Pantalla del plan (fase B, corte 3). Componente del servidor, sin estado ni JavaScript en el navegador: el
 * historial de versiones son enlaces. Las acciones de la tabla son las de las reglas del dueño, nunca una sugerencia.
 */
import type { ReactNode } from "react";
import { FechaDato } from "../_comun/fecha-dato/FechaDato";
import { TarjetaResumenIa } from "../_comun/resumen-ia/TarjetaResumenIa";
import type { VistaResumenIa } from "../_comun/resumen-ia/tipos";
import { fecha, n, numero } from "../tablero/formato";
import { Encabezado } from "../_plan/Encabezado";
import { precio } from "../_plan/formato";
import { NOTA_INFERENCIA, PIE_PLAN, textoAccionRegla, textoCierre, textoCondicion, textoNivel, textoPlazo } from "../_plan/textos";
import type { DatosPlan, ReglaVista, VersionVista, VistaPlan } from "../_plan/tipos";
import "../_plan/plan.css";

const SIN_DATO = "—";
const ESTADO_VERSION: Readonly<Record<VersionVista["tipo"], string>> = { VIGENTE: "vigente", PROGRAMADA: "programada", HISTORICA: "rigió" };

function Versiones({ versiones }: { readonly versiones: readonly VersionVista[] }) {
  return (
    <nav className="bloque" aria-labelledby="t-versiones">
      <div className="cabeza"><div><div className="eyebrow">Historia</div><h2 id="t-versiones">Versiones del plan</h2></div></div>
      <ul className="versiones">
        {versiones.map((v) => (
          <li key={v.numero}>
            <a href={`/plan?version=${v.numero}`} aria-current={v.actual ? "page" : undefined}>{`Versión ${v.numero} · ${ESTADO_VERSION[v.tipo]} desde ${fecha(v.desde)}`}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CeldaCierre({ regla }: { readonly regla: ReglaVista }) {
  const t = textoCierre(regla.cierre ?? { estado: "NO_APLICA" });
  return (
    <td className="texto">
      <span className={t.aviso ? "dato aviso" : "dato"}>{t.principal}</span>
      {t.detalle ? <span className={`chip${t.aviso ? " aviso" : ""}`}>{t.detalle}</span> : null}
      {/* Cuándo lo trajo 008 y de dónde (frente fecha-hora-datos); la fecha del cierre ya la dice la celda. */}
      {regla.procedencia ? <FechaDato procedencia={regla.procedencia} sinFecha /> : null}
    </td>
  );
}

function Decisiones({ regla }: { readonly regla: ReglaVista }) {
  if (regla.decisiones === 0) return <>0</>;
  const etiqueta = regla.decisiones === 1 ? "1 decisión cita esta regla" : `${regla.decisiones} decisiones citan esta regla`;
  return <a href={`/decisiones?regla=${encodeURIComponent(regla.id)}`} aria-label={etiqueta}>{regla.decisiones}</a>;
}

function Fila({ regla, conCierres }: { readonly regla: ReglaVista; readonly conCierres: boolean }) {
  return (
    <tr id={`regla-${regla.id}`}>
      <th scope="row">{regla.especie ?? "Portafolio"}</th>
      <td className="texto">{textoCondicion(regla.condicion)}</td>
      <td className="num">{regla.nivel === null ? SIN_DATO : precio(regla.nivel)}</td>
      <td className="texto">{textoAccionRegla(regla.accion)}</td>
      <td className="num">{regla.cantidad === null ? SIN_DATO : numero(n(regla.cantidad))}</td>
      <td className={regla.plazoVencido ? "texto aviso" : "texto"}>{textoPlazo(regla.plazo, regla.plazoVencido)}</td>
      {conCierres ? (
        <>
          <CeldaCierre regla={regla} />
          <td className="texto">{textoNivel(regla.frente ?? { estado: "SIN_NIVEL" }, regla)}</td>
        </>
      ) : null}
      <td className="num"><Decisiones regla={regla} /></td>
      <td className="texto">{regla.detalle}</td>
    </tr>
  );
}

function Reglas({ vista }: { readonly vista: VistaPlan }) {
  return (
    <section className="bloque">
      <div className="cabeza"><div><div className="eyebrow">Una por una</div><h2 id="t-reglas">Reglas</h2></div></div>
      <div className="tabla" role="region" aria-labelledby="t-reglas" tabIndex={0}>
        <table aria-labelledby="t-reglas">
          <thead>
            <tr>
              <th scope="col">Especie</th><th scope="col">Condición</th><th scope="col" className="num">Nivel</th><th scope="col">Acción de su regla</th>
              <th scope="col" className="num">Cantidad</th><th scope="col">Plazo</th>
              {vista.conCierres ? <><th scope="col">Último cierre</th><th scope="col">Frente al nivel</th></> : null}
              <th scope="col" className="num">Decisiones</th><th scope="col">Detalle</th>
            </tr>
          </thead>
          <tbody>{vista.reglas.map((r) => <Fila key={r.id} regla={r} conCierres={vista.conCierres} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Portada({ titulo, children }: { readonly titulo: string; readonly children?: ReactNode }) {
  return (
    <section className="hero plan-hero" aria-labelledby="t-hero">
      <div className="eyebrow">Plan de inversión</div>
      <h1 id="t-hero">{titulo}</h1>
      {children}
    </section>
  );
}

function Vigencia({ vista }: { readonly vista: VistaPlan }) {
  const v = vista.version;
  if (v.tipo === "PROGRAMADA") return <p>{`Programada: entra a regir el ${fecha(v.desde)}.`}</p>;
  if (v.tipo === "HISTORICA") return <p>{`Histórica: rigió desde el ${fecha(v.desde)}.`}</p>;
  return <p>{`Vigente desde el ${fecha(v.desde)}. Motivo: ${v.motivo}.`}</p>;
}

function Version({ vista, entrada }: { readonly vista: VistaPlan; readonly entrada: ReactNode }) {
  const v = vista.version;
  return (
    <>
      <Portada titulo={v.tipo === "VIGENTE" ? `Plan vigente: versión ${v.numero}` : `Versión ${v.numero} del plan`}>
        <Vigencia vista={vista} />
        {v.tipo !== "VIGENTE" ? <p className="nota">{`Motivo: ${v.motivo}. Los cierres y la distancia al nivel se muestran solo en la versión vigente.`}</p> : null}
        <p className="nota">{`Aprobada el ${fecha(vista.aprobadaEl)}.`}</p>
        {vista.programada ? <p className="nota"><a href={`/plan?version=${vista.programada.numero}`}>{`La versión ${vista.programada.numero} entra a regir el ${fecha(vista.programada.desde)}.`}</a></p> : null}
        {vista.conCierres ? <p className="nota">{vista.referencia ? `Cierres al ${fecha(vista.referencia)}` : "Todavía no hay cierres de las especies del portafolio."}</p> : null}
        {vista.preciosAtrasados && vista.referencia ? <p className="nota aviso" role="status">{`Los precios no se han actualizado desde el ${fecha(vista.referencia)}.`}</p> : null}
        {entrada}
      </Portada>
      <Reglas vista={vista} />
    </>
  );
}

/** La entrada al área de edición: solo el dueño la ve, y es un enlace (esta pantalla no tiene formularios). */
function Entrada({ texto }: { readonly texto: string }) {
  return <p className="entradas-edicion"><a className="entrada-edicion" href="/edicion/plan">{texto}</a></p>;
}

function Contenido({ datos, soloLectura }: { readonly datos: DatosPlan; readonly soloLectura: boolean }) {
  switch (datos.estado) {
    case "SIN_PLAN":
      return (
        <Portada titulo="Todavía no hay un plan cargado">
          <p>Cuando se cargue el plan, aquí se verán sus reglas.</p>
          {soloLectura ? null : <Entrada texto="Crear la primera versión del plan" />}
        </Portada>
      );
    case "VERSION_INVALIDA":
      return <><Portada titulo="No hay una versión del plan con ese número"><p>Elija una de las versiones cargadas.</p></Portada><Versiones versiones={datos.versiones} /></>;
    case "VERSION":
      return <><Version vista={datos.vista} entrada={soloLectura ? null : <Entrada texto="Nueva versión del plan" />} /><Versiones versiones={datos.versiones} /></>;
  }
}

interface PropsPlan {
  readonly datos: DatosPlan;
  readonly soloLectura?: boolean;
  /** La tarjeta del resumen REGLAS (E5), solo en la vista de hoy (sin `?version=`). */
  readonly resumenIa?: VistaResumenIa;
}

export function Plan({ datos, soloLectura = false, resumenIa }: PropsPlan) {
  const inferencia = datos.estado === "VERSION" && datos.vista.hayInferencia;
  return (
    <>
      <Encabezado actual="plan" soloLectura={soloLectura} />
      <main className="wrap plan">
        <Contenido datos={datos} soloLectura={soloLectura} />
        {/* Después del contenido: su h2 no va antes del h1 de la portada. */}
        {resumenIa === undefined ? null : <TarjetaResumenIa vista={resumenIa} />}
        <footer className="pie">
          {inferencia ? <p>{NOTA_INFERENCIA}</p> : null}
          <p>{PIE_PLAN}</p>
        </footer>
      </main>
    </>
  );
}
