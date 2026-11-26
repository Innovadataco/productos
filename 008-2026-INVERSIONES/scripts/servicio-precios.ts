/**
 * Entrada del bundle de precios: `npm run build:precios` la empaqueta con esbuild en un solo
 * `.next/precios/servicio-precios.mjs`, que la imagen de la app lleva en `/app/precios/`. Lo corre el servicio
 * inv-008-precios (la misma imagen, con otro entrypoint; D-018), sin tsx en producción:
 *   node servicio-precios.mjs bucle                        (el servicio: L-V 18:00 COT, precios y luego fondo)
 *   node servicio-precios.mjs --ahora [--desde AAAA-MM-DD] (una corrida ya, para la carga histórica)
 *   node servicio-precios.mjs precios [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (= npm run precios:actualizar)
 *   node servicio-precios.mjs fondo [opciones de scripts/actualizar-fondo.ts]      (= npx tsx scripts/actualizar-fondo.ts)
 *   node servicio-precios.mjs intradia [--depurar]   (un ciclo de precios cada minuto en la rueda, o su retención; scripts/actualizar-intradia.ts)
 *   node servicio-precios.mjs --ayuda
 * Cada tarea es el MISMO CLI de scripts/, importado tal cual: un solo código para el Mac y el servicio, con sus
 * mensajes, sus topes de red y sus códigos de salida. El bucle y --ahora corren cada tarea como un proceso hijo de
 * este mismo bundle (src/servicio-precios/tareas.ts). No repite lo que llegó por argumentos.
 * Red: en las tareas, `fetch` es el buscador fijo (solo Yahoo query1 y la SFC www.datos.gov.co, redirect "error" y
 * solo IPv4 públicas: src/servicio-precios/buscador.ts), instalado ANTES de cargar el CLI; en la tarea intradia suma el host
 * de la URL de Yahoo de la configuración (INV_INTRADIA_URL_YAHOO); en el bucle y en --ahora, uno que rechaza todo (ese
 * proceso no sale a la red).
 * Salida: la del CLI de la tarea · 0 con --ayuda · 2 sin tarea, con una desconocida o con argumentos de más en bucle ·
 * 1 si la tarea no cargó · las de src/servicio-precios/bucle.ts (SALIDA) en bucle y --ahora.
 */
import { buscadorQueRechaza, crearBuscadorFijo, hostDeUrlConfigurada } from "../src/servicio-precios/buscador";
import { leerConfigIntradia } from "../src/servicio-precios/intradia-configuracion";
import { servirAhora, servirBucle } from "../src/servicio-precios/servicio";

const USO = [
  "Uso: node servicio-precios.mjs <tarea> [opciones de la tarea]",
  "  bucle    el servicio inv-008-precios: una corrida de lunes a viernes a las 18:00 COT (precios y luego fondo)",
  "  --ahora [--desde AAAA-MM-DD]  una corrida ya, con la huella y el candado (la carga histórica)",
  "  precios  cierres de Yahoo (.CL): las opciones de npm run precios:actualizar (--desde, --hasta)",
  "  fondo    valor de unidad de los fondos (SFC): las opciones de scripts/actualizar-fondo.ts",
  "  intradia un ciclo de precios de 1 minuto (Yahoo) en la rueda; --depurar borra lo de más de la retención",
  "  --ayuda  este texto. Va antes de la tarea: después, es una opción de la tarea y la rechaza con 2",
].join("\n");

// import() con ruta fija: esbuild lo deja dentro del mismo archivo y el CLI solo corre cuando se elige su tarea.
// Un Map y no un objeto: así «toString» o «__proto__» no son tareas.
const TAREAS: ReadonlyMap<string, () => Promise<unknown>> = new Map([
  ["precios", () => import("./actualizar-precios")],
  ["fondo", () => import("./actualizar-fondo")],
  ["intradia", () => import("./actualizar-intradia")],
]);

// La ruta de este bundle: el bucle lo relanza para cada tarea. Se toma antes de tocar process.argv.
const ESTE_BUNDLE = process.argv[1] ?? "";

function usoMal(mensaje: string): void {
  console.error(`❌ ${mensaje}\n${USO}`);
  process.exitCode = 2;
}

async function main(): Promise<void> {
  const [tarea, ...resto] = process.argv.slice(2);
  if (tarea === "--ayuda") {
    console.log(USO);
    return;
  }
  if (tarea === "bucle" || tarea === "--ahora") {
    if (tarea === "bucle" && resto.length > 0) return usoMal("bucle no lleva argumentos.");
    // Las escrituras globales van antes de todo lo demás: este proceso no sale a la red.
    globalThis.fetch = buscadorQueRechaza() as unknown as typeof fetch;
    process.exitCode = tarea === "bucle" ? await servirBucle(process, ESTE_BUNDLE) : await servirAhora(process, ESTE_BUNDLE, resto);
    return;
  }
  const cargar = tarea === undefined ? undefined : TAREAS.get(tarea);
  if (!cargar) return usoMal(tarea === undefined ? "Falta la tarea." : "Tarea desconocida.");
  // Los CLI leen sus opciones de process.argv (parseArgs y process.argv.slice(2)) y corren al cargarse: se les deja
  // el argv que verían con tsx, sin el nombre de la tarea, y el buscador fijo como fetch. Son las únicas escrituras
  // globales, y van antes de cargarlos.
  process.argv = [...process.argv.slice(0, 2), ...resto];
  const hostIntradia = tarea === "intradia" ? hostDeUrlConfigurada(leerConfigIntradia(process.env).urlYahoo) : null;
  globalThis.fetch = crearBuscadorFijo({ hostsExtra: hostIntradia === null ? [] : [hostIntradia] }) as unknown as typeof fetch;
  await cargar();
}

main().catch((e: unknown) => {
  console.error(`❌ No se cargó la tarea: ${e instanceof Error ? e.name : "error"}`);
  process.exitCode = 1;
});
