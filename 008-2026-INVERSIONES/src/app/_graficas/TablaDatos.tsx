"use client";
/**
 * La tabla de los datos de la gráfica de tiempo (el equivalente sin color ni puntero). Se arma solo al abrir
 * «Ver los datos»: cerrada no pesa en el celular ni compite con la tabla de especies.
 */
import { useState, type SyntheticEvent } from "react";
import type { PropsGraficaTiempo, Ventana } from "./tipos";

const SIN_DATO = "—";

export function TablaDatos({ p, ventana }: { readonly p: PropsGraficaTiempo; readonly ventana: Ventana }) {
  const [abierta, setAbierta] = useState(false);
  const alternar = (e: SyntheticEvent<HTMLDetailsElement>) => setAbierta(e.currentTarget.open);
  const indices = Array.from({ length: Math.max(0, ventana.hasta - ventana.desde + 1) }, (_, k) => ventana.desde + k);
  const celda = (v: number | null | undefined) => (v === null || v === undefined ? SIN_DATO : p.formatoY(v));
  return (
    <details className="g-datos" onToggle={alternar}>
      <summary>Ver los datos</summary>
      {abierta ? (
        <div className="g-datos-caja">
          <table>
            <caption>{p.titulo}</caption>
            <thead><tr>
              <th scope="col">Día</th>
              {p.series.map((s) => <th scope="col" key={s.id}>{s.nombre}</th>)}
              {(p.bandas ?? []).map((b) => <th scope="col" key={b.id}>{b.nombre}</th>)}
            </tr></thead>
            <tbody>
              {indices.map((i) => (
                <tr key={p.dias[i]}>
                  <th scope="row">{p.formatoDia(p.dias[i] ?? "")}</th>
                  {p.series.map((s) => <td key={s.id}>{celda(s.valores[i])}</td>)}
                  {(p.bandas ?? []).map((b) => {
                    const [bajo, alto] = [b.bajo[i], b.alto[i]];
                    return <td key={b.id}>{bajo === null || bajo === undefined || alto === null || alto === undefined ? SIN_DATO : `${celda(bajo)} – ${celda(alto)}`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}
