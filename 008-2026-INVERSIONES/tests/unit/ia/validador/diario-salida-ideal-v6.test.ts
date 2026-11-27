/**
 * Guarda del diseño del DIARIO v6: para los 17 DIARIO inventados, la salida que sigue el prompt al pie de la letra
 * (frase 1 con dos datos no obligatorios y sin especie; frase 2 con un dato de especie en su molde) publica. Si esta
 * prueba falla, se ajusta el molde del prompt, nunca el validador. Control negativo: una etiqueta sin su referencia.
 */
import { describe, expect, it } from "vitest";
import type { ClaveDiario } from "@/ia/catalogo";
import { casosInventados } from "@/ia/evaluacion/casos";
import type { Hecho, PaqueteHechos } from "@/ia/contrato";
import { CLAVES_DE_ESPECIE_DIARIO, moldeDiario } from "@/ia/prompts/moldes-diario";
import { validarSalida } from "@/ia/validador/validar";
import { citasDe, paqueteFicticio, salida, salidaDe, type FraseFicticia } from "./apoyo/salidas.ficticio";

/** Los datos sueltos (ni obligatorios ni de especie) que usan los ejemplos del prompt, con su artículo y su verbo. */
const SUELTOS: readonly { readonly clave: ClaveDiario; readonly articulo: string; readonly etiqueta: string; readonly verbo: string }[] = [
  { clave: "GANANCIA_SIN_VENDER", articulo: "La", etiqueta: "ganancia sin vender", verbo: "es" },
  { clave: "GANANCIA_POR_VENTAS", articulo: "la", etiqueta: "ganancia por ventas", verbo: "es" },
  { clave: "DIVIDENDOS_RECIBIDOS", articulo: "Los", etiqueta: "dividendos recibidos", verbo: "son" },
  { clave: "COMISIONES_PAGADAS", articulo: "las", etiqueta: "comisiones pagadas", verbo: "son" },
  { clave: "ESPECIES_SIN_PRECIO", articulo: "Las", etiqueta: "especies sin precio", verbo: "son" },
  { clave: "ESPECIES_ATRASADAS", articulo: "las", etiqueta: "especies con cierre atrasado", verbo: "son" },
  { clave: "FONDO_VALOR_UNIDAD", articulo: "El", etiqueta: "valor de la unidad del fondo", verbo: "es" },
  { clave: "FONDO_VALOR", articulo: "el", etiqueta: "valor del fondo", verbo: "es" },
];

const hechoDeClave = (p: PaqueteHechos, clave: string): Hecho | undefined => p.hechos.find((h) => h.clave === clave);

/** La frase 1: dos datos sueltos del paquete, «A es {id}, y b es {id}.»; null si el paquete no trae dos. */
function fraseDeDosSueltos(p: PaqueteHechos): FraseFicticia | null {
  const presentes = SUELTOS.filter((s) => hechoDeClave(p, s.clave) !== undefined && hechoDeClave(p, s.clave)?.obligatorio !== true);
  const [a, b] = presentes;
  if (a === undefined || b === undefined) return null;
  const texto = `${a.articulo} ${a.etiqueta} ${a.verbo} {${hechoDeClave(p, a.clave)?.id}}, y ${b.articulo.toLowerCase()} ${b.etiqueta} ${b.verbo} {${hechoDeClave(p, b.clave)?.id}}.`;
  return { texto, hechos: citasDe(texto) };
}

/** La frase 2: el primer dato de especie del paquete en su molde (nombre = su sujeto, dato = su propio id). */
function fraseDeEspecie(p: PaqueteHechos): FraseFicticia | null {
  const dato = p.hechos.find((h) => (CLAVES_DE_ESPECIE_DIARIO as readonly string[]).includes(h.clave) && h.sujeto !== undefined);
  if (dato === undefined || dato.sujeto === undefined) return null;
  const molde = moldeDiario(dato.clave as (typeof CLAVES_DE_ESPECIE_DIARIO)[number]);
  const texto = molde.replace("[nombre]", `{${dato.sujeto}}`).replace("es [dato]", `es {${dato.id}}`);
  return { texto, hechos: citasDe(texto) };
}

const diarios = casosInventados().filter((c) => c.tipo === "DIARIO");

describe("salida ideal del DIARIO v6, en los DIARIO inventados", () => {
  it("son 17 casos", () => {
    expect(diarios).toHaveLength(17);
  });

  it.each(diarios.map((c) => [c.id, c.paquete] as const))("%s: la salida que sigue el prompt publica", (_id, paquete) => {
    const f1 = fraseDeDosSueltos(paquete as PaqueteHechos);
    const f2 = fraseDeEspecie(paquete as PaqueteHechos);
    expect(f1, "frase 1").not.toBeNull();
    expect(f2, "frase 2").not.toBeNull();
    const resultado = validarSalida(salida(f1 as FraseFicticia, f2 as FraseFicticia), paquete as PaqueteHechos);
    expect(resultado.ok, resultado.ok ? "" : JSON.stringify(resultado.hallazgos.map((h) => h.patron))).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.resumen.texto).not.toMatch(/especie de la especie|mism[oa]/iu);
    const despuesDeLaEspecie = [...resultado.resumen.texto.matchAll(/de la especie (.{0,9})/gu)].map((m) => m[1]);
    expect(despuesDeLaEspecie.length).toBeGreaterThan(0);
    for (const siguiente of despuesDeLaEspecie) expect(siguiente?.startsWith("FICTICIA-")).toBe(true);
  });
});

describe("control negativo: la etiqueta sin su referencia se rechaza", () => {
  it("«…, y la ganancia total subió» tras un dato de especie da ETIQUETA.SIN_CITA", () => {
    const p = paqueteFicticio("DIARIO");
    const r = validarSalida(salidaDe(p, "{ESPECIE_NOMBRE}: el valor de la especie es {VALOR_ESPECIE}, y la ganancia total subió."), p);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.hallazgos.map((h) => h.patron)).toContain("ETIQUETA.SIN_CITA");
  });
});
