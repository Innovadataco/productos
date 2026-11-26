/**
 * NIVEL_CRUZADO y NIVEL_CERCA (puro). Usa `estadoDelNivel` (src/plan/niveles.ts) sin modificarlo.
 * - TOCADA: el precio quedó del lado de la regla → NIVEL_CRUZADO. EN_EL_NIVEL y una distancia menor que el umbral → NIVEL_CERCA.
 * - La distancia es la de `estadoDelNivel` (redondeada a 2 decimales): lo que se muestra es lo que se compara, así 2,99 es «cerca»
 *   y 3,00 no. Se toma en valor absoluto: estar a 2 % por encima del nivel de una regla «bajo» también es estar cerca.
 * - Sin precio no salta. El sentido es el de la condición de la regla.
 */
import type { CondicionRegla, Prisma } from "@prisma/client";
import { estadoDelNivel } from "../../plan/niveles";
import { claveDeAlerta, type Alerta, type PrecioEvaluado, type Sentido } from "../tipos";
import type { Umbrales } from "../umbrales";

export interface EntradaNivel {
  readonly reglaId: string;
  readonly instrumentoId: string;
  readonly condicion: CondicionRegla;
  readonly nivel: Prisma.Decimal | null;
  readonly precio: PrecioEvaluado | null;
  /** Día de Colombia, AAAA-MM-DD (para la clave). */
  readonly dia?: string;
}

export function evaluarNivel(entrada: EntradaNivel, umbrales: Umbrales): Alerta | null {
  const { reglaId, instrumentoId, condicion, nivel, precio, dia = "" } = entrada;
  // Un precio no positivo no es un precio: `estadoDelNivel` toma el cero como positivo y lo daría por cruzado.
  if (precio === null || !precio.precio.gt(0)) return null;
  const estado = estadoDelNivel(condicion, nivel, precio.precio);
  const sentidoRegla: Sentido = condicion === "CIERRE_BAJO" ? "BAJO" : "SOBRE";
  const comunes = { dia, instrumentoId, reglaId, base: precio.base } as const;
  const datos = { nivel: nivel ?? undefined, precio: precio.precio, instante: precio.instante, conRetraso: precio.conRetraso };
  if (estado.estado === "TOCADA") {
    if (!umbrales.alertaNivelCruzadoActiva) return null;
    return { ...comunes, clave: claveDeAlerta(dia, "NIVEL_CRUZADO", instrumentoId, reglaId, estado.lado), tipo: "NIVEL_CRUZADO", sentido: estado.lado, datos };
  }
  if (!umbrales.alertaCercaActiva) return null;
  const cerca = estado.estado === "EN_EL_NIVEL" || (estado.estado === "A_DISTANCIA" && estado.distanciaPct.abs().lt(umbrales.alertaCercaPct));
  if (!cerca) return null;
  const distanciaPct = estado.estado === "A_DISTANCIA" ? estado.distanciaPct.abs() : undefined;
  return { ...comunes, clave: claveDeAlerta(dia, "NIVEL_CERCA", instrumentoId, reglaId, sentidoRegla), tipo: "NIVEL_CERCA", sentido: sentidoRegla, datos: { ...datos, distanciaPct } };
}
