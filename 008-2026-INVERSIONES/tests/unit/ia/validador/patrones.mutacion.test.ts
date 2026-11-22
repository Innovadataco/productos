/**
 * Candado por mutación de cada patrón. Tres piezas, para que quitar un patrón (o un patrón y su ejemplo a la vez) ponga
 * la prueba en rojo:
 * - el inventario literal de los ids, escrito aquí (no se lee de `src/`);
 * - un ejemplo por patrón que detecta SOLO ese patrón entre todas las listas, y que la lista sin ese patrón ya no detecta;
 * - el cableado: `validarSalida` rechaza cada ejemplo, puesto en una frase válida, con el código de su lista.
 * Y ninguna etiqueta del catálogo dispara un patrón (la plantilla sin IA las usa tal cual).
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import type { CodigoValidador } from "@/ia/validador/codigos";
import { coincidencias, type Patron, type PatronMarca } from "@/ia/validador/patron";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_MARCA } from "@/ia/validador/patrones-lengua";
import { PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { validarSalida } from "@/ia/validador/validar";
import { paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

/** Ejemplo de cada patrón, por id. El inventario es la lista de estas claves, en el orden de `src/`. */
const EJEMPLOS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  RECOMENDACION: {
    "RECOMENDACION.COMPRE": "compre", "RECOMENDACION.VENDA": "venda", "RECOMENDACION.COMPRAR_VENDER": "es para vender",
    "RECOMENDACION.COMPRA_VENTA": "la venta", "RECOMENDACION.MANTENGA": "mantenga", "RECOMENDACION.RECOMENDAR": "recomiendo",
    "RECOMENDACION.SUGERIR": "sugiero", "RECOMENDACION.ACONSEJAR": "aconsejo", "RECOMENDACION.DEBER": "debería",
    "RECOMENDACION.CONVENIR": "conviene", "RECOMENDACION.OBLIGACION": "hay que", "RECOMENDACION.MOMENTO": "buen momento",
    "RECOMENDACION.OPORTUNIDAD": "oportunidad", "RECOMENDACION.APROVECHAR": "aproveche", "RECOMENDACION.TOMAR_GANANCIAS": "tome utilidades",
    "RECOMENDACION.AJUSTAR": "reduzca", "RECOMENDACION.REBALANCEAR": "rebalancee", "RECOMENDACION.DIVERSIFICAR": "diversifique",
    "RECOMENDACION.INVERTIR": "invierta", "RECOMENDACION.SALIR": "liquide", "RECOMENDACION.OBJETIVO": "precio objetivo",
    "RECOMENDACION.SENAL": "señal", "RECOMENDACION.PONDERAR": "sobreponderar", "RECOMENDACION.VALORACION": "barata",
    "RECOMENDACION.CONSEJO": "considere", "RECOMENDACION.ORDEN": "stop loss",
  },
  PREDICCION: {
    "PREDICCION.FUTURO_SIMPLE": "repuntará", "PREDICCION.FUTURO_SIN_TILDE": "subira", "PREDICCION.IR_A": "va a subir",
    "PREDICCION.ESPERAR": "se espera", "PREDICCION.PREVER": "se prevé", "PREDICCION.PRONOSTICO": "pronóstico",
    "PREDICCION.GARANTIA": "garantiza", "PREDICCION.SIN_RIESGO": "sin riesgo", "PREDICCION.CERTEZA": "sin duda",
    "PREDICCION.PROBABLE": "probablemente", "PREDICCION.TENDENCIA": "alcista", "PREDICCION.FUTURO_TIEMPO": "próximamente",
  },
  TRATO: {
    "TRATO.TU": "tu", "TRATO.TE": "contigo", "TRATO.VOSOTROS": "vosotros", "TRATO.VOS": "vos", "TRATO.VOSEO_VERBO": "tenés",
    "TRATO.TU_VERBO": "tienes",
  },
  CIFRA_EN_PALABRAS: {
    "CIFRA_EN_PALABRAS.UNIDADES": "tres", "CIFRA_EN_PALABRAS.DECENAS": "quince", "CIFRA_EN_PALABRAS.CENTENAS": "doscientos",
    "CIFRA_EN_PALABRAS.MILES": "millones", "CIFRA_EN_PALABRAS.ORDINALES": "segundo", "CIFRA_EN_PALABRAS.FRACCIONES": "mitad",
    "CIFRA_EN_PALABRAS.COLECTIVOS": "docena", "CIFRA_EN_PALABRAS.PORCIENTO": "porciento", "CIFRA_EN_PALABRAS.MESES": "marzo",
    "CIFRA_EN_PALABRAS.DIAS_SEMANA": "lunes", "CIFRA_EN_PALABRAS.DIAS_RELATIVOS": "ayer", "CIFRA_EN_PALABRAS.APROXIMADOR": "casi {H01}",
  },
  IDIOMA: {
    "IDIOMA.INGLES": "the", "IDIOMA.PORTUGUES": "também", "IDIOMA.FRANCES": "avec", "IDIOMA.ITALIANO": "della",
  },
  MARCA: {
    "DIRECCION.SUBE_VERBO": "subió", "DIRECCION.SUBE_SUSTANTIVO": "alza", "DIRECCION.BAJA_VERBO": "bajó",
    "DIRECCION.BAJA_SUSTANTIVO": "descenso", "DIRECCION.IGUAL": "se mantuvo", "CERCANIA.CERCA": "cerca",
    "CERCANIA.LEJOS": "lejos", "FRESCURA.HOY": "hoy",
  },
};

const LISTAS: Readonly<Record<string, { readonly patrones: readonly Patron[]; readonly codigo: CodigoValidador }>> = {
  RECOMENDACION: { patrones: PATRONES_RECOMENDACION, codigo: "RECOMENDACION" },
  PREDICCION: { patrones: PATRONES_PREDICCION, codigo: "PREDICCION" },
  TRATO: { patrones: PATRONES_TRATO, codigo: "TRATO" },
  CIFRA_EN_PALABRAS: { patrones: PATRONES_CIFRA_EN_PALABRAS, codigo: "CIFRA_EN_PALABRAS" },
  IDIOMA: { patrones: PATRONES_IDIOMA, codigo: "IDIOMA" },
  MARCA: { patrones: PATRONES_MARCA, codigo: "DIRECCION_CONTRADICE" },
};

const TODOS: readonly Patron[] = Object.values(LISTAS).flatMap((l) => l.patrones);
const CASOS = Object.entries(EJEMPLOS).flatMap(([lista, ejemplos]) => Object.entries(ejemplos).map(([id, ejemplo]) => ({ lista, id, ejemplo })));

describe("inventario", () => {
  it.each(Object.keys(LISTAS))("%s: los ids de src son exactamente los del inventario, en orden y sin dígitos", (lista) => {
    const ids = (LISTAS[lista]?.patrones ?? []).map((p) => p.id);
    expect(ids).toEqual(Object.keys(EJEMPLOS[lista] ?? {}));
    for (const id of ids) expect(id).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
  });

  it("cada patrón está congelado, sin las banderas g ni y (no guardan estado) y con la bandera u", () => {
    expect(TODOS.length).toBeGreaterThan(0);
    for (const p of TODOS) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(p.patron.flags).not.toMatch(/[gy]/);
      expect(p.patron.flags).toContain("u");
    }
    for (const lista of Object.values(LISTAS)) expect(Object.isFrozen(lista.patrones)).toBe(true);
  });
});

describe.each(CASOS)("$id", ({ lista, id, ejemplo }) => {
  const patrones = LISTAS[lista]?.patrones ?? [];

  it("su ejemplo lo detecta solo ese patrón, entre todas las listas", () => {
    expect(coincidencias(ejemplo, TODOS)).toEqual([id]);
  });

  it("mutación: la lista sin ese patrón ya no detecta su ejemplo", () => {
    const mutada = patrones.filter((p) => p.id !== id);
    expect(mutada).toHaveLength(patrones.length - 1);
    expect(coincidencias(ejemplo, mutada)).toEqual([]);
  });

  it("cableado: validarSalida rechaza el ejemplo con el código de su lista", () => {
    const paquete = paqueteFicticio("DIARIO");
    const marca = (patrones as readonly PatronMarca[]).find((p) => p.id === id)?.marca;
    // Una palabra de bajada contradice a un hecho que sube; las demás marcas, a la ganancia total (que baja, sin cercanía y no es de hoy).
    const plantilla = lista !== "MARCA"
      ? `El valor de las acciones subió a {VALOR_ACCIONES}, ${ejemplo}.`
      : marca?.campo === "direccion" && marca.valor === "BAJA"
        ? `El valor de las acciones, ${ejemplo}, es {VALOR_ACCIONES}.`
        : `El valor de las acciones subió a {VALOR_ACCIONES} y la ganancia total, ${ejemplo}, es {GANANCIA_TOTAL}.`;
    const resultado = validarSalida(salidaDe(paquete, plantilla), paquete);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain(LISTAS[lista]?.codigo);
    expect(resultado.hallazgos.map((h) => h.patron)).toContain(id);
  });
});

describe("las etiquetas del catálogo no disparan ningún patrón", () => {
  it.each(TIPOS_RESUMEN)("%s", (tipo) => {
    for (const entrada of Object.values(CATALOGO[tipo])) {
      expect([entrada.etiqueta, coincidencias(entrada.etiqueta, TODOS)]).toEqual([entrada.etiqueta, []]);
    }
  });
});
