// Textos del área de edición (fase B, PR-B): cada código que pueden devolver el dominio del plan (src/plan/**) y los
// lectores del borde tiene su mensaje en español, leído del código para que el mapa no se quede atrás; y ningún texto
// recomienda comprar ni vender. Puro.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as textos from "@/app/edicion/textos";
import { ETIQUETAS_CAMPO, MENSAJES, mensajeDeCampo, mensajeDeError } from "@/app/edicion/textos";

const SRC = new URL("../../../src/", import.meta.url).pathname;
// La de tests/unit/plan/textos.test.ts, más «le sugerimos». La frase «no recomienda comprar ni vender» se quita antes.
const IMPERATIVOS = /\b(compre|venda|compra ya|vende ya|recomend\w*|debería|le conviene|le sugerimos)\b/i;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.ts$/.test(n) ? [ruta] : [];
  });
}

/** Los códigos que el dominio del plan y el borde pueden devolver: `new ErrorPlan("X"…)` y `codigo: "X"`. */
function codigosDelCodigo(): string[] {
  const fuentes = [...archivos(join(SRC, "plan")).filter((r) => !r.includes("/importar/"))].map((r) => readFileSync(r, "utf8"));
  const codigos = fuentes.flatMap((t) => [...t.matchAll(/new ErrorPlan\("([A-Z_]+)"/g), ...t.matchAll(/codigo: "([A-Z_]+)"/g)].map((m) => m[1]!));
  return [...new Set(codigos)].sort();
}

/** Todos los textos exportados (y los de los mapas), para revisarlos. */
function todosLosTextos(): string[] {
  const valores = Object.values(textos).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "object" && v !== null ? Object.values(v).filter((x): x is string => typeof x === "string") : []));
  return valores;
}

describe("mensajes de los códigos", () => {
  it("el recorrido encuentra los códigos (control positivo)", () => {
    const codigos = codigosDelCodigo();
    for (const c of ["DATOS_INVALIDOS", "PLAN_CAMBIO", "VIGENCIA_RETROCEDE", "ORDEN_YA_ENLAZADA", "NIVEL_NO_RECONOCIDO", "REGLAS_DEMASIADAS", "ORDEN_CON_CORRECCION", "ACCION_DISTINTA_SIN_EXCEPCION"]) {
      expect(codigos, c).toContain(c);
    }
  });

  it("cada código del dominio y del borde tiene su mensaje", () => {
    for (const c of codigosDelCodigo()) expect(MENSAJES[c], c).toEqual(expect.any(String));
  });

  it("un código desconocido da un mensaje genérico, nunca el código crudo", () => {
    expect(mensajeDeError("NO_EXISTE_ESTE_CODIGO")).toBe(MENSAJES.DESCONOCIDO);
    expect(mensajeDeError("PLAN_CAMBIO")).toBe(MENSAJES.PLAN_CAMBIO);
  });

  it("el mensaje de un campo nombra el campo con su etiqueta (y la regla, con su número desde 1)", () => {
    expect(mensajeDeCampo({ campo: "reglas[2].nivel", codigo: "NIVEL_NO_RECONOCIDO" })).toBe(`Regla 3 · ${ETIQUETAS_CAMPO.nivel}: ${MENSAJES.NIVEL_NO_RECONOCIDO}`);
    expect(mensajeDeCampo({ campo: "motivo", codigo: "VACIO" })).toBe(`${ETIQUETAS_CAMPO.motivo}: ${MENSAJES.VACIO}`);
    expect(mensajeDeCampo({ campo: "cuerpo", codigo: "FORMATO_INVALIDO" })).toBe(MENSAJES.FORMATO_INVALIDO);
  });
});

describe("ningún texto recomienda comprar ni vender", () => {
  it("el candado muerde (prueba por mutación)", () => {
    expect(IMPERATIVOS.test("Le conviene vender")).toBe(true);
    expect(IMPERATIVOS.test("Compre más")).toBe(true);
    expect(IMPERATIVOS.test("Le recomendamos esperar")).toBe(true);
  });

  it("ninguno de los textos del área de edición lo hace", () => {
    const lista = todosLosTextos();
    expect(lista.length).toBeGreaterThan(30);
    for (const t of lista) expect(IMPERATIVOS.test(t.replace("no recomienda comprar ni vender", "")), t).toBe(false);
  });

  it("el pie lo dice explícito", () => {
    expect(textos.PIE_EDICION).toContain("no recomienda comprar ni vender");
  });
});
