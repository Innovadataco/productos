// Apoyo de las pruebas de la tarjeta de resumen (frente ia-resumenes-pantalla): paquetes INVENTADOS (los de las pruebas
// de src/ia, con especies FICTICIA-* y días de 2027) y un PUBLICADO armado con la plantilla, como lo devolvería
// `ultimoPublicado`. Nada sale de una base ni de datos reales.
import type { PaqueteHechos, TipoResumen } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { ENTRADAS_FICTICIAS } from "../ia/apoyo/hechos.ficticio";

export const MODELO_FICTICIO = "ficticio-modelo:7b";
export const GENERADO_FICTICIO = new Date("2027-03-17T23:41:37.000Z");

/** El paquete inventado del tipo; con `aviso`, otro paquete (otro hash) con los mismos hechos; con `hoy`, otro día. */
export function paqueteFicticio<T extends TipoResumen>(tipo: T, aviso?: string, hoy?: string): PaqueteHechos<T> {
  const entrada = ENTRADAS_FICTICIAS[tipo]();
  const avisos = aviso === undefined ? entrada.avisos : [...entrada.avisos, aviso];
  return construirPaquete({ ...entrada, avisos, hoy: hoy ?? entrada.hoy } as never) as PaqueteHechos<T>;
}

/** Un PUBLICADO de ese paquete; por omisión, la salida de la plantilla (pasa el validador). */
export function publicadoFicticio(paquete: PaqueteHechos, extra: Partial<ResumenPublicado> = {}): ResumenPublicado {
  return {
    id: "resumen-ficticio-4613", tipo: paquete.tipo, fechaNegocio: paquete.hoy, puerta: "local", texto: "Texto guardado ficticio.",
    salidaModelo: salidaDePlantilla(paquete), paquete, hechosHash: paquete.hash, promptVersion: "resumen-ficticio-v3",
    promptHash: "a".repeat(64), modelo: MODELO_FICTICIO, modeloDigest: "sha256:ficticio7193", validadorVersion: "validador-v2",
    generadoEn: GENERADO_FICTICIO, ...extra,
  };
}
