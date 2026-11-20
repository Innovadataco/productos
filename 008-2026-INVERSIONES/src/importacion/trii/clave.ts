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

/**
 * La ocurrencia sigue el ORDEN DE APARICIÓN en el archivo (Trii exporta en orden cronológico).
 * No se ordena por contenido: estado, cantidades y totales cambian entre exportaciones y
 * cambiarían qué fila es la 1 y cuál la 2. Límite conocido: si una exportación trae solo una
 * parte de un grupo de filas con la misma clave (mismo minuto, especie y lado), puede chocar
 * como conflicto; falla del lado seguro (rechaza, no duplica).
 */
export function asignarClaves(
  registros: readonly { registro: Registro; fila: number; crudo?: Readonly<Record<string, string>> }[],
): RegistroConClave[] {
  const vistas = new Map<string, number>();
  return registros.map(({ registro, fila, crudo }) => {
    const clave = claveNatural(registro);
    const ocurrencia = (vistas.get(clave) ?? 0) + 1;
    vistas.set(clave, ocurrencia);
    return { registro, fila, clave, ocurrencia, crudo: crudo ?? {} };
  });
}
