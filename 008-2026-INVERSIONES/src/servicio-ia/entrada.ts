/**
 * Entrada del bundle del servicio inv-008-ia (E6): el Dockerfile la empaqueta con esbuild en `.next/ia/servicio-ia.mjs`
 * (condición react-server, por los `import "server-only"` de src/ia/config) y la imagen de la app la lleva en `/app/ia/`.
 * La corre el servicio inv-008-ia (la misma imagen, con otro entrypoint), sin tsx en producción:
 *   node servicio-ia.mjs bucle     el servicio: el resumen a la hora de config_ia y los pedidos a demanda de la app
 *   node servicio-ia.mjs --ayuda
 * Red: el `fetch` global del proceso queda anulado; el único que sale es el acotado al Ollama de la tailnet
 * (src/servicio-ia/cableado.ts). Salida: 0 al detenerse o con --ayuda · 2 uso.
 */
import type { BuscarLocal } from "../ia/local/http";
import { servir } from "./cableado";

const USO = [
  "Uso: node servicio-ia.mjs <modo>",
  "  bucle    el servicio inv-008-ia: el resumen diario a la hora de config_ia (días hábiles BVC) y el endpoint interno",
  "  --ayuda  este texto",
].join("\n");

async function main(): Promise<number> {
  const [modo, ...resto] = process.argv.slice(2);
  if (modo === "--ayuda") {
    console.log(USO);
    return 0;
  }
  if (modo !== "bucle" || resto.length > 0) {
    console.error(`❌ Modo desconocido o con argumentos de más.\n${USO}`);
    return 2;
  }
  const fetchReal = globalThis.fetch as unknown as BuscarLocal;
  globalThis.fetch = (() => Promise.reject(new TypeError("RED_NO_PERMITIDA"))) as unknown as typeof fetch;
  return servir(process, fetchReal);
}

// process.exit: al detenerse puede quedar un pedido al modelo en vuelo, que no debe retener el proceso.
main().then(
  (codigo) => process.exit(codigo),
  (e: unknown) => {
    console.error(`❌ El servicio de IA no arrancó: ${e instanceof Error ? e.name : "error"}`);
    process.exit(1);
  },
);
