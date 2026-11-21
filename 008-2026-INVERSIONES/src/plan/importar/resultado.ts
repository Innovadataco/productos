/** Resultado de una importación de la ficha: conteos, códigos y líneas. Nunca valores. */
import type { FichaLeida, Hallazgo } from "./tipos";

export type ModoImportacion = "ENSAYO" | "APLICAR";
/**
 * LISTO: el ensayo no encontró bloqueos y hay algo por crear · SIN_CAMBIOS: ya estaba todo en la base ·
 * BLOQUEADO: hay bloqueos, no se escribió nada · APLICADO · FALLO_PARCIAL: se cortó a mitad (repetir
 * el comando completa lo que falta) · CANDADO_OCUPADO: otra importación en curso, no se escribió nada.
 */
export type EstadoImportacion = "LISTO" | "SIN_CAMBIOS" | "BLOQUEADO" | "APLICADO" | "FALLO_PARCIAL" | "CANDADO_OCUPADO";

export interface Conteo {
  readonly leidas: number;
  /** En el ensayo, lo que se crearía; al aplicar, lo que se creó. */
  readonly nuevas: number;
  readonly existentes: number;
}

export interface ResultadoImportacion {
  readonly modo: ModoImportacion;
  readonly estado: EstadoImportacion;
  readonly versiones: Conteo;
  readonly reglas: Conteo;
  readonly decisiones: Conteo;
  readonly noImportados: readonly Hallazgo[];
  readonly avisos: readonly Hallazgo[];
  readonly bloqueos: readonly Hallazgo[];
  /** Solo en FALLO_PARCIAL: dónde se cortó. */
  readonly error: Hallazgo | null;
}

/** Lo que se sabe solo con la ficha, antes de mirar la base. */
export function resumenLectura(ficha: FichaLeida, modo: ModoImportacion): ResultadoImportacion {
  const plan = ficha.plan;
  const leidas = (n: number) => ({ leidas: n, nuevas: 0, existentes: 0 });
  return {
    modo,
    estado: ficha.bloqueos.length > 0 ? "BLOQUEADO" : "LISTO",
    versiones: leidas(plan ? 1 : 0),
    reglas: leidas(plan?.reglas.length ?? 0),
    decisiones: leidas(plan?.decisiones.length ?? 0),
    noImportados: ficha.noImportados,
    avisos: ficha.avisos,
    bloqueos: ficha.bloqueos,
    error: null,
  };
}
