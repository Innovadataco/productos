/**
 * En el Mac del dueño: baja del SDMX público del Banco de la República la TPM o la IBR_3M_EA y escribe por stdout el CSV de
 * series oficiales que `importar-series` carga en producción (vía B, fase C):
 *   npx tsx scripts/exportar-banrep.ts --serie <TPM|IBR_3M_EA> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <series.csv.parcial> && mv …
 * Si BanRep bloquea el pedido automático (BANREP_BLOQUEADO: captcha o HTML en vez de SDMX), el dueño abre la URL que
 * imprime en su navegador, guarda el XML y repite con `--archivo <descarga.xml>` (no se pide nada a la red). Nada se
 * evade: un solo pedido, sin reintentos, sin cookies y sin imitar un navegador (src/datos-oficiales/fuentes/banrep-pedido.ts).
 * El XML se lee SOLO aquí, con el lector acotado (src/lib/xml-acotado.ts); producción solo lee el CSV.
 * Se niega a escribir en una terminal, y a pedir a la red con la verificación de TLS apagada (TLS_DESACTIVADO). No exige un archivo privado (umask 077) como fondo:exportar: el CSV solo trae
 * series públicas y no dice nada del portafolio. Sin base de datos. Por stderr solo conteos, códigos, fechas y la URL
 * pública; nunca valores ni rutas.
 * Salida: 0 bien · 3 con avisos (descartes, inicio tardío, serie atrasada o días faltantes; el CSV sale) · 2 uso,
 * terminal, TLS apagado o archivo ilegible · 1 BanRep o el archivo fallaron, sin filas, tope del CSV o la salida se cerró.
 */
import { USO_EXPORTAR_BANREP, leerArgumentosExportarBanrep, type ArgumentosExportarBanrep } from "../src/datos-oficiales/fuentes/banrep-argumentos";
import { exportarBanrep, type OrigenBanrep } from "../src/datos-oficiales/fuentes/banrep-exportar";
import { tlsDesactivado } from "../src/datos-oficiales/fuentes/banrep-pedido";
import { SALIDA_USO, reporteArchivoBanrep, reporteExportacionBanrep } from "../src/datos-oficiales/fuentes/banrep-reporte";
import { seriesBanrep } from "../src/datos-oficiales/fuentes/banrep-series";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { TOPES_XML } from "../src/lib/xml-acotado";
import { ErrorArgumentosCarga } from "../src/precios/argumentos-carga";
import { escribirCompleto } from "../src/precios/exportar";
import { fechaEnBogota } from "../src/precios/horario";

function argumentos(hoy: Date): ArgumentosExportarBanrep | number {
  const series = seriesBanrep();
  if (!series.ok) {
    console.error(`❌ ${series.codigo} · el catálogo de 008 trae una fuente de BanRep mal formada: avise a la Fábrica.`);
    return 1;
  }
  try {
    return leerArgumentosExportarBanrep(process.argv.slice(2), process.env, hoy, series.series);
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    console.error(`❌ ${e.message}\n${USO_EXPORTAR_BANREP}`);
    return SALIDA_USO;
  }
}

/** El XML del --archivo (o la red, sin --archivo), o el código de salida si el archivo no se puede leer. */
function origen(a: ArgumentosExportarBanrep): OrigenBanrep | number {
  if (a.archivo === null) return { tipo: "RED", buscar: fetch };
  const leido = leerArchivoAcotado(a.archivo, TOPES_XML.bytes);
  if (leido.ok) return { tipo: "ARCHIVO", bytes: leido.bytes };
  const reporte = reporteArchivoBanrep(leido.codigo);
  for (const linea of reporte.lineas) console.error(linea);
  return reporte.codigoSalida;
}

async function main(): Promise<number> {
  // Un solo «ahora»: el mismo hoy para el tope de --hasta y para el adelanto del CSV.
  const hoy = fechaEnBogota(new Date());
  const a = argumentos(hoy);
  if (typeof a === "number") return a;
  if (process.stdout.isTTY) {
    console.error("❌ SALIDA_TERMINAL · el CSV va a un archivo (> …), nunca a la pantalla (no se pidió nada a BanRep).");
    return SALIDA_USO;
  }
  if (a.archivo === null && tlsDesactivado(process.env)) {
    console.error("❌ TLS_DESACTIVADO · NODE_TLS_REJECT_UNAUTHORIZED=0 apaga la verificación del certificado: quítela antes de pedir a BanRep, o use --archivo (no se pidió nada).");
    return SALIDA_USO;
  }
  const o = origen(a);
  if (typeof o === "number") return o;
  const r = await exportarBanrep({ serie: a.serie, desde: a.desde, hasta: a.hasta, hoy, origen: o });
  const reporte = reporteExportacionBanrep(r);
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
    console.error(`❌ La exportación de BanRep falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
