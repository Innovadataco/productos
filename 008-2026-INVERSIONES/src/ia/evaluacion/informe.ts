/**
 * El informe de una evaluación (E7), sobre la carpeta de resultados: lee la plantilla y las corridas de cada modelo
 * (todas de los MISMOS casos: si no, CASOS_DISTINTOS), calcula las métricas por modelo y arma los pares a ciegas.
 * Escribe metricas.json, metricas.md, pares-a-ciegas.md y clave-pares.json (0600, sin pisar ninguno). Las fuentes de
 * los pares son modelos o «plantilla»; el texto de un modelo para un caso es el de su primera corrida publicada.
 */
import { FUENTE_PLANTILLA } from "./argumentos";
import { ARCHIVOS, ErrorArchivos, leerCorridas, leerPlantilla, VERSION_ARCHIVOS, type CorridasLeidas } from "./archivos";
import { calcularMetricas, lineaBase } from "./metricas";
import { armarPares, claveDePares, paresEnMarkdown, type TextosDeFuente } from "./pares";
import { metricasEnMarkdown } from "./reporte";
import type { Carpeta } from "./salida";
import type { RegistroCorrida } from "./tipos";

export { FUENTE_PLANTILLA };

const SALIDAS = Object.freeze([ARCHIVOS.metricasJson, ARCHIVOS.metricasMd, ARCHIVOS.pares, ARCHIVOS.clave]);

/** Completa: con su FIN COMPLETA y todas las corridas esperadas (casos × pasadas). */
const completitud = (leidas: CorridasLeidas, casos: number): { readonly esperadas: number; readonly completa: boolean } =>
  ({ esperadas: casos * leidas.cabecera.pasadas, completa: leidas.fin?.estado === "COMPLETA" });

export interface OpcionesInforme {
  readonly fuentes: readonly string[];
  readonly pares: number | "TODOS";
  readonly semilla: number;
}

export interface ResumenInforme {
  readonly modelos: number;
  readonly pares: number;
  readonly sinPar: number;
  /** Los modelos que cumplen el criterio automático (falta la claridad). */
  readonly aptos: readonly string[];
}

/** El texto publicado de cada caso: el de la pasada 1 y, si no publicó, el de la 2. */
function textosDelModelo(registros: readonly RegistroCorrida[]): ReadonlyMap<string, string> {
  const textos = new Map<string, string>();
  for (const r of [...registros].sort((a, b) => a.pasada - b.pasada)) {
    if (r.estado === "PUBLICADO" && r.texto !== null && !textos.has(r.caso)) textos.set(r.caso, r.texto);
  }
  return textos;
}

export function escribirInforme(carpeta: Carpeta, o: OpcionesInforme): ResumenInforme {
  // Todo o nada: si ya hay algún archivo del informe, no se escribe ninguno (no quedan métricas sin sus pares).
  if (SALIDAS.some((nombre) => carpeta.existe(nombre))) throw new ErrorArchivos("INFORME_EXISTE");
  const plantilla = leerPlantilla(carpeta);
  const modelos = o.fuentes.filter((f) => f !== FUENTE_PLANTILLA);
  const corridas = modelos.map((modelo) => ({ modelo, leidas: leerCorridas(carpeta, modelo) }));
  if (corridas.some((c) => c.leidas.cabecera.casosHash !== plantilla.casosHash)) throw new ErrorArchivos("CASOS_DISTINTOS");
  const metricas = corridas.map((c) => calcularMetricas(c.modelo, c.leidas.registros, completitud(c.leidas, plantilla.registros.length)));
  const base = lineaBase(plantilla.registros);
  const textos: TextosDeFuente[] = o.fuentes.map((fuente) => ({
    fuente,
    textos: fuente === FUENTE_PLANTILLA
      ? new Map(plantilla.registros.flatMap((r) => (r.estado === "PUBLICADO" && r.texto !== null ? [[r.caso, r.texto] as const] : [])))
      : textosDelModelo(corridas.find((c) => c.modelo === fuente)?.leidas.registros ?? []),
  }));
  const pares = armarPares({ casos: plantilla.registros.map((r) => ({ id: r.caso, tipo: r.tipo })), fuentes: textos, cantidad: o.pares, semilla: o.semilla });
  const json = {
    version: VERSION_ARCHIVOS, origen: plantilla.origen, casosHash: plantilla.casosHash, lineaBase: base,
    modelos: metricas.map((m, i) => ({ ...m, fin: corridas[i]?.leidas.fin ?? null })),
  };
  carpeta.escribirArchivo(ARCHIVOS.metricasJson, `${JSON.stringify(json, null, 2)}\n`);
  carpeta.escribirArchivo(ARCHIVOS.metricasMd, metricasEnMarkdown(metricas, base));
  carpeta.escribirArchivo(ARCHIVOS.pares, paresEnMarkdown(pares.pares));
  carpeta.escribirArchivo(ARCHIVOS.clave, `${JSON.stringify(claveDePares(pares, o.semilla), null, 2)}\n`);
  return Object.freeze({ modelos: metricas.length, pares: pares.pares.length, sinPar: pares.sinPar.length, aptos: Object.freeze(metricas.filter((m) => m.criterio.apto).map((m) => m.modelo)) });
}
