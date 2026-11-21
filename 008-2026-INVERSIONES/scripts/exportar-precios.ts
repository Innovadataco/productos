/**
 * En el Mac del dueño (con red): pide a Yahoo los cierres de los nemotécnicos de su lista privada y escribe por stdout el
 * CSV de cierres públicos que `precios:importar` carga en producción (vía B, docs/despliegue/produccion.md §11):
 *   npm run -s precios:exportar -- --nemos <lista.txt> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <cierres.csv.parcial> && mv …
 * «-s» hace falta: sin él, npm escribe su encabezado en stdout y quedaría dentro del CSV (el importador lo rechaza).
 * Se niega a escribir en una terminal (el CSV muestra qué especies hay). Sin base de datos. Por stderr solo conteos,
 * códigos y números de línea de la lista; nunca nemotécnicos ni precios.
 * Salida: 0 bien · 3 alguna especie quedó fuera (el CSV trae las demás) · 2 uso o lista ilegible · 1 lista inválida,
 * sin cierres, tope del CSV o la salida se cerró.
 */
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { ErrorArgumentosCarga, USO_EXPORTAR_PRECIOS, leerArgumentosExportarPrecios, type ArgumentosExportarPrecios } from "../src/precios/argumentos-carga";
import { escribirCompleto, exportarPrecios } from "../src/precios/exportar";
import { fechaEnBogota } from "../src/precios/horario";
import { MAX_BYTES_LISTA, leerListaNemos, type NemoDeLista } from "../src/precios/lista-nemos";
import { reporteErroresCsv, reporteExportacion } from "../src/precios/reporte";

function argumentos(): ArgumentosExportarPrecios | null {
  try {
    return leerArgumentosExportarPrecios(process.argv.slice(2), process.env, fechaEnBogota(new Date()));
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    console.error(`❌ ${e.message}\n${USO_EXPORTAR_PRECIOS}`);
    return null;
  }
}

/** La lista, o el código de salida si no sirve (2 si no se puede leer; 1 si su contenido no vale). */
function lista(ruta: string): readonly NemoDeLista[] | 1 | 2 {
  const leida = leerArchivoAcotado(ruta, MAX_BYTES_LISTA);
  if (!leida.ok && leida.codigo === "ARCHIVO_DEMASIADO_GRANDE") {
    console.error(`❌ LISTA_DEMASIADO_GRANDE · la lista pasa de ${MAX_BYTES_LISTA} bytes.`);
    return 1;
  }
  if (!leida.ok) {
    console.error(`❌ ${leida.codigo === "ARCHIVO_NO_REGULAR" ? "LISTA_NO_REGULAR" : "LISTA_ILEGIBLE"} · no se pudo leer la lista indicada (debe ser un archivo regular).`);
    return 2;
  }
  const r = leerListaNemos(leida.bytes);
  if (r.ok) return r.nemos;
  for (const linea of reporteErroresCsv(r, "LISTA_INVALIDA")) console.error(linea);
  return 1;
}

async function main(): Promise<number> {
  const a = argumentos();
  if (a === null) return 2;
  if (process.stdout.isTTY) {
    console.error("❌ SALIDA_TERMINAL · el CSV va a un archivo de su carpeta privada (> …), nunca a la pantalla.");
    return 2;
  }
  const nemos = lista(a.nemos);
  if (typeof nemos === "number") return nemos;
  const r = await exportarPrecios({ lista: nemos, desde: a.desde, hasta: a.hasta, ahora: new Date(), buscar: fetch });
  const reporte = reporteExportacion(r);
  if (r.csv !== null) {
    try {
      await escribirCompleto(process.stdout, r.csv);
    } catch {
      console.error("❌ SALIDA_CERRADA · no se pudo escribir el CSV completo (¿se cerró el tubo o se llenó el disco?): no lo use.");
      return 1;
    }
  }
  for (const linea of reporte.lineas) console.error(linea);
  return reporte.codigoSalida;
}

// Sin process.exit(): el CSV termina de escribirse antes de que el proceso acabe (en macOS un tubo es asíncrono).
main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ La exportación de precios falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
