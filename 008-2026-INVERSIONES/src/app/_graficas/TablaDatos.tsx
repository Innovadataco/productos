"use client";
/**
 * La tabla de los datos de la gráfica de tiempo (el equivalente sin color ni puntero). Se arma solo al abrir
 * «Ver los datos»: cerrada no pesa en el celular ni compite con la tabla de especies. La ventana llega en primitivos
 * para que el memo la deje quieta durante los cuadros de la animación del dominio. La caja, que se desplaza, es una
 * región enfocable con nombre: con el teclado también se recorre (a11y-architect, frente proyecciones-pantalla).
 */
import { memo, useState, type SyntheticEvent } from "react";
import type { PropsGraficaTiempo } from "./tipos";

const SIN_DATO = "—";

export const TablaDatos = memo(function TablaDatos({ p, desde, hasta }: { readonly p: PropsGraficaTiempo; readonly desde: number; readonly hasta: number }) {
  const [abierta, setAbierta] = useState(false);
  const alternar = (e: SyntheticEvent<HTMLDetailsElement>) => setAbierta(e.currentTarget.open);
  const indices = Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, k) => desde + k);
  const celda = (v: number | null | undefined) => (v === null || v === undefined ? SIN_DATO : p.formatoY(v));
  return (
    <details className="g-datos" onToggle={alternar}>
      <summary>Ver los datos</summary>
      {abierta ? (
        <div className="g-datos-caja" role="region" tabIndex={0} aria-label={`Datos de ${p.titulo}`}>
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
});
