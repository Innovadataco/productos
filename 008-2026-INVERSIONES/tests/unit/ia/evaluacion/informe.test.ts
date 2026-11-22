/**
 * Los archivos de la corrida y el informe (E7): `corridas-<modelo>.jsonl` (cabecera, una línea por corrida y el fin),
 * `plantilla.jsonl` (la línea base) y, con `informe`, las métricas por modelo y los pares a ciegas con su clave aparte.
 * El informe exige que todas las entradas vengan de los mismos casos (mismo `casosHash`). Carpetas temporales propias.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { casosInventados, hashDeCasos, limitarCasos } from "@/ia/evaluacion/casos";
import { abrirCorridas, ARCHIVOS, archivoDeCorridas, escribirPlantilla, ErrorArchivos, leerCorridas } from "@/ia/evaluacion/archivos";
import { escribirInforme } from "@/ia/evaluacion/informe";
import { abrirCarpeta, type Carpeta } from "@/ia/evaluacion/salida";
import type { CasoEvaluacion, RegistroCorrida } from "@/ia/evaluacion/tipos";
import { resumenSinIa } from "@/ia/validador/plantilla";

const casos = limitarCasos(casosInventados(), 12);
const carpeta = (): Carpeta => abrirCarpeta(path.join(mkdtempSync(path.join(tmpdir(), "e7-informe-")), "r"), { raicesProhibidas: [] });

function registro(c: CasoEvaluacion, modelo: string, pasada: 1 | 2, orden: number): RegistroCorrida {
  const r = resumenSinIa(c.paquete);
  return {
    caso: c.id, tipo: c.tipo, modelo, pasada, orden, inicio: "2027-03-17T19:00:00.000Z", estado: "PUBLICADO", motivos: [], detalle: null, hallazgos: [],
    latenciaMs: 4613 + orden, duracionMs: 4700 + orden, agotado: false, tokensEntrada: 1237, tokensSalida: 271, caracteresPedido: 4613, modeloDigest: "d".repeat(64),
    salidaCruda: "{}", salidaHash: "a".repeat(64), texto: r.ok ? `${r.resumen.texto} (${modelo})` : null, citados: 2, hechos: 5, hechosHash: c.paquete.hash,
    promptVersion: "resumen-diario-v1", promptHash: "c".repeat(64), validadorVersion: "validador-v1",
  };
}

function correrFicticio(c: Carpeta, modelo: string, lista: readonly CasoEvaluacion[] = casos): void {
  const corridas = abrirCorridas(c, { modelo, origen: "INVENTADOS", casosHash: hashDeCasos(lista), pasadas: 2, limiteMs: 120_000 });
  let orden = 0;
  for (const pasada of [1, 2] as const) for (const x of lista) corridas.anotar(registro(x, modelo, pasada, ++orden));
  corridas.terminar({ estado: "COMPLETA", corridas: orden, motivo: null, detalle: null }, { tags: orden + 1, generar: orden, rechazados: 0 });
}

describe("los archivos de la corrida", () => {
  it("corridas-<modelo>.jsonl: cabecera, corridas y fin; se lee de vuelta", () => {
    const c = carpeta();
    correrFicticio(c, "ficticio-a:7b");
    expect(archivoDeCorridas("ficticio-a:7b")).toBe("corridas-ficticio-a-7b.jsonl");
    const leidas = leerCorridas(c, "ficticio-a:7b");
    expect(leidas.cabecera).toMatchObject({ modelo: "ficticio-a:7b", origen: "INVENTADOS", casosHash: hashDeCasos(casos) });
    expect(leidas.registros).toHaveLength(24);
    expect(leidas.fin).toMatchObject({ estado: "COMPLETA", red: { tags: 25, generar: 24, rechazados: 0 } });
  });

  it("una corrida cortada (sin la línea de fin) se lee igual, con fin null", () => {
    const c = carpeta();
    const corridas = abrirCorridas(c, { modelo: "ficticio-a:7b", origen: "INVENTADOS", casosHash: hashDeCasos(casos), pasadas: 2, limiteMs: 120_000 });
    corridas.anotar(registro(casos[0]!, "ficticio-a:7b", 1, 1));
    const leidas = leerCorridas(c, "ficticio-a:7b");
    expect(leidas.registros).toHaveLength(1);
    expect(leidas.fin).toBeNull();
  });

  it("plantilla.jsonl se escribe una vez; con otros casos es CASOS_DISTINTOS", () => {
    const c = carpeta();
    escribirPlantilla(c, casos, "INVENTADOS");
    escribirPlantilla(c, casos, "INVENTADOS");
    expect(c.leerJsonl(ARCHIVOS.plantilla)).toHaveLength(casos.length + 1);
    let codigo = "";
    try {
      escribirPlantilla(c, casos.slice(0, 3), "INVENTADOS");
    } catch (e) {
      codigo = e instanceof ErrorArchivos ? e.codigo : "OTRO";
    }
    expect(codigo).toBe("CASOS_DISTINTOS");
  });

  it("un archivo de corridas que no existe: SIN_CORRIDAS", () => {
    let codigo = "";
    try {
      leerCorridas(carpeta(), "ficticio-z:1b");
    } catch (e) {
      codigo = e instanceof ErrorArchivos ? e.codigo : "OTRO";
    }
    expect(codigo).toBe("SIN_CORRIDAS");
  });
});

describe("escribirInforme", () => {
  it("métricas por modelo y la línea base, y los pares con su clave aparte, sin nombrar las fuentes en los pares", () => {
    const c = carpeta();
    escribirPlantilla(c, casos, "INVENTADOS");
    correrFicticio(c, "ficticio-a:7b");
    const r = escribirInforme(c, { fuentes: ["ficticio-a:7b", "plantilla"], pares: 10, semilla: 4613 });
    expect(r).toMatchObject({ modelos: 1, pares: 10, sinPar: 0 });
    const metricas = JSON.parse(readFileSync(path.join(c.ruta, ARCHIVOS.metricasJson), "utf8")) as { modelos: { modelo: string; publicadas: number }[]; lineaBase: { casos: number } };
    expect(metricas.modelos.map((m) => [m.modelo, m.publicadas])).toEqual([["ficticio-a:7b", 24]]);
    expect(metricas.lineaBase.casos).toBe(12);
    const md = readFileSync(path.join(c.ruta, ARCHIVOS.pares), "utf8");
    expect(md).toContain("## Par 10");
    expect(md).not.toContain("plantilla");
    expect(readFileSync(path.join(c.ruta, ARCHIVOS.metricasMd), "utf8")).toContain("ficticio-a:7b");
    const clave = JSON.parse(readFileSync(path.join(c.ruta, ARCHIVOS.clave), "utf8")) as { semilla: number; pares: unknown[] };
    expect(clave).toMatchObject({ semilla: 4613 });
    expect(clave.pares).toHaveLength(10);
  });

  it("tres modelos con TODOS: los pares de los tres por caso", () => {
    const c = carpeta();
    const tres = limitarCasos(casosInventados(), 3);
    escribirPlantilla(c, tres, "INVENTADOS");
    for (const m of ["ficticio-a:7b", "ficticio-b:9b", "ficticio-c:5b"]) correrFicticio(c, m, tres);
    expect(escribirInforme(c, { fuentes: ["ficticio-a:7b", "ficticio-b:9b", "ficticio-c:5b"], pares: "TODOS", semilla: 4613 })).toMatchObject({ modelos: 3, pares: 9 });
  });

  it("revisión: si ya existe algún archivo del informe, no escribe ninguno (INFORME_EXISTE)", () => {
    const c = carpeta();
    escribirPlantilla(c, casos, "INVENTADOS");
    correrFicticio(c, "ficticio-a:7b");
    c.escribirArchivo(ARCHIVOS.clave, "{}\n");
    let codigo = "";
    try {
      escribirInforme(c, { fuentes: ["ficticio-a:7b", "plantilla"], pares: 10, semilla: 4613 });
    } catch (e) {
      codigo = e instanceof ErrorArchivos ? e.codigo : "OTRO";
    }
    expect(codigo).toBe("INFORME_EXISTE");
    expect(c.existe(ARCHIVOS.metricasJson)).toBe(false);
  });

  it("revisión: un modelo con la evaluación completa sale apto; uno cortado (sin fin), no", () => {
    const c = carpeta();
    escribirPlantilla(c, casos, "INVENTADOS");
    correrFicticio(c, "ficticio-a:7b");
    const cortada = abrirCorridas(c, { modelo: "ficticio-b:9b", origen: "INVENTADOS", casosHash: hashDeCasos(casos), pasadas: 2, limiteMs: 120_000 });
    for (const x of casos) cortada.anotar(registro(x, "ficticio-b:9b", 1, 1));
    expect(escribirInforme(c, { fuentes: ["ficticio-a:7b", "ficticio-b:9b"], pares: 10, semilla: 4613 }).aptos).toEqual(["ficticio-a:7b"]);
  });

  it("corridas de otros casos que la plantilla: CASOS_DISTINTOS", () => {
    const c = carpeta();
    escribirPlantilla(c, casos, "INVENTADOS");
    correrFicticio(c, "ficticio-a:7b", casos.slice(0, 3));
    let codigo = "";
    try {
      escribirInforme(c, { fuentes: ["ficticio-a:7b", "plantilla"], pares: 10, semilla: 4613 });
    } catch (e) {
      codigo = e instanceof ErrorArchivos ? e.codigo : "OTRO";
    }
    expect(codigo).toBe("CASOS_DISTINTOS");
  });
});
