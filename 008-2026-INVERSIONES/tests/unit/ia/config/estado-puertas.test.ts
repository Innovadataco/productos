/**
 * `estadoPuertas(config, entorno)`, pura: por puerta, si está lista o qué le falta. Lo que la app no puede saber (la
 * sonda, que hace el servicio de IA; los candados de red de PI; el proxy de salida; los precios de la nube) sale «por
 * verificar», NUNCA «listo»: por eso ninguna puerta queda «lista» desde la pantalla. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import { estadoPuertas, type EstadoPuerta } from "@/ia/config/estado-puertas";
import type { ConfigIaVigente } from "@/ia/config/leer";
import { LISTA_FICTICIA, SIN_LISTA, VIGENTE_FICTICIA } from "./apoyo/config.ficticio";

const de = (estados: readonly EstadoPuerta[], puerta: "local" | "nube") => estados.find((e) => e.puerta === puerta)!;
const requisito = (e: EstadoPuerta, clave: string) => e.requisitos.find((r) => r.clave === clave);
const con = (cambios: Partial<ConfigIaVigente>): ConfigIaVigente => ({ ...VIGENTE_FICTICIA, ...cambios });

describe("estadoPuertas · lo que se sabe desde la app", () => {
  it("con todo lo que la app ve en orden, cada puerta queda POR_VERIFICAR (nunca LISTO)", () => {
    const estados = estadoPuertas(VIGENTE_FICTICIA, { llaveNube: true, listaPi: LISTA_FICTICIA });
    expect(estados.map((e) => e.puerta)).toEqual(["local", "nube"]);
    for (const e of estados) {
      expect(e.estado, e.puerta).toBe("POR_VERIFICAR");
      expect(e.enUso, e.puerta).toBe(true);
    }
    const local = de(estados, "local");
    expect(local.requisitos.map((r) => [r.clave, r.estado])).toEqual([
      ["LISTA_PI", "LISTO"], ["DESTINO", "LISTO"], ["MODELOS", "LISTO"], ["DIGEST", "LISTO"], ["SONDA", "POR_VERIFICAR"], ["RED_PI", "POR_VERIFICAR"],
    ]);
    const nube = de(estados, "nube");
    expect(nube.requisitos.map((r) => [r.clave, r.estado])).toEqual([
      ["LLAVE", "LISTO"], ["TOPE", "LISTO"], ["PROXY_SALIDA", "POR_VERIFICAR"], ["PRECIOS", "POR_VERIFICAR"], ["SERVICIO_IA", "POR_VERIFICAR"],
    ]);
  });

  it("es pura y congelada", () => {
    const entorno = { llaveNube: true, listaPi: LISTA_FICTICIA };
    expect(estadoPuertas(VIGENTE_FICTICIA, entorno)).toEqual(estadoPuertas(VIGENTE_FICTICIA, entorno));
    const estados = estadoPuertas(VIGENTE_FICTICIA, entorno);
    expect(Object.isFrozen(estados)).toBe(true);
    for (const e of estados) expect(Object.isFrozen(e.requisitos)).toBe(true);
  });
});

describe("estadoPuertas · lo que falta", () => {
  it("sin configuración: las dos sin uso y con lo que les falta (apagada)", () => {
    const estados = estadoPuertas(null, { llaveNube: false, listaPi: SIN_LISTA });
    for (const e of estados) {
      expect(e.enUso).toBe(false);
      expect(e.estado).toBe("FALTA");
    }
    expect(requisito(de(estados, "local"), "LISTA_PI")).toEqual({ clave: "LISTA_PI", estado: "FALTA", detalle: "SIN_VARIABLE" });
    expect(requisito(de(estados, "local"), "DESTINO")?.estado).toBe("FALTA");
    expect(requisito(de(estados, "nube"), "LLAVE")).toEqual({ clave: "LLAVE", estado: "FALTA", detalle: "SIN_LLAVE" });
    expect(requisito(de(estados, "nube"), "TOPE")).toEqual({ clave: "TOPE", estado: "FALTA", detalle: "SIN_TOPE" });
  });

  it("la lista de PI vacía: FALTA · LISTA_VACIA", () => {
    const vacia = { estado: "LISTA", version: 1, publicadoPor: "PI (ficticio)", fecha: "2027-01-14", modelos: [] } as const;
    expect(requisito(de(estadoPuertas(VIGENTE_FICTICIA, { llaveNube: true, listaPi: vacia }), "local"), "LISTA_PI")).toEqual({ clave: "LISTA_PI", estado: "FALTA", detalle: "LISTA_VACIA" });
  });

  it("un modelo de una tarea activa que ya no está en la lista: FALTA · MODELO_FUERA_DE_LISTA (y el digest no se puede saber)", () => {
    const tareas = { ...VIGENTE_FICTICIA.tareas, DIARIO: { activo: true, modeloLocal: "qwen2.5:32b" } };
    const local = de(estadoPuertas(con({ tareas }), { llaveNube: true, listaPi: LISTA_FICTICIA }), "local");
    expect(requisito(local, "MODELOS")).toEqual({ clave: "MODELOS", estado: "FALTA", detalle: "MODELO_FUERA_DE_LISTA" });
    expect(requisito(local, "DIGEST")).toEqual({ clave: "DIGEST", estado: "FALTA", detalle: "SIN_DIGEST_DE_PI" });
    expect(local.estado).toBe("FALTA");
  });

  it("sin tareas activas: FALTA · SIN_TAREAS_ACTIVAS", () => {
    const tareas = { DIARIO: { activo: false, modeloLocal: null }, REGLAS: { activo: false, modeloLocal: null }, ESCENARIOS: { activo: false, modeloLocal: null } };
    expect(requisito(de(estadoPuertas(con({ tareas }), { llaveNube: true, listaPi: LISTA_FICTICIA }), "local"), "MODELOS")?.detalle).toBe("SIN_TAREAS_ACTIVAS");
  });

  it("una tarea activa sin modelo: FALTA · MODELO_FALTA", () => {
    const tareas = { ...VIGENTE_FICTICIA.tareas, ESCENARIOS: { activo: true, modeloLocal: null } };
    expect(requisito(de(estadoPuertas(con({ tareas }), { llaveNube: true, listaPi: LISTA_FICTICIA }), "local"), "MODELOS")?.detalle).toBe("MODELO_FALTA");
  });

  it("el modo dice qué puerta está en uso", () => {
    const soloNube = estadoPuertas(con({ modo: "nube" }), { llaveNube: true, listaPi: LISTA_FICTICIA });
    expect(soloNube.map((e) => [e.puerta, e.enUso])).toEqual([["local", false], ["nube", true]]);
    const apagada = estadoPuertas(con({ modo: "apagado" }), { llaveNube: true, listaPi: LISTA_FICTICIA });
    expect(apagada.map((e) => e.enUso)).toEqual([false, false]);
  });

  it("sin destino guardado: FALTA · SIN_DESTINO; sin llave: FALTA · SIN_LLAVE; sin tope: FALTA · SIN_TOPE", () => {
    const estados = estadoPuertas(con({ ollamaHost: null, ollamaPuerto: null, topeMicroUsd: null }), { llaveNube: false, listaPi: LISTA_FICTICIA });
    expect(requisito(de(estados, "local"), "DESTINO")).toEqual({ clave: "DESTINO", estado: "FALTA", detalle: "SIN_DESTINO" });
    expect(requisito(de(estados, "nube"), "LLAVE")?.detalle).toBe("SIN_LLAVE");
    expect(requisito(de(estados, "nube"), "TOPE")?.detalle).toBe("SIN_TOPE");
  });
});
