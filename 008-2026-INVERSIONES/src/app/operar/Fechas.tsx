/**
 * «Fechas» de /operar: los ex-dividendos y los plazos de las reglas de hoy a hoy + 30, en orden. Componente del servidor.
 */
import { textoFecha } from "./textos";
import type { FechaVista } from "./tipos";

function Fecha({ f }: { readonly f: FechaVista }) {
  const t = textoFecha(f);
  return <li className={`op-fecha op-${f.tipo === "EX_DIVIDENDO" ? "ex" : "plazo"}`}><time dateTime={f.fecha}>{t.cuando}</time>{` · ${t.que}: ${t.detalle}`}</li>;
}

export function Fechas({ fechas }: { readonly fechas: readonly FechaVista[] }) {
  return (
    <section className="bloque" aria-labelledby="t-fechas">
      <div className="cabeza"><div><div className="eyebrow">Ex-dividendos y plazos</div><h2 id="t-fechas">Fechas de los próximos 30 días</h2></div></div>
      {fechas.length === 0
        ? <p className="nota">No hay ex-dividendos ni plazos de reglas en los próximos 30 días.</p>
        : <ol className="op-fechas">{fechas.map((f) => <Fecha key={`${f.tipo}-${f.id}`} f={f} />)}</ol>}
    </section>
  );
}
