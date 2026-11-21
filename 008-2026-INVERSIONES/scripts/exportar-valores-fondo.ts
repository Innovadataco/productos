/**
 * En el Mac del dueño (con red): pide a la SFC (datos.gov.co, qhpu-8ixx) los valores de unidad de los fondos de su
 * lista privada y escribe por stdout el CSV que `importar-valores-fondo` carga en producción (vía B,
 * docs/despliegue/produccion.md §11):
 *   npm run -s fondo:exportar -- --fondos <lista.txt> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <valores-fondo.csv.parcial> && mv …
 * «-s» hace falta: sin él, npm escribe su encabezado en stdout y quedaría dentro del CSV (el importador lo rechaza).
 * Se niega a escribir en una terminal o en un archivo que otros pueden leer (el CSV dice qué fondo tiene el dueño:
 * `umask 077` antes del `>`). Sin base de datos. Por stderr solo
 * conteos, códigos, fechas y números de línea de la lista; nunca el código del fondo ni valores.
 * Salida: 0 bien · 3 algún fondo quedó fuera o trajo valores inválidos (el CSV trae el resto) · 2 uso o lista
 * ilegible · 1 lista inválida, sin valores, tope del CSV o la salida se cerró.
 */
import { fstatSync } from "node:fs";
import { ErrorArgumentosCarga } from "../src/precios/argumentos-carga";
import { escribirCompleto } from "../src/precios/exportar";
import { fechaEnBogota } from "../src/precios/horario";
import { reporteErroresCsv } from "../src/precios/reporte";
import { USO_EXPORTAR_VALORES_FONDO, leerArgumentosExportarValoresFondo, type ArgumentosExportarValoresFondo } from "../src/fondo/argumentos-carga";
import { exportarValoresFondo, salidaNoPrivada } from "../src/fondo/exportar";
import { MAX_BYTES_LISTA_FONDOS, leerListaFondos, type FondoDeLista } from "../src/fondo/lista-fondos";
import { reporteExportacionFondo } from "../src/fondo/reporte";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

function argumentos(): ArgumentosExportarValoresFondo | null {
  try {
    return leerArgumentosExportarValoresFondo(process.argv.slice(2), process.env, fechaEnBogota(new Date()));
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    console.error(`❌ ${e.message}\n${USO_EXPORTAR_VALORES_FONDO}`);
    return null;
  }
}

/** La lista, o el código de salida si no sirve (2 si no se puede leer; 1 si su contenido no vale). */
function lista(ruta: string): readonly FondoDeLista[] | 1 | 2 {
  const leida = leerArchivoAcotado(ruta, MAX_BYTES_LISTA_FONDOS);
  if (!leida.ok && leida.codigo === "ARCHIVO_DEMASIADO_GRANDE") {
    console.error(`❌ LISTA_DEMASIADO_GRANDE · la lista pasa de ${MAX_BYTES_LISTA_FONDOS} bytes.`);
    return 1;
  }
  if (!leida.ok) {
    console.error(`❌ ${leida.codigo === "ARCHIVO_NO_REGULAR" ? "LISTA_NO_REGULAR" : "LISTA_ILEGIBLE"} · no se pudo leer la lista indicada (debe ser un archivo regular).`);
    return 2;
  }
  const r = leerListaFondos(leida.bytes);
  if (r.ok) return r.fondos;
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
  const salida = fstatSync(1);
  if (salidaNoPrivada(salida.isFile(), salida.mode)) {
    console.error("❌ SALIDA_NO_PRIVADA · el archivo de salida lo pueden leer otros usuarios: créelo con «umask 077» antes del «>» (no se pidió nada a la SFC).");
    return 2;
  }
  const fondos = lista(a.fondos);
  if (typeof fondos === "number") return fondos;
  // obtenerValores pide con redirect: "error" (no sigue redirecciones), con plazo y con tope de bytes en el cuerpo.
  const r = await exportarValoresFondo({ lista: fondos, desde: a.desde, hasta: a.hasta, ahora: new Date(), buscar: fetch });
  const reporte = reporteExportacionFondo(r);
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
    console.error(`❌ La exportación de valores del fondo falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
