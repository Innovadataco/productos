// La corrida diaria del servicio inv-008-ia: hechos → puertas → validador → registro, con dobles (sin base ni red).
import { describe, expect, it, vi } from "vitest";
import type { ConfigIaVigente } from "@/ia/config/leer";
import type { PaqueteHechos } from "@/ia/contrato";
import { casosInventados } from "@/ia/evaluacion/casos";
import { crearGeneradorFalso, type ConductaFalsa } from "@/ia/generador-falso";
import type { EntradaResumen } from "@/ia/registro/fila";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { MAX_REINTENTOS, PAUSA_REINTENTO_MS, correrDiaria, type DependenciasCorrida } from "@/servicio-ia/corrida";
import { VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const casos = casosInventados();
const paqueteDe = (tipo: string): PaqueteHechos => casos.find((c) => c.tipo === tipo)!.paquete;
const DIARIO = paqueteDe("DIARIO");
const REGLAS = paqueteDe("REGLAS");
const HOY = new Date("2027-03-17T00:00:00.000Z");
const DIGEST = "4613a27c".repeat(8);
const config = (extra: Partial<ConfigIaVigente> = {}): ConfigIaVigente => ({ ...VIGENTE_FICTICIA, modo: "local", ...extra });
const responder = (paquete: PaqueteHechos): ConductaFalsa => ({ tipo: "RESPONDER", salidaCruda: salidaDePlantilla(paquete), modeloDigest: DIGEST, latenciaMs: 4613 });
const caido: ConductaFalsa = { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" };

function montar(conducta: ConductaFalsa | ((i: number) => ConductaFalsa), paquetes: readonly PaqueteHechos[] = [DIARIO], extra: Partial<DependenciasCorrida> = {}) {
  const generador = crearGeneradorFalso({ puerta: "local", conducta });
  const registradas: EntradaResumen[] = [];
  const lineas: string[] = [];
  const esperas: number[] = [];
  const deps: DependenciasCorrida = {
    exportar: vi.fn(async () => ({ paquetes, omitidos: [], avisos: [] })),
    generadores: () => [generador],
    digests: () => [DIGEST],
    opciones: () => ({ seed: 42 }),
    yaPublicado: vi.fn(async () => false),
    registrar: async (entrada) => void registradas.push(entrada),
    esperar: async (ms) => void esperas.push(ms),
    registrarLog: (m) => void lineas.push(m),
    ...extra,
  };
  return { deps, generador, registradas, lineas, esperas };
}

describe("correrDiaria", () => {
  it("PUBLICADO: exporta los hechos del día, genera, valida y registra el texto que renderiza el código", async () => {
    const m = montar(responder(DIARIO));
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(m.deps.exportar).toHaveBeenCalledWith(HOY);
    expect(r.porTipo).toEqual({ DIARIO: "PUBLICADO" });
    expect(m.registradas).toHaveLength(1);
    expect(m.registradas[0]).toMatchObject({ estado: "PUBLICADO", paquete: DIARIO, validadorVersion: VERSION_VALIDADOR, opciones: { seed: 42 } });
    expect((m.registradas[0] as unknown as { texto: string }).texto.length).toBeGreaterThan(0);
    expect(m.generador.llamadas()[0]?.limiteMs).toBe(VIGENTE_FICTICIA.limiteSegundos * 1000);
  });

  it("RECHAZADO: una recomendación no se publica; quedan los códigos del validador", async () => {
    const malo = JSON.stringify({ frases: [{ segmentos: [{ texto: "Le recomiendo vender ya" }, { ref: "H01" }, { texto: "." }] }] });
    const m = montar({ tipo: "RESPONDER", salidaCruda: malo, modeloDigest: DIGEST });
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(r.porTipo).toEqual({ DIARIO: "RECHAZADO" });
    expect(m.registradas[0]).toMatchObject({ estado: "RECHAZADO" });
    expect((m.registradas[0] as unknown as { motivos: string[] }).motivos).toContain("RECOMENDACION");
    expect(m.esperas).toEqual([]);
  });

  it("FALLIDO con el modelo caído: lo registra cada vez y reintenta hasta 3 veces, con pausa", async () => {
    const m = montar(caido);
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(MAX_REINTENTOS).toBe(3);
    expect(r.porTipo).toEqual({ DIARIO: "FALLIDO" });
    expect(m.generador.llamadas()).toHaveLength(1 + MAX_REINTENTOS);
    expect(m.registradas).toHaveLength(1 + MAX_REINTENTOS);
    expect(m.registradas.every((e) => e.estado === "FALLIDO" && e.motivo === "MODELO_NO_DISPONIBLE")).toBe(true);
    expect(m.esperas).toEqual(Array.from({ length: MAX_REINTENTOS }, () => PAUSA_REINTENTO_MS));
  });

  it("el modelo vuelve en el segundo intento: un FALLIDO y luego el PUBLICADO", async () => {
    const m = montar((i) => (i === 0 ? caido : responder(DIARIO)));
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(r.porTipo).toEqual({ DIARIO: "PUBLICADO" });
    expect(m.registradas.map((e) => e.estado)).toEqual(["FALLIDO", "PUBLICADO"]);
  });

  it("otro fallo (no es «modelo no disponible») no se reintenta", async () => {
    const m = montar({ tipo: "FALLAR", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_INVALIDO" });
    await correrDiaria(m.deps, config(), HOY);
    expect(m.generador.llamadas()).toHaveLength(1);
    expect(m.esperas).toEqual([]);
  });

  it("sin duplicar: si ya hay un PUBLICADO con esa clave, no llama al modelo ni registra", async () => {
    const m = montar(responder(DIARIO), [DIARIO], { yaPublicado: vi.fn(async () => true) });
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(r.porTipo).toEqual({ DIARIO: "YA_PUBLICADO" });
    expect(m.deps.yaPublicado).toHaveBeenCalledWith(expect.objectContaining({ tipo: "DIARIO", fechaNegocio: DIARIO.hoy, hechosHash: DIARIO.hash, modeloDigest: DIGEST }));
    expect(m.generador.llamadas()).toHaveLength(0);
    expect(m.registradas).toEqual([]);
  });

  it("apagado (sin configuración o con el modo apagado): no exporta, no genera y no registra", async () => {
    for (const c of [null, config({ modo: "apagado" })]) {
      const m = montar(responder(DIARIO));
      const r = await correrDiaria(m.deps, c, HOY);
      expect(r).toEqual({ estado: "APAGADO", porTipo: {} });
      expect(m.deps.exportar).not.toHaveBeenCalled();
      expect(m.generador.llamadas()).toHaveLength(0);
    }
  });

  it("una tarea inactiva se salta; las demás corren, de a una", async () => {
    const tareas = { ...VIGENTE_FICTICIA.tareas, REGLAS: { activo: false, modeloLocal: null } };
    const m = montar(responder(DIARIO), [DIARIO, REGLAS]);
    const r = await correrDiaria(m.deps, config({ tareas }), HOY);
    expect(r.porTipo).toEqual({ DIARIO: "PUBLICADO", REGLAS: "TAREA_INACTIVA" });
    expect(m.generador.llamadas()).toHaveLength(1);
  });

  it("lo que no se pudo armar queda en el log con su código, sin cifras; un fallo del registro no tumba los demás tipos", async () => {
    const m = montar((i) => responder(i === 0 ? DIARIO : REGLAS), [DIARIO, REGLAS], {
      exportar: async () => ({ paquetes: [DIARIO, REGLAS], omitidos: [{ tipo: "ESCENARIOS", codigo: "SIN_PROYECCION" }], avisos: [] }),
      registrar: vi.fn().mockRejectedValueOnce(Object.assign(new Error("fila con cifras 37.911,47"), { codigo: "BASE_RECHAZADA" })).mockResolvedValue(undefined),
    });
    const r = await correrDiaria(m.deps, config(), HOY);
    expect(r.porTipo).toEqual({ DIARIO: "ERROR", REGLAS: "PUBLICADO", ESCENARIOS: "OMITIDO" });
    expect(m.lineas.join("\n")).toContain("SIN_PROYECCION");
    expect(m.lineas.join("\n")).not.toContain("37.911");
  });
});
