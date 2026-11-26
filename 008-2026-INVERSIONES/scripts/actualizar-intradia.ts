/**
 * Un ciclo de precios intradía (barras de 1 minuto de Yahoo `.CL`) o su depuración. Lo corre el servicio de precios como un
 * proceso hijo del bundle (`servicio-precios.mjs intradia [--depurar]`), cada minuto durante la rueda:
 *   (sin opciones)  trae y guarda las barras de hoy de las especies con posición o con regla en el plan vigente
 *   --depurar       borra lo de más de INV_INTRADIA_RETENCION_DIAS días (la retención; el servicio lo corre una vez al día)
 *   --rotacion N    el contador de ciclos del servicio: con qué especie se empieza (módulo el número de especies)
 * La configuración sale de las variables INV_INTRADIA_* (src/servicio-precios/intradia-configuracion.ts). Imprime solo
 * conteos, códigos y el id interno de la especie fallida: nunca precios ni nemotécnicos.
 * Salida: 0 bien · 3 alguna especie falló · 4 día no hábil · 5 tope diario de peticiones · 7 bloqueo de Yahoo (429, 403, red) · 1 error (la base, etc.) · 2 uso.
 * Sale con process.exit al terminar: una respuesta de error de Yahoo sin leer podría dejar un socket abierto y el proceso vivo.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";
import { correrCicloIntradia } from "../src/precios/intradia/ciclo";
import { depurarIntradia } from "../src/precios/intradia/depurar";
import { reporteCiclo, reporteDepuracion, type Reporte } from "../src/precios/intradia/reporte";
import { contadorEnArchivo } from "../src/precios/intradia/tope";
import { leerConfigIntradia } from "../src/servicio-precios/intradia-configuracion";

async function trabajar(db: PrismaClient, depurar: boolean, rotacion: number): Promise<Reporte> {
  const config = leerConfigIntradia(process.env);
  if (depurar) return reporteDepuracion(await depurarIntradia(db, new Date(), config.retencionDias));
  const contadorDia = (await contadorEnArchivo(process.env.PRECIOS_ESTADO_DIR || undefined)) ?? undefined;
  return reporteCiclo(await correrCicloIntradia(db, { buscar: fetch, ahora: new Date(), urlYahoo: config.urlYahoo, pausaMs: config.pausaMs, arranque: rotacion, contadorDia }));
}

async function main(): Promise<number> {
  let depurar: boolean;
  let rotacion: number;
  try {
    const { values } = parseArgs({ strict: true, allowPositionals: false, options: { depurar: { type: "boolean" }, rotacion: { type: "string" } } });
    depurar = values.depurar === true;
    rotacion = values.rotacion === undefined ? 0 : Number(values.rotacion);
    if (!Number.isSafeInteger(rotacion) || rotacion < 0) throw new RangeError("rotacion");
  } catch {
    console.error("❌ Argumentos inválidos. Opciones: --depurar, --rotacion <entero>");
    return 2;
  }
  const db = new PrismaClient();
  try {
    const reporte = await trabajar(db, depurar, rotacion);
    for (const linea of reporte.lineas) console.log(linea);
    return reporte.codigoSalida;
  } catch (e) {
    console.error(`❌ No se trajeron los precios intradía: ${e instanceof Error ? e.name : "error"}`);
    return 1;
  } finally {
    await db.$disconnect();
  }
}

void main().then((codigo) => process.exit(codigo));
