/**
 * La tarjeta de resumen (E5): las frases, el aviso fijo, «Cifras usadas» (fuente, fecha y calidad), el pie que dice quién
 * redactó, la fecha y hora del último análisis, la vigencia, el motivo del último rechazo (si lo hubo) y, solo para el
 * dueño con el interruptor encendido, el botón «Analizar con IA» (un componente de cliente: lo único con directiva). Sin directiva ni hooks: la pintan igual el servidor (plan, proyecciones) y el tablero (cliente),
 * que la recibe ya armada. Solo texto plano: React lo escapa; sin HTML crudo ni enlaces.
 */
import { dateTimeColombia } from "../fecha-dato/hora";
import { BotonAnalizar } from "./BotonAnalizar";
import { TEXTOS_RESUMEN_IA } from "./textos";
import type { VistaResumenIa } from "./tipos";
import "./resumen-ia.css";

function Vigencia({ vista }: { readonly vista: VistaResumenIa }) {
  if (vista.vigencia === null) return null;
  const texto = TEXTOS_RESUMEN_IA.vigencia[vista.vigencia];
  return <p className={vista.vigencia === "DESACTUALIZADO" ? "resumen-ia-desactualizado" : "resumen-ia-vigencia"}>{texto}</p>;
}

function Pie({ vista }: { readonly vista: VistaResumenIa }) {
  const dateTime = vista.redactadoEn === null ? null : dateTimeColombia(vista.redactadoEn);
  return (
    <p className="resumen-ia-pie">
      {vista.pie}
      {vista.redactadoEn === null ? null : <>{` · ${TEXTOS_RESUMEN_IA.redactadoEn} `}<time dateTime={dateTime ?? undefined}>{vista.redactadoEn}</time></>}
    </p>
  );
}

function Cifras({ vista }: { readonly vista: VistaResumenIa }) {
  if (vista.cifras.length === 0) return null;
  return (
    <details className="resumen-ia-cifras">
      <summary>{TEXTOS_RESUMEN_IA.cifrasUsadas}</summary>
      <ul>
        {vista.cifras.map((c) => (
          <li key={c.id}>{`${c.etiqueta}: ${c.presentacion} · ${c.fuente} · `}<time dateTime={c.fecha}>{c.fechaPresentada}</time>{` · ${c.calidad}`}</li>
        ))}
      </ul>
    </details>
  );
}

export function TarjetaResumenIa({ vista }: { readonly vista: VistaResumenIa }) {
  const id = `t-resumen-ia-${vista.tipo.toLowerCase()}`;
  return (
    <section className="resumen-ia" aria-labelledby={id} data-estado={vista.estado}>
      <div className="resumen-ia-cuerpo">
        <div className="eyebrow">{TEXTOS_RESUMEN_IA.eyebrow}</div>
        <h2 id={id}>{vista.titulo}</h2>
        {vista.analisisDel === null ? null : <p className="resumen-ia-analisis">{vista.analisisDel}</p>}
        {vista.frases.length === 0 ? null : (
          <ul className="resumen-ia-frases">
            {/* Las frases son fijas para cada vista (no se reordenan): el índice sirve de clave. */}
            {vista.frases.map((f, k) => <li key={k}>{f}</li>)}
          </ul>
        )}
        {vista.nota === null ? null : <p className="resumen-ia-nota">{vista.nota}</p>}
        {vista.sinIa === null ? null : <p className="resumen-ia-sin-ia">{vista.sinIa}</p>}
        <Vigencia vista={vista} />
        {vista.descartado === null ? null : <p className="resumen-ia-descartado">{vista.descartado}</p>}
        {vista.fallo === null ? null : <p className="resumen-ia-fallo">{vista.fallo}</p>}
        {vista.rechazo === null ? null : <p className="resumen-ia-rechazo">{vista.rechazo}</p>}
        {vista.aviso === null ? null : <p className="resumen-ia-aviso">{vista.aviso}</p>}
        <Cifras vista={vista} />
        <Pie vista={vista} />
        {vista.puedeAnalizar ? <BotonAnalizar key={vista.tipo} tarea={vista.tipo} /> : null}
      </div>
    </section>
  );
}
