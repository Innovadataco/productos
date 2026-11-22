/**
 * De una corrida de las puertas (`generarConPuertas`, src/ia/puertas.ts) a las entradas FALLIDO que registra el servicio:
 * una por cada puerta que falló y una sin puerta si la guarda rechazó el pedido (VISTA_NO_CIEGA). El éxito no sale de
 * aquí: lo registra quien lo valida (PUBLICADO o RECHAZADO con los códigos del validador). APAGADO no es un fallo: nada.
 * Puro; cada entrada pasa `filaDeResumen`.
 */
import type { FalloGeneracion } from "../generador";
import type { ResultadoPuertas } from "../puertas";
import type { EntradaFallido, EntradaResumen } from "./fila";

/** Lo que comparten las filas de una corrida: el paquete, el prompt, las opciones y la versión del validador. */
export type ComunCorrida = Pick<EntradaResumen, "paquete" | "prompt" | "opciones" | "validadorVersion">;

const deFallo = (comun: ComunCorrida, fallo: FalloGeneracion): EntradaFallido =>
  Object.freeze({ ...comun, estado: "FALLIDO", puerta: fallo.puerta, motivo: fallo.motivo, detalles: Object.freeze([fallo.detalle]) });

/** Las entradas FALLIDO de una corrida, en el orden de las puertas. */
export function fallidosDeCorrida(resultado: ResultadoPuertas, comun: ComunCorrida): readonly EntradaFallido[] {
  switch (resultado.estado) {
    case "APAGADO":
      return Object.freeze([]);
    case "VISTA_NO_CIEGA":
      return Object.freeze([Object.freeze({ ...comun, estado: "FALLIDO", puerta: null, motivo: "VISTA_NO_CIEGA", detalles: Object.freeze([...resultado.codigos]) } as const)]);
    case "FALLO":
      return Object.freeze(resultado.fallos.map((f) => deFallo(comun, f)));
    case "EXITO":
      return Object.freeze(resultado.fallosPrevios.map((f) => deFallo(comun, f)));
  }
}
