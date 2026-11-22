/**
 * Los pares a ciegas para Jelk (E7): por caso, dos textos de fuentes distintas (dos modelos, o un modelo y la plantilla
 * sin IA). El orden de los pares y el de A y B van al azar con semilla; la clave va aparte; el archivo de pares no nombra
 * ninguna fuente. Con «TODOS», todos los pares posibles (p. ej., 3 tipos × los pares de 3 modelos = 9).
 */
import { describe, expect, it } from "vitest";
import type { TipoResumen } from "@/ia/contrato";
import { armarPares, claveDePares, ErrorPares, nombraFuentes, paresEnMarkdown, type CasoDePar, type TextosDeFuente } from "@/ia/evaluacion/pares";

const TIPOS: readonly TipoResumen[] = ["DIARIO", "REGLAS", "ESCENARIOS"];
const casos: readonly CasoDePar[] = TIPOS.flatMap((tipo) => Array.from({ length: 6 }, (_, i) => ({ id: `${tipo}-0${i + 1}`, tipo })));

function fuente(nombre: string, sin: readonly string[] = []): TextosDeFuente {
  return { fuente: nombre, textos: new Map(casos.filter((c) => !sin.includes(c.id)).map((c) => [c.id, `Texto de ${c.id} según ${nombre} con $ 4.613.`])) };
}

const A = "ficticio-a:7b";
const B = "ficticio-b:9b";
const C = "ficticio-c:5b";

describe("armarPares", () => {
  it("10 pares de casos distintos, repartidos entre los tres tipos, reproducibles con la semilla", () => {
    const r = armarPares({ casos, fuentes: [fuente(A), fuente("plantilla")], cantidad: 10, semilla: 4613 });
    expect(r.pares).toHaveLength(10);
    expect(new Set(r.pares.map((p) => p.caso)).size).toBe(10);
    const porTipo = TIPOS.map((t) => r.pares.filter((p) => p.tipo === t).length);
    expect(porTipo.every((n) => n >= 3)).toBe(true);
    expect(r.pares.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(armarPares({ casos, fuentes: [fuente(A), fuente("plantilla")], cantidad: 10, semilla: 4613 })).toEqual(r);
    expect(armarPares({ casos, fuentes: [fuente(A), fuente("plantilla")], cantidad: 10, semilla: 37_911 }).pares.map((p) => p.caso)).not.toEqual(r.pares.map((p) => p.caso));
    for (const p of r.pares) {
      expect(new Set([p.a.fuente, p.b.fuente])).toEqual(new Set([A, "plantilla"]));
      expect(p.a.texto).toContain(p.caso);
      expect(p.b.texto).toContain(p.caso);
    }
  });

  it("A y B van al azar pero balanceados: cada fuente sale de A la mitad de las veces (revisión)", () => {
    for (const semilla of [4613, 37_911, 1237]) {
      const r = armarPares({ casos, fuentes: [fuente(A), fuente(B)], cantidad: 10, semilla });
      expect(r.pares.filter((p) => p.a.fuente === A).length).toBe(5);
    }
    const nueve = armarPares({ casos: casos.filter((c) => c.id.endsWith("-01")), fuentes: [fuente(A), fuente(B), fuente(C)], cantidad: "TODOS", semilla: 4613 });
    for (const f of [A, B, C]) expect(nueve.pares.filter((p) => p.a.fuente === f).length).toBeGreaterThanOrEqual(2);
  });

  it("TODOS con tres fuentes: los tres pares posibles de cada caso", () => {
    const tres = casos.filter((c) => c.id.endsWith("-01"));
    const r = armarPares({ casos: tres, fuentes: [fuente(A), fuente(B), fuente(C)], cantidad: "TODOS", semilla: 4613 });
    expect(r.pares).toHaveLength(9);
    const combinaciones = new Set(r.pares.map((p) => `${p.caso}|${[p.a.fuente, p.b.fuente].sort().join("+")}`));
    expect(combinaciones.size).toBe(9);
  });

  it("un caso sin texto de alguna fuente queda sin par, y se dice cuál falta", () => {
    const r = armarPares({ casos, fuentes: [fuente(A, ["DIARIO-01", "REGLAS-02"]), fuente(B)], cantidad: "TODOS", semilla: 4613 });
    expect(r.pares).toHaveLength(16);
    expect(r.sinPar).toEqual([{ caso: "DIARIO-01", faltan: [A] }, { caso: "REGLAS-02", faltan: [A] }]);
  });

  it("menos casos posibles que los pedidos: los que haya", () => {
    const pocos = casos.slice(0, 2);
    expect(armarPares({ casos: pocos, fuentes: [fuente(A), fuente(B)], cantidad: 10, semilla: 4613 }).pares).toHaveLength(2);
  });

  it("fuentes insuficientes, repetidas o una cantidad inválida lanzan ErrorPares", () => {
    const codigo = (f: () => unknown): string => {
      try {
        f();
        return "SIN_ERROR";
      } catch (e) {
        return e instanceof ErrorPares ? e.codigo : "OTRO";
      }
    };
    expect(codigo(() => armarPares({ casos, fuentes: [fuente(A)], cantidad: 10, semilla: 1 }))).toBe("FUENTES_INSUFICIENTES");
    expect(codigo(() => armarPares({ casos, fuentes: [fuente(A), fuente(A)], cantidad: 10, semilla: 1 }))).toBe("FUENTE_REPETIDA");
    expect(codigo(() => armarPares({ casos, fuentes: [fuente(A), fuente(B)], cantidad: 0, semilla: 1 }))).toBe("CANTIDAD_INVALIDA");
  });
});

describe("paresEnMarkdown y claveDePares", () => {
  const r = armarPares({ casos, fuentes: [fuente(A), fuente("plantilla")], cantidad: 10, semilla: 4613 });

  it("el archivo de pares trae los textos y el formato para calificar de 1 a 5, sin nombrar ninguna fuente", () => {
    const md = paresEnMarkdown(r.pares);
    expect(md).toContain("## Par 1");
    expect(md).toContain("## Par 10");
    expect(md).toContain("Texto A");
    expect(md).toContain("Texto B");
    expect(md).toMatch(/1 a 5/);
    for (const p of r.pares) {
      expect(md).toContain(p.a.texto);
      expect(md).toContain(p.b.texto);
    }
    const sinNombres = paresEnMarkdown(armarPares({ casos, fuentes: [{ fuente: A, textos: new Map(casos.map((c) => [c.id, "Uno."])) }, { fuente: "plantilla", textos: new Map(casos.map((c) => [c.id, "Dos."])) }], cantidad: 10, semilla: 1 }).pares);
    expect(nombraFuentes(sinNombres, [A, "plantilla"])).toBe(false);
    expect(sinNombres).not.toMatch(/sin IA|IA local|modelo|qwen|gemma|aya/i);
  });

  it("control positivo: nombraFuentes ve un nombre de fuente", () => {
    expect(nombraFuentes(`Texto A (${A})`, [A])).toBe(true);
    expect(nombraFuentes("Texto A según la Plantilla", ["plantilla"])).toBe(true);
  });

  it("la clave dice, por par, el caso y qué fuente es A y cuál B, con la semilla", () => {
    const clave = claveDePares(r, 4613);
    expect(clave.semilla).toBe(4613);
    expect(clave.pares).toHaveLength(10);
    expect(clave.pares[0]).toEqual({ par: 1, caso: r.pares[0]!.caso, tipo: r.pares[0]!.tipo, a: r.pares[0]!.a.fuente, b: r.pares[0]!.b.fuente });
    expect(clave.sinPar).toEqual([]);
  });
});
