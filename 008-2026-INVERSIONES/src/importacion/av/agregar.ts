/**
 * Lotes del PDF → una posición por especie (la llave de certificacion_posicion es certificación + especie).
 * La cantidad y el valor se suman; el precio de valoración debe ser el mismo en todos los lotes de la especie.
 * La referencia deja todas las filas del PDF que se sumaron («p1:f2,p1:f3»).
 */
import { Prisma } from "@prisma/client";
import type { ErrorFilaAv, LoteCertificado } from "./filas";

export interface PosicionAgregada {
  readonly nemo: string;
  readonly cantidad: bigint;
  readonly precioValoracion: string;
  readonly valorMercado: string;
  readonly referenciaPdf: string;
}

export const referencia = (u: { readonly pagina: number; readonly numero: number }): string => `p${u.pagina}:f${u.numero}`;

export function agregarPosiciones(lotes: readonly LoteCertificado[]): { ok: true; valor: PosicionAgregada[] } | { ok: false; errores: ErrorFilaAv[] } {
  const porEspecie = new Map<string, LoteCertificado[]>();
  for (const l of lotes) porEspecie.set(l.nemo, [...(porEspecie.get(l.nemo) ?? []), l]);
  const errores: ErrorFilaAv[] = [];
  const valor = [...porEspecie.entries()].map(([nemo, delNemo]) => {
    const precio = delNemo[0]!.precio;
    for (const l of delNemo.filter((x) => x.precio !== precio)) {
      errores.push({ pagina: l.pagina, fila: l.numero, columna: "PRECIO VALORACIÓN", codigo: "PRECIO_INCONSISTENTE" });
    }
    return {
      nemo,
      cantidad: delNemo.reduce((s, l) => s + l.cantidad, 0n),
      precioValoracion: precio,
      valorMercado: delNemo.reduce((s, l) => s.add(l.valor), new Prisma.Decimal(0)).toString(),
      referenciaPdf: delNemo.map(referencia).join(","),
    };
  });
  return errores.length > 0 ? { ok: false, errores } : { ok: true, valor };
}
