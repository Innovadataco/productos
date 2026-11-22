/**
 * La evaluación de la IA local (E7), en el Mac: corre un modelo de Ollama (por la tailnet, la instancia de PI) sobre los
 * casos y mide cuántos resúmenes publica el validador, por qué rechaza, cuánto tarda y si repite.
 *   npm run ia:evaluar -- casos [--semilla N | --paquetes <archivo.json>]
 *   INV_IA_LOCAL_DESTINO=http://<IPv4 de la tailnet>:<puerto> npm run ia:evaluar -- correr --modelo <nombre> --salida <carpeta> […]
 *   npm run ia:evaluar -- informe --salida <carpeta> --fuentes <modelo,modelo|plantilla> [--pares N|todos]
 * Los casos son los 40 inventados (CI y robustez) o los del portafolio (`--paquetes`, el JSON de exportar-hechos-ia por
 * la vía B). El destino llega SOLO por la variable: nunca va al repo, a la terminal ni a los resultados. Con el
 * portafolio, la carpeta de resultados no puede caer en el temporal (los scratchpads). Al modelo solo va la vista ciega;
 * la red es la vigilada (solo tags y generate, un pedido a la vez). Ctrl-C o SIGTERM (PARA) cortan en el acto y dejan
 * lo escrito. Por la terminal, solo conteos y códigos.
 * Salida: 0 terminó · 3 sin modelo o cortada · 2 uso, configuración o archivo (sin red) · 1 error o violación de la red.
 */
import { tmpdir } from "node:os";
import { ErrorLocal } from "../src/ia/local/errores";
import { crearGeneradorLocal } from "../src/ia/local/generador";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { ErrorArchivos, abrirCorridas, escribirPlantilla } from "../src/ia/evaluacion/archivos";
import { ErrorArgumentosEvaluacion, leerArgumentosEvaluacion, USO_EVALUAR, VARIABLE_DESTINO, type ArgumentosEvaluacion } from "../src/ia/evaluacion/argumentos";
import { casosInventados, hashDeCasos, limitarCasos } from "../src/ia/evaluacion/casos";
import { LIMITE_EVALUACION_MS } from "../src/ia/evaluacion/corrida";
import { evaluarModelo } from "../src/ia/evaluacion/evaluar";
import { ErrorExportacion, leerExportacion, MAX_BYTES_EXPORTACION } from "../src/ia/evaluacion/exportacion";
import { escribirInforme } from "../src/ia/evaluacion/informe";
import { ErrorPares } from "../src/ia/evaluacion/pares";
import { vigilarRed } from "../src/ia/evaluacion/red";
import { codigoDeSalida, lineaDeAvance, lineasDeCasos, lineasDeFin } from "../src/ia/evaluacion/reporte";
import { abrirCarpeta, ErrorSalida, revisarCarpeta } from "../src/ia/evaluacion/salida";
import type { CasoEvaluacion } from "../src/ia/evaluacion/tipos";

type Correr = Extract<ArgumentosEvaluacion, { comando: "correr" }>;

const TEMPORALES = Object.freeze(["/tmp", "/var/folders"]);

/** Un error esperado (de uso, configuración o archivos): su código, que se imprime sin valores. */
class Negativa extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
  }
}

const CON_CODIGO = [ErrorArgumentosEvaluacion, ErrorSalida, ErrorArchivos, ErrorExportacion, ErrorPares, ErrorLocal, Negativa];
const codigoDe = (e: unknown): string | null => (CON_CODIGO.some((c) => e instanceof c) ? (e as { codigo: string }).codigo : null);

function casosDe(semilla: number | null, paquetes: string | null): readonly CasoEvaluacion[] {
  if (paquetes === null) return casosInventados(semilla ?? undefined);
  const leida = leerArchivoAcotado(paquetes, MAX_BYTES_EXPORTACION);
  if (!leida.ok) throw new Negativa(leida.codigo === "ARCHIVO_DEMASIADO_GRANDE" ? "PAQUETES_DEMASIADO_GRANDE" : "PAQUETES_ILEGIBLE");
  return leerExportacion(leida.bytes);
}

const esperar = (ms: number, senal: AbortSignal): Promise<void> =>
  new Promise((resolver) => {
    const reloj = setTimeout(resolver, ms);
    senal.addEventListener("abort", () => {
      clearTimeout(reloj);
      resolver();
    }, { once: true });
  });

async function correr(a: Correr): Promise<number> {
  const todos = casosDe(a.semilla, a.paquetes);
  const casos = a.maxCasos === null ? todos : limitarCasos(todos, a.maxCasos);
  const origen = a.paquetes === null ? "INVENTADOS" : "PAQUETES";
  // Con el portafolio, los textos traen cifras reales: nunca en un temporal (donde viven los scratchpads), sea cual sea
  // el TMPDIR del proceso (/tmp y, en macOS, /var/folders).
  const opcionesCarpeta = { raicesProhibidas: origen === "PAQUETES" ? [tmpdir(), ...TEMPORALES] : [] };
  revisarCarpeta(a.salida, opcionesCarpeta);
  const destino = process.env[VARIABLE_DESTINO];
  if (destino === undefined || destino === "") throw new Negativa("DESTINO_AUSENTE");
  const red = vigilarRed(fetch, destino);
  const generador = crearGeneradorLocal({ destino, modelo: a.modelo }, { fetch: red.buscar });
  const carpeta = abrirCarpeta(a.salida, opcionesCarpeta);
  escribirPlantilla(carpeta, casos, origen);
  const corridas = abrirCorridas(carpeta, { modelo: a.modelo, origen, casosHash: hashDeCasos(casos), pasadas: a.pasadas, limiteMs: LIMITE_EVALUACION_MS });
  const control = new AbortController();
  for (const senal of ["SIGINT", "SIGTERM"] as const) process.once(senal, () => control.abort());
  const total = casos.length * a.pasadas;
  console.error(`▶ ${a.modelo}: ${total} corridas en serie (${casos.length} casos × ${a.pasadas} pasadas), límite ${LIMITE_EVALUACION_MS / 1000} s por pedido`);
  const fin = await evaluarModelo(
    { casos, modelo: a.modelo, pasadas: a.pasadas, limiteMs: LIMITE_EVALUACION_MS, pausaMs: a.pausaMs },
    {
      generador, sondear: (limiteMs, senal) => generador.sondaLocal({ smoke: false, limiteMs }, senal), reloj: () => performance.now(),
      ahoraIso: () => new Date(Date.now()).toISOString(), esperar, senal: control.signal,
      anotar: (r) => {
        corridas.anotar(r);
        console.error(lineaDeAvance(r, total));
      },
    },
  );
  corridas.terminar(fin, red.conteo());
  for (const linea of lineasDeFin(a.modelo, fin, red.conteo())) console.error(linea);
  return codigoDeSalida(fin, red.conteo());
}

async function main(): Promise<number> {
  const a = leerArgumentosEvaluacion(process.argv.slice(2), process.env);
  if (a.comando === "casos") {
    const casos = casosDe(a.semilla, a.paquetes);
    for (const linea of lineasDeCasos(casos, a.paquetes === null ? "INVENTADOS" : "PAQUETES")) console.error(linea);
    return 0;
  }
  if (a.comando === "informe") {
    const r = escribirInforme(abrirCarpeta(a.salida, { raicesProhibidas: [], crear: false }), { fuentes: a.fuentes, pares: a.pares, semilla: a.semilla });
    console.error(`✅ informe: ${r.modelos} modelos · ${r.pares} pares a ciegas · ${r.sinPar} casos sin par · aptos sin la claridad: ${r.aptos.join(", ") || "ninguno"}`);
    return 0;
  }
  return correr(a);
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    const codigo = codigoDe(e);
    if (codigo === null) {
      console.error(`❌ La evaluación falló: ${e instanceof Error ? e.name : "error"}`);
      process.exitCode = 1;
      return;
    }
    console.error(`❌ ${codigo}${e instanceof ErrorArgumentosEvaluacion ? `\n${USO_EVALUAR}` : ""}`);
    process.exitCode = 2;
  });
