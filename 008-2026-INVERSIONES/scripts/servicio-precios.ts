/**
 * Entrada del bundle de precios: `npm run build:precios` la empaqueta con esbuild en un solo
 * `.next/precios/servicio-precios.mjs`, que la imagen de la app lleva en `/app/precios/`. Lo correrá el servicio
 * inv-008-precios (la misma imagen, con otro entrypoint), sin tsx en producción:
 *   node servicio-precios.mjs precios [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (= npm run precios:actualizar)
 *   node servicio-precios.mjs fondo [opciones de scripts/actualizar-fondo.ts]      (= npx tsx scripts/actualizar-fondo.ts)
 *   node servicio-precios.mjs --ayuda
 * Cada tarea es el MISMO CLI de scripts/, importado tal cual: un solo código para el Mac y el servicio, con sus
 * mensajes, sus topes de red y sus códigos de salida. No repite lo que llegó por argumentos.
 * Salida: la del CLI de la tarea · 0 con --ayuda · 2 sin tarea o con una desconocida · 1 si la tarea no cargó.
 */

const USO = [
  "Uso: node servicio-precios.mjs <tarea> [opciones de la tarea]",
  "  precios  cierres de Yahoo (.CL): las opciones de npm run precios:actualizar (--desde, --hasta)",
  "  fondo    valor de unidad de los fondos (SFC): las opciones de scripts/actualizar-fondo.ts",
  "  --ayuda  este texto. Va antes de la tarea: después, es una opción de la tarea y la rechaza con 2",
].join("\n");

// import() con ruta fija: esbuild lo deja dentro del mismo archivo y el CLI solo corre cuando se elige su tarea.
// Un Map y no un objeto: así «toString» o «__proto__» no son tareas.
const TAREAS: ReadonlyMap<string, () => Promise<unknown>> = new Map([
  ["precios", () => import("./actualizar-precios")],
  ["fondo", () => import("./actualizar-fondo")],
]);

async function main(): Promise<void> {
  const [tarea, ...resto] = process.argv.slice(2);
  if (tarea === "--ayuda") {
    console.log(USO);
    return;
  }
  const cargar = tarea === undefined ? undefined : TAREAS.get(tarea);
  if (!cargar) {
    console.error(`❌ ${tarea === undefined ? "Falta la tarea." : "Tarea desconocida."}\n${USO}`);
    process.exitCode = 2;
    return;
  }
  // Los CLI leen sus opciones de process.argv (parseArgs y process.argv.slice(2)) y corren al cargarse: se les deja
  // el argv que verían con tsx, sin el nombre de la tarea. Es la única escritura global, y va antes de cargarlos.
  process.argv = [...process.argv.slice(0, 2), ...resto];
  await cargar();
}

main().catch((e: unknown) => {
  console.error(`❌ No se cargó la tarea: ${e instanceof Error ? e.name : "error"}`);
  process.exitCode = 1;
});
