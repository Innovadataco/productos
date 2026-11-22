"use client";
/**
 * «Cómo está repartido» (frente graficas-tablero): la composición por valor y la rentabilidad sin vender de cada
 * especie, a los cierres del tablero. Cada cifra lleva a su origen: el clic abre el detalle de la especie (y al
 * cerrarlo el foco vuelve aquí). Las cifras vienen del servidor (src/tablero/composicion.ts y calculo.ts).
 */
import { FechaDatoCompuesta } from "@/app/_comun/fecha-dato/FechaDato";
import { Barras, Dona, type FilaBarra, type Segmento } from "@/app/_graficas";
import { cop, fecha, n, numero, pct } from "./formato";
import { procedenciaDeFilas } from "./procedencia";
import type { FilaVista, Vista } from "./tipos";

/**
 * El estado y la fecha del cierre. Cuándo lo trajo 008 y de dónde (frente fecha-hora-datos) NO van aquí: alargarían el
 * nombre del botón de cada barra y no se parten a 375 px (revisión a11y). Están en su fila, en su detalle (al que lleva
 * el clic) y bajo las gráficas.
 */
const estadoCierre = (f: FilaVista) => (f.cierre ? `${f.cierre.verificado ? "verificado A&V" : "sin verificar"} · ${fecha(f.cierre.fecha)}` : "sin cierre");
const detalle = (f: FilaVista) => `costo ${cop(n(f.costo))} · valor ${f.valor ? cop(n(f.valor)) : "—"} · ${estadoCierre(f)}`;

function segmentos(vista: Vista): Segmento[] {
  return vista.composicion.map((t) => ({
    id: t.id, nombre: t.nemo, valor: n(t.valor), textoValor: cop(n(t.valor)), textoPct: `${numero(n(t.pesoPct), 1)} %`,
    // «Otras» es la única tajada con miembros (src/tablero/composicion.ts): no abre detalle y dice qué junta.
    ...(t.miembros.length > 0 ? { tono: "neutro" as const, elegible: false, detalle: `Incluye ${t.miembros.join(", ")}` } : {}),
  }));
}

function barras(vista: Vista): FilaBarra[] {
  return vista.filas
    .filter((f) => f.rentabilidadPct !== null)
    .sort((a, b) => n(b.rentabilidadPct) - n(a.rentabilidadPct) || (a.nemo < b.nemo ? -1 : 1))
    .map((f) => ({ id: f.id, nombre: f.nemo, valor: n(f.rentabilidadPct), texto: pct(n(f.rentabilidadPct)), detalle: detalle(f) }));
}

function Cuando({ vista }: { readonly vista: Vista }) {
  const { fechaReferencia: ref, cierreMasViejo: viejo } = vista;
  if (ref !== null && viejo !== null && viejo !== ref) return <>Cierres del {fecha(viejo)} al {fecha(ref)}</>;
  return <>Al cierre del {fecha(ref)}</>;
}

export function Foto({ vista, elegir }: { readonly vista: Vista; readonly elegir: (id: string, origen: HTMLElement) => void }) {
  const tajadas = segmentos(vista);
  const filas = barras(vista);
  const sinPrecio = vista.filas.filter((f) => f.valor === null).map((f) => f.nemo);
  const compuesta = procedenciaDeFilas(vista.filas);
  return (
    <section className="bloque entra d3" aria-labelledby="t-foto">
      <div className="cabeza"><div><div className="eyebrow"><Cuando vista={vista} /></div><h2 id="t-foto">Cómo está repartido</h2></div></div>
      <div className="g-par">
        <Dona
          titulo="Composición" segmentos={tajadas} alElegir={elegir}
          centro={{ etiqueta: "Valor en acciones", texto: cop(n(vista.valorAcciones)) }}
          resumen={`Composición por valor: ${tajadas.map((s) => `${s.nombre} ${s.textoPct} (${s.textoValor})`).join("; ")}.`}
        />
        <Barras
          titulo="Rentabilidad sin vender por especie" filas={filas} alElegir={elegir}
          resumen={`Rentabilidad sin vender sobre su costo: ${filas.map((f) => `${f.nombre} ${f.texto}`).join("; ")}.`}
        />
      </div>
      {compuesta ? <FechaDatoCompuesta compuesta={compuesta} /> : null}
      {sinPrecio.length > 0 ? <p className="nota aviso">Sin cierre (no entra aquí): {sinPrecio.join(" · ")}.</p> : null}
      <p className="nota">Rentabilidad sin vender = ganancia sin vender sobre el costo de lo que tiene (la columna % de la tabla). Toque una especie para ver su detalle.</p>
    </section>
  );
}
