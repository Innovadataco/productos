/**
 * `filaAConfig`: la fila de config_ia leída de la base como la configuración vigente, revisada otra vez (cierra en
 * fallo: una fila que no cuadra da null, y null es «apagada»). Los decimales de Prisma pasan a enteros: la temperatura
 * en centésimas y el tope en micro-USD. Pura. Datos inventados.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { destinoDe, filaAConfig, type FilaConfigIa } from "@/ia/config/leer";
import { DESTINO_FICTICIO, HOST_FICTICIO, PUERTO_FICTICIO, VIGENTE_FICTICIA } from "./apoyo/config.ficticio";

const FILA: FilaConfigIa = {
  id: "config-ficticia-4613",
  version: 7,
  modo: "local-luego-nube",
  ollamaHost: HOST_FICTICIO,
  ollamaPuerto: PUERTO_FICTICIO,
  temperaturaLocal: new Prisma.Decimal("0"),
  tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "gemma2:27b" }, ESCENARIOS: { activo: false, modeloLocal: null } },
  modeloNube: "claude-sonnet-5-5",
  topeMensualUsd: new Prisma.Decimal("4.61"),
  horaResumen: "19:00",
  limiteSegundos: 45,
  analisisDemanda: false,
  esfuerzoNube: "medium",
  creadaEn: new Date("2027-03-17T23:41:13.000Z"),
};

describe("filaAConfig", () => {
  it("la fila válida es la vigente ficticia, congelada", () => {
    const c = filaAConfig(FILA);
    expect(c).toEqual(VIGENTE_FICTICIA);
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c?.tareas)).toBe(true);
  });

  it("convierte la temperatura y el tope", () => {
    expect(filaAConfig({ ...FILA, temperaturaLocal: new Prisma.Decimal("0.37"), topeMensualUsd: new Prisma.Decimal("50") })).toMatchObject({ temperaturaCentesimas: 37, topeMicroUsd: 50_000_000n });
    expect(filaAConfig({ ...FILA, topeMensualUsd: null })?.topeMicroUsd).toBeNull();
  });

  it("el interruptor del análisis a demanda sale de la fila; sin encender, apagado (falla cerrada)", () => {
    expect(filaAConfig(FILA)?.analisisDemanda).toBe(false);
    expect(filaAConfig({ ...FILA, analisisDemanda: true })?.analisisDemanda).toBe(true);
    expect(filaAConfig({ ...FILA, analisisDemanda: "sí" } as unknown as FilaConfigIa)).toBeNull();
  });

  it("un límite guardado mayor a 60 s (una versión vieja de hasta 120) se acota a 60; hasta 60 queda igual", () => {
    expect(filaAConfig({ ...FILA, limiteSegundos: 120 })?.limiteSegundos).toBe(60);
    expect(filaAConfig({ ...FILA, limiteSegundos: 61 })?.limiteSegundos).toBe(60);
    expect(filaAConfig({ ...FILA, limiteSegundos: 60 })?.limiteSegundos).toBe(60);
    expect(filaAConfig({ ...FILA, limiteSegundos: 10 })?.limiteSegundos).toBe(10);
  });

  it("una tarea que falta queda inactiva y sin modelo (una versión vieja sin una tarea nueva)", () => {
    const c = filaAConfig({ ...FILA, tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" } } });
    expect(c?.tareas.REGLAS).toEqual({ activo: false, modeloLocal: null });
  });

  it.each([
    ["un modo que no es de la lista", { modo: "nube-luego-local" }],
    ["un modelo de nube que no es de la lista", { modeloNube: "claude-opus-5" }],
    ["un esfuerzo raro", { esfuerzoNube: "high" }],
    ["una hora rara", { horaResumen: "19:30" }],
    ["un límite fuera del rango de la base", { limiteSegundos: 121 }],
    ["un límite menor a 10", { limiteSegundos: 9 }],
    ["una temperatura fuera de rango", { temperaturaLocal: new Prisma.Decimal("1.5") }],
    ["un tope fuera de rango", { topeMensualUsd: new Prisma.Decimal("51") }],
    ["las tareas como arreglo", { tareas: ["DIARIO"] }],
    ["una tarea con forma rara", { tareas: { DIARIO: { activo: "sí" } } }],
    ["una tarea desconocida", { tareas: { OTRA: { activo: true, modeloLocal: null } } }],
    ["un host con otra forma", { ollamaHost: "ollama.ficticio" }],
  ])("%s: null (apagada)", (_n, cambios) => {
    expect(filaAConfig({ ...FILA, ...cambios } as FilaConfigIa)).toBeNull();
  });
});

describe("destinoDe", () => {
  it("el destino guardado como URL de la puerta local, o null", () => {
    expect(destinoDe(VIGENTE_FICTICIA)).toBe(DESTINO_FICTICIO);
    expect(destinoDe({ ...VIGENTE_FICTICIA, ollamaHost: null, ollamaPuerto: null })).toBeNull();
    expect(destinoDe(null)).toBeNull();
  });
});
