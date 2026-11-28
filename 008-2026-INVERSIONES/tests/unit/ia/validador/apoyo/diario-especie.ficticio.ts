/**
 * Paquete DIARIO INVENTADO con una especie FICTICIA y fechas de 2027: los tres obligatorios y los seis datos de especie
 * (los de la política de sujeto EXIGIDO del catálogo). No toca `tests/unit/ia/apoyo/hechos.ficticio.ts`, que es compartido.
 */
import { entradaDeCatalogo, type ClaveDiario } from "@/ia/catalogo";
import type { EntradaHecho, EntradaPaquete, PaqueteHechos } from "@/ia/contrato";
import { construirPaquete, idDeHecho } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import { AYER_FICTICIO, HOY_FICTICIO, hecho } from "../../apoyo/hechos.ficticio";

const ESPECIE_DELTA = "FICTICIA-DELTA";

/** Valores inventados por clave; ninguno es de una base ni de un portafolio real. */
const VALORES: Readonly<Partial<Record<ClaveDiario, string>>> = {
  VALOR_ACCIONES: "52911.47",
  VARIACION_DIA_VALOR: "-318.62",
  GANANCIA_TOTAL: "1937.53",
  VALOR_ESPECIE: "6113.27",
  PESO_ESPECIE: "14.37",
  RENTABILIDAD_ESPECIE: "8.41",
  CIERRE_ESPECIE: "2713.9",
  FECHA_CIERRE_ESPECIE: AYER_FICTICIO,
  VARIACION_DIA_ESPECIE: "-0.73",
};

const OBLIGATORIOS = ["VALOR_ACCIONES", "VARIACION_DIA_VALOR", "GANANCIA_TOTAL"] as const;
const DE_ESPECIE = ["VALOR_ESPECIE", "PESO_ESPECIE", "RENTABILIDAD_ESPECIE", "CIERRE_ESPECIE", "FECHA_CIERRE_ESPECIE", "VARIACION_DIA_ESPECIE"] as const;

/** El hecho de la clave con la presentación que da `presentar` para la unidad del catálogo. */
function hechoDeClave<C extends ClaveDiario>(posicion: number, clave: C, extra: Partial<Omit<EntradaHecho<C>, "id" | "clave" | "valor" | "presentacion">> = {}): EntradaHecho<C> {
  const entrada = entradaDeCatalogo("DIARIO", clave);
  if (entrada === null) throw new Error("Clave fuera del catálogo en un apoyo de prueba.");
  const valor = VALORES[clave] ?? ESPECIE_DELTA;
  return hecho(idDeHecho(posicion), clave, valor, presentar(valor, entrada.unidad), extra);
}

export function entradaDiarioEspecie(): EntradaPaquete<"DIARIO"> {
  const nombre = hechoDeClave(1, "ESPECIE_NOMBRE");
  const obligatorios = OBLIGATORIOS.map((clave, i) => hechoDeClave(2 + i, clave, { obligatorio: true }));
  const deEspecie = DE_ESPECIE.map((clave, i) => hechoDeClave(2 + OBLIGATORIOS.length + i, clave, { sujeto: nombre.id }));
  return {
    tipo: "DIARIO",
    hoy: HOY_FICTICIO,
    versionesCalculo: { tablero: "tablero-ficticio-v7" },
    avisos: [],
    hechos: [nombre, ...obligatorios, ...deEspecie],
  };
}

export const paqueteDiarioEspecie = (): PaqueteHechos<"DIARIO"> => construirPaquete(entradaDiarioEspecie());
