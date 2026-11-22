/**
 * Métricas del arnés (E7), puras: percentil por rango más cercano (con los tiempos agotados como «más que el límite»),
 * tasa de publicación, rechazos por código, fallos, latencia, tokens, repetición entre pasadas, cobertura de hechos, el
 * auditor de recomendaciones sobre lo publicado, el indicio de recorte del contexto y el criterio para elegir modelo.
 */
import { describe, expect, it } from "vitest";
import { calcularMetricas, CARACTERES_POR_TOKEN_SOSPECHOSO, CRITERIO, lineaBase, percentil } from "@/ia/evaluacion/metricas";
import type { RegistroCorrida, RegistroPlantilla } from "@/ia/evaluacion/tipos";

function registro(extra: Partial<RegistroCorrida>): RegistroCorrida {
  return {
    caso: "DIARIO-01", tipo: "DIARIO", modelo: "ficticio-local:7b", pasada: 1, orden: 1, inicio: "2027-03-17T19:00:00.000Z", estado: "PUBLICADO",
    motivos: [], detalle: null, hallazgos: [], latenciaMs: 4613, duracionMs: 4700, agotado: false, tokensEntrada: 1237, tokensSalida: 271,
    caracteresPedido: 4613, modeloDigest: "d".repeat(64), salidaCruda: "{}", salidaHash: "a".repeat(64), texto: "El valor de las acciones es $ 37.911.",
    citados: 3, hechos: 6, hechosHash: "b".repeat(64), promptVersion: "resumen-diario-v1", promptHash: "c".repeat(64), validadorVersion: "validador-v1",
    ...extra,
  };
}

const rechazo = (motivos: string[], extra: Partial<RegistroCorrida> = {}) => registro({ estado: "RECHAZADO", motivos, texto: null, ...extra });
const fallo = (motivo: string, detalle: string, extra: Partial<RegistroCorrida> = {}) =>
  registro({ estado: "FALLIDO", motivos: [motivo], detalle, latenciaMs: null, salidaCruda: null, salidaHash: null, texto: null, tokensEntrada: null, tokensSalida: null, citados: 0, ...extra });

describe("percentil (rango más cercano)", () => {
  const uno = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  it("vacío, uno, 20 y 80 valores", () => {
    expect(percentil([], 0.5)).toBeNull();
    expect(percentil([7], 0.5)).toBe(7);
    expect(percentil([7], 0.95)).toBe(7);
    expect(percentil(uno(20), 0.5)).toBe(10);
    expect(percentil(uno(20), 0.95)).toBe(19);
    expect(percentil(uno(80), 0.95)).toBe(76);
    expect(percentil([3, 1, 2], 1)).toBe(3);
  });
  it("con infinitos (tiempos agotados) y con un q fuera de rango", () => {
    expect(percentil([...uno(19), Number.POSITIVE_INFINITY], 0.95)).toBe(19);
    expect(percentil([...uno(18), Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY], 0.95)).toBe(Number.POSITIVE_INFINITY);
    expect(() => percentil([1], 0)).toThrow(RangeError);
    expect(() => percentil([1], 1.5)).toThrow(RangeError);
  });
});

describe("calcularMetricas", () => {
  it("tasas, rechazos por código y fallos; lo cortado no cuenta", () => {
    const m = calcularMetricas("ficticio-local:7b", [
      registro({}),
      registro({ caso: "REGLAS-01", tipo: "REGLAS" }),
      rechazo(["IDIOMA", "FORMATO"], { caso: "REGLAS-02", tipo: "REGLAS" }),
      rechazo(["IDIOMA"], { caso: "ESCENARIOS-01", tipo: "ESCENARIOS" }),
      fallo("TIEMPO_AGOTADO", "LIMITE_DEL_CLIENTE", { caso: "DIARIO-02", agotado: true }),
      registro({ caso: "DIARIO-03", estado: "CORTADO", motivos: ["TIEMPO_AGOTADO"], texto: null }),
    ]);
    expect(m).toMatchObject({ modelo: "ficticio-local:7b", corridas: 5, cortadas: 1, publicadas: 2, rechazadas: 2, fallidas: 1, tasaPublicacion: 0.4 });
    expect(m.rechazosPorCodigo).toEqual({ IDIOMA: 2, FORMATO: 1 });
    expect(Object.keys(m.rechazosPorCodigo)).toEqual(["IDIOMA", "FORMATO"]);
    expect(m.fallosPorMotivo).toEqual({ "TIEMPO_AGOTADO/LIMITE_DEL_CLIENTE": 1 });
    expect(m.porTipo).toEqual({ DIARIO: { corridas: 2, publicadas: 1 }, REGLAS: { corridas: 2, publicadas: 1 }, ESCENARIOS: { corridas: 1, publicadas: 0 } });
  });

  it("latencia del cliente con los agotados como «más que el límite»; duración del arnés; la primera corrida", () => {
    const rapidas = Array.from({ length: 19 }, (_, i) => registro({ caso: `DIARIO-${i + 1}`, orden: i + 1, latenciaMs: (i + 1) * 1000, duracionMs: (i + 1) * 1100 }));
    const una = calcularMetricas("m", [...rapidas, fallo("TIEMPO_AGOTADO", "LIMITE_DEL_CLIENTE", { orden: 20, agotado: true, duracionMs: 120_013 })]);
    expect(una.latencia).toEqual({ n: 20, p50: 10_000, p95: 19_000, max: 19_000, agotadas: 1, p95SobreElLimite: false });
    expect(una.primeraCorridaMs).toBe(1000);
    expect(una.duracion.p50).toBe(11_000);
    const dos = calcularMetricas("m", [...rapidas.slice(0, 18), ...[19, 20].map((o) => fallo("TIEMPO_AGOTADO", "LIMITE_DEL_CLIENTE", { orden: o, agotado: true }))]);
    expect(dos.latencia).toMatchObject({ p95: null, p95SobreElLimite: true, agotadas: 2 });
    expect(dos.criterio.latencia).toBe(false);
    expect(calcularMetricas("m", []).latencia).toEqual({ n: 0, p50: null, p95: null, max: null, agotadas: 0, p95SobreElLimite: false });
  });

  it("tokens, cobertura y el indicio de recorte del contexto", () => {
    const m = calcularMetricas("m", [
      registro({ tokensEntrada: 1013, tokensSalida: 211, citados: 3, hechos: 6 }),
      registro({ caso: "DIARIO-02", tokensEntrada: 3019, tokensSalida: 409, citados: 6, hechos: 6, caracteresPedido: 3019 * (CARACTERES_POR_TOKEN_SOSPECHOSO + 1) }),
      rechazo(["IDIOMA"], { caso: "DIARIO-03", tokensEntrada: null, tokensSalida: null }),
    ]);
    expect(m.tokens).toEqual({ entradaMax: 3019, entradaMedia: 2016, salidaMax: 409, salidaMedia: 310 });
    expect(m.cobertura).toBeCloseTo(0.75, 10);
    expect(m.posibleRecorte).toBe(1);
    expect(calcularMetricas("m", [fallo("MODELO_NO_DISPONIBLE", "CONEXION_RECHAZADA")]).tokens).toEqual({ entradaMax: null, entradaMedia: null, salidaMax: null, salidaMedia: null });
  });

  it("repetición entre la pasada 1 y la 2 del mismo caso", () => {
    const m = calcularMetricas("m", [
      registro({ caso: "DIARIO-01", pasada: 1 }), registro({ caso: "DIARIO-01", pasada: 2 }),
      registro({ caso: "DIARIO-02", pasada: 1 }), registro({ caso: "DIARIO-02", pasada: 2, salidaHash: "e".repeat(64), texto: "Otro texto." }),
      registro({ caso: "DIARIO-03", pasada: 1 }), rechazo(["IDIOMA"], { caso: "DIARIO-03", pasada: 2 }),
      registro({ caso: "DIARIO-04", pasada: 1 }),
    ]);
    expect(m.repeticion).toEqual({ casos: 3, mismoEstado: 2, mismaSalida: 2, mismoTexto: 1 });
  });

  it("el auditor marca lo publicado que suena a recomendación (para revisión humana)", () => {
    const m = calcularMetricas("m", [registro({ caso: "DIARIO-07", pasada: 2, texto: "Le conviene vender la especie $ 4.613." }), registro({})]);
    expect(m.recomendaciones).toEqual({ marcadas: 1, corridas: ["DIARIO-07#2"] });
    expect(m.criterio.recomendaciones).toBe(false);
  });

  it("criterio: cero recomendaciones, al menos 90 % publicado y p95 de hasta 120 s; la claridad es humana", () => {
    expect(CRITERIO).toEqual({ minTasaPublicacion: 0.9, maxP95Ms: 120_000, maxRecomendaciones: 0 });
    const nueve = Array.from({ length: 9 }, (_, i) => registro({ caso: `DIARIO-${i + 1}`, latenciaMs: 119_000 }));
    const apto = calcularMetricas("m", [...nueve, rechazo(["IDIOMA"], { caso: "DIARIO-10" })]);
    expect(apto.criterio).toEqual({ recomendaciones: true, publicacion: true, latencia: true, claridad: "PENDIENTE", apto: true });
    const poco = calcularMetricas("m", [...nueve.slice(0, 8), rechazo(["IDIOMA"]), rechazo(["IDIOMA"])]);
    expect(poco.criterio).toMatchObject({ publicacion: false, apto: false });
    const lento = calcularMetricas("m", nueve.map((r) => ({ ...r, latenciaMs: 120_001 })));
    expect(lento.criterio).toMatchObject({ latencia: false, apto: false });
    expect(calcularMetricas("m", []).criterio).toMatchObject({ publicacion: false, apto: false });
  });
});

describe("lineaBase (la plantilla sin IA)", () => {
  it("publicadas sobre casos", () => {
    const p = (estado: RegistroPlantilla["estado"]): RegistroPlantilla => ({ caso: "DIARIO-01", tipo: "DIARIO", estado, motivos: [], texto: null });
    expect(lineaBase([p("PUBLICADO"), p("PUBLICADO"), p("RECHAZADO"), p("PUBLICADO")])).toEqual({ casos: 4, publicadas: 3, tasa: 0.75 });
    expect(lineaBase([])).toEqual({ casos: 0, publicadas: 0, tasa: null });
  });
});
