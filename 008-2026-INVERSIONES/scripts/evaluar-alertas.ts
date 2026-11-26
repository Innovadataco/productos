/**
 * Una evaluación de las alertas: lee lo que ya guardó el servicio de precios, corre el motor (src/alertas) y guarda lo que
 * detectó. Lo corre el servicio de las alertas (contenedor propio, rol inv_alertas) y, a mano, `npm run alertas:evaluar`.
 * El interruptor del intradía es el mismo de los precios (INV_INTRADIA_ENCENDIDO): apagado, «dato viejo» es la falta del
 * cierre. Imprime solo conteos: nunca nemotécnicos, ids ni precios.
 * Antes de leer revisa que la conexión sea la de `inv_alertas` (si no, sale con 1). Imprime el interruptor del intradía y cuántos avisos
 * de configuración dio (sin su texto). Un error de conexión o de permiso al guardar sube aquí: al registro va el nombre y el código, nunca
 * el mensaje.
 * Salida: 0 evaluó y guardó (con o sin alertas nuevas) · 3 alguna alerta no se pudo guardar (las demás quedaron) · 1 error (la base,
 * la credencial, la lectura, etc.).
 * Sale con process.exit al terminar para no dejar conexiones abiertas.
 */
import { PrismaClient } from "@prisma/client";
import { correrAlertas } from "../src/alertas/correr";
import { revisarCredencial } from "../src/alertas/credencial";
import { codigoDeError } from "../src/alertas/guardar";
import { leerConfigIntradia } from "../src/servicio-precios/intradia-configuracion";

async function main(): Promise<number> {
  const db = new PrismaClient();
  try {
    if (!(await revisarCredencial(db, process.env))) {
      console.error("❌ La conexión no es la del rol inv_alertas: no se evalúan las alertas");
      return 1;
    }
    const config = leerConfigIntradia(process.env);
    console.log(`alertas: intradía ${config.encendido ? "encendido" : "apagado"} · avisos de configuración ${config.avisos.length}`);
    const r = await correrAlertas(db, { ahora: new Date(), intradiaActivo: config.encendido });
    for (const linea of r.lineas) console.log(linea);
    return r.codigoSalida;
  } catch (e) {
    const codigo = codigoDeError(e);
    console.error(`❌ No se evaluaron las alertas: ${e instanceof Error ? e.name : "error"}${codigo === null ? "" : ` (${codigo})`}`);
    return 1;
  } finally {
    await db.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo)).catch(() => process.exit(1));
