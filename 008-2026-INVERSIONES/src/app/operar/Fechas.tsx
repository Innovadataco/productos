/**
 * «Fechas» de /operar: los ex-dividendos y los plazos de las reglas de hoy a hoy + DIAS_FECHAS, en orden. Componente del
 * servidor.
 */
import { textoFecha, textoSinFechas, textoTituloFechas, textoVentana } from "./textos";
import type { FechaVista } from "./tipos";

function Fecha({ f }: { readonly f: FechaVista }) {
  const t = textoFecha(f);
  return <li className="op-fecha"><time dateTime={f.fecha}>{t.cuando}</time>{` · ${t.que}: ${t.detalle}`}</li>;
}

interface PropsFechas {
  readonly fechas: readonly FechaVista[];
  readonly hoy: string;
  readonly hasta: string;
}

export function Fechas({ fechas, hoy, hasta }: PropsFechas) {
  return (
    <section className="bloque" aria-labelledby="t-fechas">
      <div className="cabeza"><div><div className="eyebrow">Ex-dividendos y plazos</div><h2 id="t-fechas">{textoTituloFechas()}</h2></div></div>
      <p className="nota">{textoVentana(hoy, hasta)}</p>
      {fechas.length === 0
        ? <p className="nota">{textoSinFechas()}</p>
        : <ol className="op-fechas" role="list">{fechas.map((f) => <Fecha key={`${f.tipo}-${f.id}`} f={f} />)}</ol>}
    </section>
  );
}
