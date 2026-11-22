/**
 * El pedido de una versión nueva del plan (POST /api/plan/versiones) → los datos de `crearVersionPlan`. Puro.
 * Claves exactas, topes y tipos; el nivel y la cantidad, como los escribe el dueño (es-CO, la lectura de la ficha).
 * Lo demás (nivel según la condición, plazo ≥ vigencia, textos vacíos, sin reglas…) lo valida el dominio.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import type { DatosRegla } from "../validar";
import { CUERPO_INVALIDO, Errores, MAX_REGLAS, cantidad, enumerado, fecha, fechaOpcional, idOpcional, nivel, numeroDeVersion, objetoConClaves, texto, type Lectura } from "./comun";

const CLAVES = ["vigenteDesde", "motivo", "versionBase", "reglas"] as const;
const CLAVES_REGLA = ["instrumentoId", "condicion", "nivel", "accion", "cantidad", "plazoHasta", "detalle"] as const;

export interface PedidoVersion {
  readonly vigenteDesde: Date;
  readonly motivo: string;
  /** La última versión que vio el formulario (0 si no había ninguna). */
  readonly versionBase: number;
  readonly reglas: readonly DatosRegla[];
}

function leerRegla(e: Errores, valor: unknown, i: number): DatosRegla | undefined {
  const c = (campo: string) => `reglas[${i}].${campo}`;
  const r = objetoConClaves(valor, CLAVES_REGLA);
  if (!r) return e.anotar(`reglas[${i}]`, "FORMATO_INVALIDO");
  const regla = {
    instrumentoId: idOpcional(e, c("instrumentoId"), r["instrumentoId"]),
    condicion: enumerado<CondicionRegla>(e, c("condicion"), r["condicion"]),
    nivel: nivel(e, c("nivel"), r["nivel"]),
    accion: enumerado<AccionPlan>(e, c("accion"), r["accion"]),
    cantidad: cantidad(e, c("cantidad"), r["cantidad"]),
    plazoHasta: fechaOpcional(e, c("plazoHasta"), r["plazoHasta"]),
    detalle: texto(e, c("detalle"), r["detalle"]),
  };
  return Object.values(regla).includes(undefined) ? undefined : (regla as DatosRegla);
}

export function leerPedidoVersion(valor: unknown): Lectura<PedidoVersion> {
  const v = objetoConClaves(valor, CLAVES);
  if (!v) return CUERPO_INVALIDO;
  const e = new Errores();
  const vigenteDesde = fecha(e, "vigenteDesde", v["vigenteDesde"]);
  const motivo = texto(e, "motivo", v["motivo"]);
  const versionBase = numeroDeVersion(e, "versionBase", v["versionBase"]);
  const crudas = v["reglas"];
  if (!Array.isArray(crudas)) e.anotar("reglas", "FORMATO_INVALIDO");
  else if (crudas.length > MAX_REGLAS) e.anotar("reglas", "REGLAS_DEMASIADAS");
  const reglas = Array.isArray(crudas) && crudas.length <= MAX_REGLAS ? crudas.map((r, i) => leerRegla(e, r, i)) : [];
  if (e.hay || vigenteDesde === undefined || motivo === undefined || versionBase === undefined) return { ok: false, errores: e.lista };
  return { ok: true, valor: { vigenteDesde, motivo, versionBase, reglas: reglas as DatosRegla[] } };
}
