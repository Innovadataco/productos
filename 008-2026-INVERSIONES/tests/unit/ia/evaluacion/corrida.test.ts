/**
 * Una corrida del arnés (E7), sin red, con el GeneradorFalso: armarPedido (vista ciega, prompt versionado y esquema),
 * generarConPuertas por la puerta local, validarSalida y el registro. PUBLICADO lleva el texto que renderiza el código;
 * RECHAZADO, los códigos; FALLIDO, el motivo; CORTADO, la señal del operador. Nunca el destino.
 */
import { describe, expect, it } from "vitest";
import { crearGeneradorFalso, type ConductaFalsa } from "@/ia/generador-falso";
import { sha256Hex, jsonCanonico } from "@/ia/hash";
import { ESQUEMA_SALIDA } from "@/ia/prompts/esquema";
import { promptDe } from "@/ia/prompts/prompts";
import type { ResultadoPuertas } from "@/ia/puertas";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { resumenSinIa, salidaDePlantilla } from "@/ia/validador/plantilla";
import { vistaCiega } from "@/ia/vista-ciega";
import { casosInventados } from "@/ia/evaluacion/casos";
import { correrCaso, ErrorEvaluacion, interpretarResultado, LIMITE_EVALUACION_MS, type EntradaCorrida } from "@/ia/evaluacion/corrida";

const casos = casosInventados();
const caso = casos.find((c) => c.tipo === "REGLAS")!;
const MODELO = "ficticio-local:7b";

function reloj(pasos: readonly number[]): () => number {
  let i = 0;
  return () => pasos[Math.min(i++, pasos.length - 1)] as number;
}

function entrada(conducta: ConductaFalsa, extra: Partial<EntradaCorrida> = {}) {
  const generador = crearGeneradorFalso({ puerta: "local", conducta });
  const e: EntradaCorrida = {
    caso, modelo: MODELO, pasada: 1, orden: 3, generador, limiteMs: 4613, senal: new AbortController().signal,
    reloj: reloj([1237, 5850]), ahoraIso: () => "2027-03-17T19:00:13.000Z", ...extra,
  };
  return { e, generador };
}

describe("correrCaso", () => {
  it("el límite de la evaluación es el de PI: 120 s", () => {
    expect(LIMITE_EVALUACION_MS).toBe(120_000);
  });

  it("PUBLICADO: el texto lo renderiza el código y el registro trae latencia, tokens, hashes y versiones", async () => {
    const salida = salidaDePlantilla(caso.paquete);
    const { e, generador } = entrada({ tipo: "RESPONDER", salidaCruda: salida, latenciaMs: 4613, tokensEntrada: 1937, tokensSalida: 271, modeloDigest: "d".repeat(64) });
    const r = await correrCaso(e);
    const prompt = promptDe(caso.tipo);
    expect(r).toMatchObject({
      caso: caso.id, tipo: caso.tipo, modelo: MODELO, pasada: 1, orden: 3, inicio: "2027-03-17T19:00:13.000Z", estado: "PUBLICADO", motivos: [], detalle: null,
      hallazgos: [], latenciaMs: 4613, duracionMs: 4613, agotado: false, tokensEntrada: 1937, tokensSalida: 271, modeloDigest: "d".repeat(64),
      salidaCruda: salida, salidaHash: sha256Hex(salida), hechosHash: caso.paquete.hash, promptVersion: prompt.version, promptHash: prompt.hash, validadorVersion: VERSION_VALIDADOR,
    });
    const publicado = resumenSinIa(caso.paquete);
    expect(publicado.ok && r.texto === publicado.resumen.texto).toBe(true);
    expect(r.caracteresPedido).toBe(prompt.texto.length + jsonCanonico(vistaCiega(caso.paquete)).length);
    expect(r.hechos).toBe(caso.paquete.hechos.filter((h) => h.clave !== "ESPECIE_NOMBRE").length);
    expect(r.citados).toBeGreaterThan(0);
    const [pedido] = generador.llamadas();
    expect(pedido?.prompt.version).toBe(prompt.version);
    expect(pedido?.esquemaSalida).toEqual(ESQUEMA_SALIDA);
    expect(pedido?.limiteMs).toBe(4613);
    expect(pedido?.vista).toEqual(vistaCiega(caso.paquete));
  });

  it("RECHAZADO: una recomendación no se publica; quedan los códigos y los hallazgos, sin texto", async () => {
    const malo = JSON.stringify({ frases: [{ segmentos: [{ texto: "Le recomiendo vender ya" }, { ref: "H01" }, { texto: "." }] }] });
    const r = await correrCaso(entrada({ tipo: "RESPONDER", salidaCruda: malo }).e);
    expect(r.estado).toBe("RECHAZADO");
    expect(r.motivos).toContain("RECOMENDACION");
    expect(r.hallazgos.length).toBeGreaterThan(0);
    expect(r.texto).toBeNull();
    expect(r.salidaCruda).toBe(malo);
  });

  it("FALLIDO: sin modelo; y el tiempo agotado se marca", async () => {
    const sin = await correrCaso(entrada({ tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" }).e);
    expect(sin).toMatchObject({ estado: "FALLIDO", motivos: ["MODELO_NO_DISPONIBLE"], detalle: "CONEXION_RECHAZADA", agotado: false, latenciaMs: null, salidaCruda: null, salidaHash: null, texto: null });
    const lento = await correrCaso(entrada({ tipo: "FALLAR", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" }).e);
    expect(lento).toMatchObject({ estado: "FALLIDO", motivos: ["TIEMPO_AGOTADO"], agotado: true });
  });

  it("CORTADO: la señal del operador corta el pedido en vuelo", async () => {
    const control = new AbortController();
    const promesa = correrCaso(entrada({ tipo: "TARDAR", ms: 60_000, luego: { tipo: "RESPONDER", salidaCruda: "{}" } }, { senal: control.signal, limiteMs: 90_000 }).e);
    setTimeout(() => control.abort(), 5);
    const r = await promesa;
    expect(r.estado).toBe("CORTADO");
    expect(r.agotado).toBe(false);
  });

  it("solo con la puerta local: otro generador es un defecto del arnés", async () => {
    const nube = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: "{}" } });
    await expect(correrCaso({ ...entrada({ tipo: "RESPONDER", salidaCruda: "{}" }).e, generador: nube })).rejects.toThrow(ErrorEvaluacion);
  });

  it("el registro no lleva ningún dato del destino", async () => {
    const r = await correrCaso(entrada({ tipo: "RESPONDER", salidaCruda: salidaDePlantilla(caso.paquete) }).e);
    expect(JSON.stringify(r)).not.toMatch(/http:\/\/|\/api\//);
  });
});

describe("interpretarResultado", () => {
  it("VISTA_NO_CIEGA y APAGADO son defectos del arnés (lanza, sin datos)", () => {
    const vista: ResultadoPuertas = { estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA", codigos: ["VALOR_DEL_PAQUETE"] };
    const apagado: ResultadoPuertas = { estado: "APAGADO", ok: false };
    for (const r of [vista, apagado]) {
      expect(() => interpretarResultado(r, caso.paquete, false)).toThrow(ErrorEvaluacion);
    }
    try {
      interpretarResultado(vista, caso.paquete, false);
    } catch (error) {
      expect((error as ErrorEvaluacion).codigo).toBe("DEFECTO_DEL_ARNES");
    }
  });

  it("un fallo con la señal abortada es CORTADO, aunque la puerta diga tiempo agotado", () => {
    const fallo: ResultadoPuertas = { estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" }] };
    expect(interpretarResultado(fallo, caso.paquete, true)).toMatchObject({ estado: "CORTADO", agotado: false });
    expect(interpretarResultado(fallo, caso.paquete, false)).toMatchObject({ estado: "FALLIDO", agotado: true });
  });
});
