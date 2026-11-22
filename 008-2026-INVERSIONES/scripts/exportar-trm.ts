/**
 * En el Mac (con red; sin base): pide a la SFC (datos.gov.co, 32sa-8pi3) la TRM vigente en un rango y escribe por stdout
 * el CSV canónico de series que `importar-series` carga en producción (vía B, fase C · C2b):
 *   npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <trm.csv.parcial> && mv <trm.csv.parcial> <trm.csv>
 * Se niega a escribir en una terminal. Por stderr solo conteos, códigos y fechas. Todo el flujo vive en
 * src/datos-oficiales/fuentes/exportar-trm.ts (probado en proceso); aquí solo se cablea el proceso.
 * Salida: 0 bien · 3 filas descartadas o días sin vigencia (el CSV trae el resto) · 2 uso o terminal · 1 error.
 */
import { correrExportarTrm } from "../src/datos-oficiales/fuentes/exportar-trm";

// Sin process.exit(): el CSV termina de escribirse antes de que el proceso acabe (en macOS un tubo es asíncrono).
// fetch pide con redirect: "error", plazo total y tope de bytes (pedirBytesAcotado, en src/lib/http-acotado.ts).
correrExportarTrm({
  argv: process.argv.slice(2),
  entorno: process.env,
  ahora: new Date(),
  buscar: fetch,
  esTerminal: process.stdout.isTTY === true,
  salida: process.stdout,
  error: (linea) => console.error(linea),
})
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ La exportación de la TRM falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
