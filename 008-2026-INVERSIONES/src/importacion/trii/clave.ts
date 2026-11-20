import { createHash } from "node:crypto";
import type { Registro } from "./filas";

/** sha256 hexadecimal de los campos canónicos, en orden fijo de claves. */
export function claveNatural(registro: Registro): string {
  const pares = Object.keys(registro.canonico)
    .sort()
    .map((k) => [k, registro.canonico[k]] as const);
  return createHash("sha256").update(JSON.stringify([registro.tipo, pares])).digest("hex");
}

export interface RegistroConClave {
  readonly registro: Registro;
  readonly fila: number;
  readonly clave: string;
  /** n-ésima fila idéntica dentro del mismo archivo (1, 2, …): dos filas iguales legítimas no se fusionan. */
  readonly ocurrencia: number;
  /** La fila tal cual vino (encabezado → celda), para la trazabilidad. */
  readonly crudo: Readonly<Record<string, string>>;
}

/** Desempate estable dentro de un grupo de filas con la misma clave: no depende del orden del archivo. */
function huella(registro: Registro): string {
  return JSON.stringify(registro.hecho, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
}

export function asignarClaves(
  registros: readonly { registro: Registro; fila: number; crudo?: Readonly<Record<string, string>> }[],
): RegistroConClave[] {
  const conClave = registros.map((r) => ({ ...r, clave: claveNatural(r.registro), huella: huella(r.registro) }));
  const grupos = new Map<string, typeof conClave>();
  for (const r of conClave) grupos.set(r.clave, [...(grupos.get(r.clave) ?? []), r]);
  const ocurrencias = new Map<(typeof conClave)[number], number>();
  for (const grupo of grupos.values()) {
    [...grupo].sort((a, b) => (a.huella < b.huella ? -1 : a.huella > b.huella ? 1 : a.fila - b.fila))
      .forEach((r, i) => ocurrencias.set(r, i + 1));
  }
  return conClave.map((r) => ({ registro: r.registro, fila: r.fila, clave: r.clave, ocurrencia: ocurrencias.get(r)!, crudo: r.crudo ?? {} }));
}
