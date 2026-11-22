/**
 * DIRECCION_CONTRADICE: una palabra que afirma una marca de un hecho (subió, bajó o se mantuvo; cerca o lejos; hoy) se
 * atribuye a la cita más cercana que no sea un nombre (`atribuir`) y se coteja contra la marca DEL PAQUETE:
 * - dirección: contradice si la del hecho es otra, también NO_APLICA (el código no calculó un movimiento);
 * - cercanía: contradice si la del hecho es otra, también NO_APLICA;
 * - «hoy»: contradice si la frescura del hecho no es HOY.
 * Una palabra de marca en una frase que no cita ningún hecho (que no sea un nombre) afirma algo sin dato:
 * DIRECCION.SIN_HECHO.
 */
import type { Hecho } from "../contrato";
import type { CodigoValidador } from "./codigos";
import type { HechosPorId } from "./hechos";
import { posiciones, type MarcaDelHecho, type TextoPreparado } from "./patron";
import { PATRONES_MARCA } from "./patrones-lengua";
import type { Atribucion } from "./texto";

export interface HallazgoDeMarca {
  readonly codigo: CodigoValidador;
  readonly patron: string;
}

const CODIGO: CodigoValidador = "DIRECCION_CONTRADICE";

export function contradice(marca: MarcaDelHecho, hecho: Hecho): boolean {
  switch (marca.campo) {
    case "direccion":
      return hecho.direccion !== marca.valor;
    case "cercania":
      return hecho.cercania !== marca.valor;
    case "frescura":
      return hecho.frescura !== marca.valor;
  }
}

export function revisarMarcas(preparado: TextoPreparado, atribucion: Atribucion, porId: HechosPorId): readonly HallazgoDeMarca[] {
  const patrones = new Set<string>();
  for (const p of PATRONES_MARCA) {
    for (const posicion of posiciones(preparado, p)) {
      const destinos = atribucion.destinosEn(posicion);
      if (destinos.length === 0) patrones.add("DIRECCION.SIN_HECHO");
      if (destinos.some((id) => contradice(p.marca, porId.get(id) as Hecho))) patrones.add(p.id);
    }
  }
  return Object.freeze([...patrones].map((patron) => Object.freeze({ codigo: CODIGO, patron })));
}
