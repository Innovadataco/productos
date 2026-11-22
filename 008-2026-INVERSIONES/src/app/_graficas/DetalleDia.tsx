"use client";
/** El detalle de un día de la gráfica de tiempo: el valor primero y el nombre después; también en texto para anunciarlo. */
import type { PropsGraficaTiempo, Tono } from "./tipos";

interface FilaDia { readonly id: string; readonly tono: Tono; readonly valor: string; readonly nombre: string; readonly banda: boolean }

function filasDelDia(p: PropsGraficaTiempo, i: number): FilaDia[] {
  const series = p.series.flatMap((s) => {
    const v = s.valores[i];
    return v === null || v === undefined ? [] : [{ id: s.id, tono: s.tono, valor: p.formatoY(v), nombre: s.nombre, banda: false }];
  });
  const bandas = (p.bandas ?? []).flatMap((b) => {
    const [bajo, alto] = [b.bajo[i], b.alto[i]];
    if (bajo === null || bajo === undefined || alto === null || alto === undefined) return [];
    return [{ id: b.id, tono: b.tono, valor: `${p.formatoY(bajo)} – ${p.formatoY(alto)}`, nombre: b.nombre, banda: true }];
  });
  return [...series, ...bandas];
}

/** Lo que se anuncia al recorrer con el teclado: el día, cada valor con su nombre y la línea extra. */
export function textoDelDia(p: PropsGraficaTiempo, i: number): string {
  const extra = p.extraDetalle?.(i) ?? null;
  return [p.formatoDia(p.dias[i] ?? ""), ...filasDelDia(p, i).map((f) => `${f.valor} ${f.nombre}`), ...(extra ? [extra] : [])].join(" · ");
}

export function DetalleDia({ p, indice, posicion }: { readonly p: PropsGraficaTiempo; readonly indice: number; readonly posicion: number }) {
  const extra = p.extraDetalle?.(indice) ?? null;
  return (
    <div className="g-tip" data-lado={posicion < 50 ? "der" : "izq"} style={{ left: `${posicion}%` }}>
      <div className="g-tip-dia">{p.formatoDia(p.dias[indice] ?? "")}</div>
      {filasDelDia(p, indice).map((f) => (
        <div className="g-tip-fila" key={f.id}>
          <i className={`${f.banda ? "g-clave-banda" : "g-clave"} t-${f.tono}`} aria-hidden="true" /><b>{f.valor}</b> <span>{f.nombre}</span>
        </div>
      ))}
      {extra ? <div className="g-tip-extra">{extra}</div> : null}
    </div>
  );
}
