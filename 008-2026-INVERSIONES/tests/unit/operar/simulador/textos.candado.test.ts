/**
 * Candado de la línea que no se cruza: 008 no recomienda comprar ni vender. Recorre
 *  1. todos los textos que arma el simulador (cada código, cada variante y los de casos al azar), y
 *  2. el fuente de la zona (src/operar/simulador y sus pruebas): textos, comentarios, identificadores y nombres de
 *     archivo, partidos en palabras (camelCase, snake_case y kebab-case), sin tildes, sin caracteres invisibles y con
 *     cualquier espacio como espacio;
 * y falla si aparece una expresión que recomienda, aconseja, juzga o promete, o una letra de otra escritura (una «o» cirílica,
 * U+043E, haría pasar una palabra prohibida). Es una red barata, no una garantía: el respaldo es la revisión de
 * textos.ts. Es el ÚNICO archivo excluido del recorrido (tiene la lista), y las frases plantadas se arman al correr.
 * No se prohíben «la compra», «la venta», «comprar», «vender» ni «debe ser»: describen o citan el plan.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { simularOperacion } from "@/operar/simulador/simular";
import {
  COMISION_SIN_HISTORIA,
  ETIQUETA_COMISION,
  NOTA_CAJA_SIN_COMISION,
  NOTA_VALORACION,
  textoAfectacion,
  textoAviso,
  textoComision,
  textoError,
  textoRegla,
} from "@/operar/simulador/textos";
import type { Afectacion, AvisoSimulacion, ErrorSimulacion, ReglaSimulada, Simulacion } from "@/operar/simulador/tipos";
import { crearPrng } from "@/proyecciones/prng";
import { A, B, D, casoAlAzar, idDe, regla } from "./apoyo/estado.ficticio";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const ZONA = [path.join(RAIZ, "src", "operar", "simulador"), path.join(RAIZ, "tests", "unit", "operar", "simulador")];
const PROPIO = path.join(__dirname, "textos.candado.test.ts");

const RAICES = [
  // mandar o aconsejar
  "compren?", "compremos", "vendan?", "vendamos", "mantenga\\w*", "mantener", "conserve\\w*", "conservar", "invierta\\w*", "invertir",
  "aproveche\\w*", "aprovechar", "esper(e|en|ar)", "evit\\w*", "prefier\\w*", "hag(a|an|amos)", "tome\\w*", "tomar la", "pruebe\\w*",
  "deberia\\w*", "debe (comprar|vender)", "recom\\w*", "suger\\w*", "sugier\\w*", "aconsej\\w*",
  // juzgar o prometer
  "conviene\\w*", "convendr\\w*", "convenient\\w*", "mejor\\w*", "peor\\w*", "ideal\\w*", "oportun\\w*", "favorable\\w*", "prudente\\w*",
  "riesg\\w*", "ventaj\\w*", "barat\\w*", "atractiv\\w*", "vale la pena", "buen momento", "momento de", "hora de", "es tiempo",
  "senal\\w*", "rompe\\w*", "incumple\\w*", "viola\\w*", "venderia\\w*", "compraria\\w*",
];
const PROHIBIDO = new RegExp(`\\b(${RAICES.join("|")})\\b`, "g");
/** Una letra de otra escritura (cirílica, griega…): ni en los textos ni en el fuente. */
const OTRA_ESCRITURA = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/** Sin tildes ni invisibles, todo espacio como espacio, los identificadores partidos en palabras y en minúsculas. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

const prohibidasEn = (texto: string): string[] => [
  ...[...normalizar(texto).matchAll(PROHIBIDO)].map((m) => m[0]),
  ...(OTRA_ESCRITURA.test(texto) ? ["letra de otra escritura"] : []),
];

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

// ───────────── Todos los textos que arma el simulador ─────────────

const ERRORES: readonly ErrorSimulacion[] = [
  { codigo: "LADO_INVALIDO" }, { codigo: "CANTIDAD_NO_POSITIVA" }, { codigo: "CANTIDAD_FUERA_DE_RANGO" }, { codigo: "PRECIO_NO_POSITIVO" },
  { codigo: "PRECIO_FUERA_DE_ESCALA" }, { codigo: "ESPECIE_DESCONOCIDA" }, { codigo: "VENTA_SUPERA_TENENCIA", tiene: 379n, pide: 4613n },
  { codigo: "ORDEN_FUERA_DE_RANGO" },
];
const AVISOS: readonly AvisoSimulacion[] = [
  { codigo: "COMPRA_SUPERA_CAJA", caja: D("37911.47"), necesario: D("44114.3944"), conComision: true },
  { codigo: "COMPRA_SUPERA_CAJA", caja: D("37911.47"), necesario: D("41519.43"), conComision: false },
  { codigo: "ESPECIES_SIN_CIERRE", especies: [{ instrumentoId: idDe(B), nemotecnico: B }] },
  { codigo: "ESPECIES_SIN_CIERRE", especies: [{ instrumentoId: idDe(A), nemotecnico: A }, { instrumentoId: idDe(B), nemotecnico: B }] },
];
const AFECTACIONES: readonly Afectacion[] = [
  { tipo: "MONTO_ORDEN_BAJO" },
  { tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "BAJO" } },
  { tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "TOCADA", lado: "SOBRE" } },
  { tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente: { estado: "EN_EL_NIVEL" } },
  { tipo: "OTRA_ACCION" },
];
const REGLAS: readonly ReglaSimulada[] = (["NINGUNA", "CIERRE_BAJO", "CIERRE_SOBRE", "MONTO_ORDEN_BAJO", "LIBRE"] as const).flatMap((condicion) =>
  (["COMPRAR", "VENDER", "NO_ACTUAR"] as const).flatMap((accion) =>
    [null, 41n].flatMap((cantidad) =>
      [null, idDe(A)].map((instrumentoId) =>
        regla({ condicion, accion, cantidad, instrumentoId, nivel: condicion === "NINGUNA" || condicion === "LIBRE" ? null : D("4613.27") }),
      ),
    ),
  ),
);

function textosDe(s: Simulacion): string[] {
  return [
    textoComision(s.comision),
    ...s.avisos.map(textoAviso),
    ...s.reglasAfectadas.flatMap((r) => [textoRegla(r.regla, A), ...r.afectaciones.map((a) => textoAfectacion(a, r.regla))]),
  ];
}

function textosAlAzar(): string[] {
  const prng = crearPrng(37_911);
  return Array.from({ length: 211 }, (_v, k) => {
    const caso = casoAlAzar(prng, k);
    const r = simularOperacion(caso.estado, caso.operacion, caso.contexto);
    return r.ok ? textosDe(r.simulacion) : r.errores.map(textoError);
  }).flat();
}

const TODOS = (): string[] => [
  ETIQUETA_COMISION, COMISION_SIN_HISTORIA, NOTA_CAJA_SIN_COMISION, NOTA_VALORACION,
  textoComision({ estado: "SIN_HISTORIA" }),
  textoComision({ estado: "ESTIMADA", lado: "VENTA", valor: D("14.5678"), ordenesBase: 1 }),
  textoComision({ estado: "ESTIMADA", lado: "COMPRA", valor: D("14.5678"), ordenesBase: 37 }),
  ...ERRORES.map(textoError),
  ...AVISOS.map(textoAviso),
  ...REGLAS.flatMap((r) => [textoRegla(r, A), ...AFECTACIONES.map((a) => textoAfectacion(a, r))]),
  ...textosAlAzar(),
];

describe("candado: el simulador no recomienda comprar ni vender", () => {
  it("control positivo: cada expresión plantada lo pone en rojo, también dentro de un texto real o de un identificador", () => {
    const plantadas = [
      ["le", "conviene", "vender"], ["Compre", "FICTICIA-A"], ["Venda", "ya"], ["le", "recomendamos", "esperar"], ["Debería", "comprar"],
      ["es", "un", "buen", "momento"], ["una", "oportunidad"], ["Mantenga", "sus", "acciones"], ["le", "sugerimos"], ["Aproveche", "la", "caída"],
      ["la", "orden", "rompe", "su", "regla"], ["señal", "de", "venta"], ["está", "barata"], ["Mantener", "sus", "acciones"], ["es", "mejor", "esperar"],
      ["sería", "conveniente"], ["evite", "vender"], ["tiene", "poco", "riesgo"], ["es", "hora", "de", "vender"], ["la", "vendería"],
    ].map((p) => p.join(" "));
    for (const frase of plantadas) expect(prohibidasEn(frase), frase).not.toEqual([]);
    expect(prohibidasEn(`${textoError({ codigo: "ESPECIE_DESCONOCIDA" })} ${["Le", "conviene"].join(" ")}.`)).toEqual(["conviene"]);
    expect(prohibidasEn(`const ${["le", "Conviene"].join("")}Vender = true;`)).toEqual(["conviene"]);
    expect(prohibidasEn(["DEBERIA", "COMPRAR"].join("_"))).toEqual(["deberia"]);
    expect(prohibidasEn("le conv\u200Biene")).toEqual(["conviene"]);
    expect(prohibidasEn("le con\u0301viene")).toEqual(["conviene"]);
    expect(prohibidasEn("le\u00A0conviene")).toEqual(["conviene"]);
    expect(prohibidasEn(`le${String.fromCharCode(12288)}conviene`)).toEqual(["conviene"]);
    expect(prohibidasEn("le c\u043Enviene")).toEqual(["letra de otra escritura"]);
  });

  it("control negativo: lo que describe o cita el plan no muerde", () => {
    for (const frase of [
      "El valor de la compra pasa la caja", "la venta es de 41 acciones", "Su plan para esta especie dice: vender.", "comprar 37",
      "La cantidad debe ser entera", "esperaba una simulación", "−$ 6.202,9244 · ≤ 10⁻¹⁶ × n", "Su regla de FICTICIA-A dice: no actuar.",
    ]) {
      expect(prohibidasEn(frase), frase).toEqual([]);
    }
  });

  it("ningún texto que arma el simulador tiene una expresión prohibida", () => {
    const textos = TODOS();
    expect(textos.length).toBeGreaterThan(450);
    const infractores = textos.filter((t) => prohibidasEn(t).length > 0);
    expect(infractores).toEqual([]);
  });

  it("ni el fuente de la zona: textos, comentarios, identificadores y nombres de archivo", () => {
    const todos = ZONA.flatMap(archivos);
    const excluidos = todos.filter((p) => p === PROPIO);
    expect(excluidos.map((p) => path.relative(RAIZ, p))).toEqual([path.relative(RAIZ, PROPIO)]);
    const revisados = todos.filter((p) => p !== PROPIO);
    expect(revisados.length).toBeGreaterThan(12);
    const infractores = revisados.flatMap((p) => {
      const rel = path.relative(RAIZ, p);
      return [...prohibidasEn(rel), ...prohibidasEn(readFileSync(p, "utf8"))].map((h) => `${rel}: ${h}`);
    });
    expect(infractores).toEqual([]);
  });
});
