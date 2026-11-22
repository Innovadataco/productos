/**
 * El bucle del arnés (E7), sin red: la sonda (solo tags) antes de generar, dos pasadas completas EN SERIE (nunca dos
 * pedidos a la vez), la pausa entre pedidos, el corte tras N fallos seguidos y la señal del operador (PARA).
 */
import { describe, expect, it } from "vitest";
import { crearGeneradorFalso, type ConductaFalsa } from "@/ia/generador-falso";
import type { Generador, PedidoGeneracion, ResultadoGeneracion } from "@/ia/generador";
import type { ResultadoSondaLocal } from "@/ia/local/sonda";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { casosInventados, limitarCasos } from "@/ia/evaluacion/casos";
import { evaluarModelo, MAX_FALLOS_SEGUIDOS, type DependenciasEvaluacion, type OpcionesEvaluacion } from "@/ia/evaluacion/evaluar";
import type { RegistroCorrida } from "@/ia/evaluacion/tipos";

const casos = limitarCasos(casosInventados(), 3);
const SONDA_OK: ResultadoSondaLocal = { ok: true, smoke: "NO_PEDIDO", latenciaMs: 13 };

/** Responde con la plantilla del caso de la vista recibida (el falso no ve el paquete: lo busca por la vista). */
function respuestaPara(pedido: PedidoGeneracion): ConductaFalsa {
  const c = casos.find((x) => JSON.stringify(x.paquete.hechos.map((h) => h.clave)) === JSON.stringify(pedido.vista.hechos.map((h) => h.clave)));
  return { tipo: "RESPONDER", salidaCruda: c === undefined ? "{}" : salidaDePlantilla(c.paquete), latenciaMs: 37 };
}

/** Un generador que anota cuántos pedidos tiene a la vez. */
function enSerie(base: (pedido: PedidoGeneracion, i: number) => ConductaFalsa) {
  let activos = 0;
  let maximo = 0;
  let i = 0;
  const generador: Generador = {
    puerta: "local",
    async generar(pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
      activos += 1;
      maximo = Math.max(maximo, activos);
      const falso = crearGeneradorFalso({ puerta: "local", conducta: base(pedido, i++) });
      try {
        await new Promise((ok) => setTimeout(ok, 1));
        return await falso.generar(pedido, senal);
      } finally {
        activos -= 1;
      }
    },
  };
  return { generador, maximo: () => maximo, llamadas: () => i };
}

function preparar(generador: Generador, extra: Partial<DependenciasEvaluacion> = {}, opciones: Partial<OpcionesEvaluacion> = {}) {
  const registros: RegistroCorrida[] = [];
  const pausas: number[] = [];
  const sondas: number[] = [];
  let t = 0;
  const deps: DependenciasEvaluacion = {
    generador,
    sondear: (limiteMs) => {
      sondas.push(limiteMs);
      return Promise.resolve(SONDA_OK);
    },
    reloj: () => (t += 7),
    ahoraIso: () => "2027-03-17T19:00:00.000Z",
    esperar: (ms) => {
      pausas.push(ms);
      return Promise.resolve();
    },
    senal: new AbortController().signal,
    anotar: (r) => {
      registros.push(r);
    },
    ...extra,
  };
  const o: OpcionesEvaluacion = { casos, modelo: "ficticio-local:7b", pasadas: 2, limiteMs: 4613, pausaMs: 1237, ...opciones };
  return { deps, o, registros, pausas, sondas };
}

describe("evaluarModelo", () => {
  it("dos pasadas completas en serie: la pasada 1 entera y después la 2, con el orden de cada corrida", async () => {
    const s = enSerie(respuestaPara);
    const p = preparar(s.generador);
    const fin = await evaluarModelo(p.o, p.deps);
    expect(fin).toEqual({ estado: "COMPLETA", corridas: 6, motivo: null, detalle: null });
    expect(p.registros.map((r) => `${r.pasada}:${r.caso}`)).toEqual([
      "1:DIARIO-01", "1:REGLAS-01", "1:ESCENARIOS-01", "2:DIARIO-01", "2:REGLAS-01", "2:ESCENARIOS-01",
    ]);
    expect(p.registros.map((r) => r.orden)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.registros.every((r) => r.estado === "PUBLICADO")).toBe(true);
    expect(s.maximo()).toBe(1);
    expect(p.sondas).toEqual([4613]);
  });

  it("la pausa va entre pedidos, nunca después del último", async () => {
    const p = preparar(enSerie(respuestaPara).generador);
    await evaluarModelo(p.o, p.deps);
    expect(p.pausas).toEqual([1237, 1237, 1237, 1237, 1237]);
    const sinPausa = preparar(enSerie(respuestaPara).generador, {}, { pausaMs: 0 });
    await evaluarModelo(sinPausa.o, sinPausa.deps);
    expect(sinPausa.pausas).toEqual([]);
  });

  it("una pasada: una corrida por caso", async () => {
    const p = preparar(enSerie(respuestaPara).generador, {}, { pasadas: 1 });
    expect((await evaluarModelo(p.o, p.deps)).corridas).toBe(3);
  });

  it("si la sonda falla, no genera nada y lo dice con códigos", async () => {
    const s = enSerie(respuestaPara);
    const p = preparar(s.generador, {
      sondear: () => Promise.resolve({ ok: false, etapa: "PING", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE", latenciaMs: 3 }),
    });
    expect(await evaluarModelo(p.o, p.deps)).toEqual({ estado: "SIN_MODELO", corridas: 0, motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" });
    expect(s.llamadas()).toBe(0);
    expect(p.registros).toEqual([]);
  });

  it(`corta tras ${MAX_FALLOS_SEGUIDOS} fallos seguidos de modelo o de tiempo; un éxito reinicia la cuenta`, async () => {
    expect(MAX_FALLOS_SEGUIDOS).toBe(3);
    const caida: ConductaFalsa = { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" };
    const lenta: ConductaFalsa = { tipo: "FALLAR", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" };
    // Sin el reinicio cortaría en la cuarta; con él, en la quinta (la tercera caída seguida).
    const guion = (pedido: PedidoGeneracion, i: number): ConductaFalsa => ([caida, respuestaPara(pedido), caida, lenta, caida][i] ?? respuestaPara(pedido));
    const s = enSerie(guion);
    const p = preparar(s.generador);
    expect(await evaluarModelo(p.o, p.deps)).toEqual({ estado: "CORTADA_POR_FALLOS", corridas: 5, motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" });
    expect(s.llamadas()).toBe(5);
    const rechazo: ConductaFalsa = { tipo: "RESPONDER", salidaCruda: "no es json" };
    const q = preparar(enSerie(() => rechazo).generador);
    expect((await evaluarModelo(q.o, q.deps)).estado).toBe("COMPLETA");
  });

  it("la señal del operador: la corrida en vuelo queda CORTADA y no se pide nada más", async () => {
    const control = new AbortController();
    const s = enSerie((pedido, i) => (i === 1 ? { tipo: "TARDAR", ms: 60_000, luego: respuestaPara(pedido) } : respuestaPara(pedido)));
    const p = preparar(s.generador, { senal: control.signal }, { limiteMs: 90_000 });
    const promesa = evaluarModelo(p.o, p.deps);
    setTimeout(() => control.abort(), 20);
    expect(await promesa).toEqual({ estado: "CORTADA_POR_SENAL", corridas: 2, motivo: null, detalle: null });
    expect(p.registros.map((r) => r.estado)).toEqual(["PUBLICADO", "CORTADO"]);
    expect(s.llamadas()).toBe(2);
  });

  it("con la señal ya abortada no sondea ni genera", async () => {
    const control = new AbortController();
    control.abort();
    const s = enSerie(respuestaPara);
    const p = preparar(s.generador, { senal: control.signal });
    expect(await evaluarModelo(p.o, p.deps)).toEqual({ estado: "CORTADA_POR_SENAL", corridas: 0, motivo: null, detalle: null });
    expect(p.sondas).toEqual([]);
    expect(s.llamadas()).toBe(0);
  });

  it("sin casos o con opciones fuera de rango lanza RangeError antes de la red", async () => {
    const s = enSerie(respuestaPara);
    for (const malas of [{ casos: [] }, { pasadas: 3 as 1 }, { limiteMs: 0 }, { pausaMs: -1 }, { modelo: "" }]) {
      const p = preparar(s.generador, {}, malas);
      await expect(evaluarModelo(p.o, p.deps)).rejects.toThrow(RangeError);
    }
    expect(s.llamadas()).toBe(0);
  });
});
