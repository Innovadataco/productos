/**
 * Entrada del bundle del servicio de las alertas: el Dockerfile la empaqueta con esbuild en `.next/alertas/servicio-alertas.mjs` y la
 * imagen de la app la lleva en `/app/alertas/`. La corre el servicio inv-008-alertas (la misma imagen, con otro entrypoint), sin tsx en
 * producción:
 *   node servicio-alertas.mjs bucle     el servicio: evalúa a las 18:15 COT en días hábiles de la BVC y, con el intradía encendido, cada 5 min en la rueda
 *   node servicio-alertas.mjs ahora    UNA evaluación ya (sin calendario ni huella) y sale: 0 bien · 3 alguna alerta no se guardó · 1 error; sirve para medir el pico de memoria
 *   node servicio-alertas.mjs --ayuda
 * Cada evaluación es src/alertas/correr.ts, la misma del script a mano (`npm run alertas:evaluar`, scripts/evaluar-alertas.ts).
 * Red: el `fetch` global del proceso queda anulado: el servicio solo habla con la base, por la red interna.
 * Salida: 0 al detenerse o con --ayuda · la de `ahora` (0, 3 o 1) · 1 si no arrancó · 2 uso (sin modo, uno desconocido o con argumentos de más).
 */
import { SALIDA } from "../src/servicio-alertas/bucle";
import { servir, servirAhora } from "../src/servicio-alertas/cableado";

const USO = [
  "Uso: node servicio-alertas.mjs <modo>",
  "  bucle    el servicio inv-008-alertas: evalúa a las 18:15 COT en días hábiles de la BVC y, con INV_INTRADIA_ENCENDIDO, cada 5 min en la rueda",
  "  ahora    una sola evaluación ya y sale (0 bien, 3 alguna alerta no se guardó, 1 error): para medir la memoria en el despliegue",
  "  --ayuda  este texto",
].join("\n");

async function main(): Promise<number> {
  const [modo, ...resto] = process.argv.slice(2);
  if (modo === "--ayuda" && resto.length === 0) {
    console.log(USO);
    return SALIDA.BIEN;
  }
  if ((modo !== "bucle" && modo !== "ahora") || resto.length > 0) {
    console.error(`❌ Modo desconocido o con argumentos de más.\n${USO}`);
    return SALIDA.USO;
  }
  globalThis.fetch = (() => Promise.reject(new TypeError("RED_NO_PERMITIDA"))) as unknown as typeof fetch;
  return modo === "ahora" ? servirAhora(process) : servir(process);
}

// process.exit: al detenerse puede quedar una evaluación en vuelo, que no debe retener el proceso.
main().then(
  (codigo) => process.exit(codigo),
  (e: unknown) => {
    console.error(`❌ El servicio de las alertas no arrancó: ${e instanceof Error ? e.name : "error"}`);
    process.exit(SALIDA.FALLO);
  },
);
