/**
 * Capa 5 del candado contra comprar, vender o mantener (DISENO-HECHOS-V2 §5, condición C3 de PI), por el CAMINO COMPLETO:
 * un generador falso que responde lo que se le configure, `generarConPuertas` (la guarda de la vista ciega, las puertas) y
 * `validarSalida`. Lo que escribe un modelo malo (la atribución del cambio a una acción, «venda», «mantenga», «buen
 * momento», «atención», o las evasiones «Si usted cierra…») tiene que dar RECHAZADO. Lleva su control positivo: la salida
 * buena publica por el mismo camino. La mutación sin ATRIBUCION está en `capa5-sin-atribucion.candado.test.ts`.
 * Corre en `npm run test:candados-ia` y, dentro de `npm test`, en el job `app-008` que exige `inv-gate`.
 */
import { describe, expect, it } from "vitest";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { armarPedido } from "@/ia/generador";
import { construirPaquete } from "@/ia/paquete";
import { ESQUEMA_SALIDA_V3 } from "@/ia/prompts/esquema";
import { PROMPTS } from "@/ia/prompts/prompts";
import { generarConPuertas } from "@/ia/puertas";
import { segmentosDe } from "@/ia/validador/segmentos";
import { validarSalida } from "@/ia/validador/validar";
import { entradaSimulacion } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const RESTO = [
  "La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.",
  "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.",
  "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, elevada.",
];
const BUENA = "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.";
const salidaCon = (primera: string): string =>
  JSON.stringify({ frases: [primera, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] });

/** El camino completo: el generador falso responde; las puertas lo entregan; el validador decide. */
async function porElCaminoCompleto(salidaCruda: string) {
  const pedido = armarPedido({ paquete, prompt: PROMPTS.SIMULACION, esquemaSalida: ESQUEMA_SALIDA_V3, limiteMs: 60_000 });
  const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda } });
  const resultado = await generarConPuertas([falso], "local", pedido, paquete);
  expect(resultado.estado, "las puertas entregan lo que el generador falso dijo").toBe("EXITO");
  if (resultado.estado !== "EXITO") throw new Error("sin éxito");
  expect(falso.llamadas()).toHaveLength(1);
  return validarSalida(resultado.exito.salidaCruda, paquete);
}

const N = "{ESPECIE_NOMBRE}";
const P = "{PESO_ESPECIE}";
/**
 * [caso, frase mala con la MISMA estructura de la buena, los códigos que tienen que salir]. Cada caso afirma su código
 * (no solo «no publica»): si la defensa que lo atrapaba deja de hacerlo, el caso da rojo aunque otra defensa lo rechace.
 */
const CASOS_RECHAZADOS: readonly (readonly [string, string, readonly string[]])[] = [
  // los de C2 de PI: nunca atribuir el cambio a una acción
  ["C2 · al aumentar la posición", `Al aumentar la posición, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["C2 · al reducir la posición", `Al reducir la posición, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["C2 · si compra", `Si compra, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "RECOMENDACION", "IDIOMA"]],
  ["C2 · tras la venta", `Tras la venta, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "RECOMENDACION", "IDIOMA"]],
  ["C2 · al sumar más", `Al sumar más, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["C2 · recortar", `Para recortar, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  // el consejo y el momento
  ["venda", `Venda: el peso de la especie ${N} queda en ${P}, muy elevado.`, ["RECOMENDACION", "ATRIBUCION", "IDIOMA"]],
  ["mantenga", `Mantenga el peso de la especie ${N} en ${P}, muy elevado.`, ["RECOMENDACION", "IDIOMA"]],
  ["buen momento", `Es un buen momento: el peso de la especie ${N} queda en ${P}, muy elevado.`, ["RECOMENDACION", "IDIOMA"]],
  // la operación como agente
  ["con la operación", `Con la operación, el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["esta orden deja", `Esta orden deja el peso de la especie ${N} en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  // comparar con el antes
  ["antes era", `Antes era menor: el peso de la especie ${N} queda en ${P}, muy elevado.`, ["ATRIBUCION", "IDIOMA", "DIRECCION_CONTRADICE"]],
  // llamar la atención
  ["atención", `Atención: el peso de la especie ${N} queda en ${P}, muy elevado.`, ["RECOMENDACION", "IDIOMA"]],
  ["fíjese", `Fíjese: el peso de la especie ${N} queda en ${P}, muy elevado.`, ["RECOMENDACION", "IDIOMA"]],
  // las evasiones con palabras que PALABRAS_BASE permitía (ALTO-3): el vocabulario explícito de SIMULACION las cierra
  ["Si usted cierra", `Si usted cierra ${P}, el peso de la especie ${N} queda muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["Usted paga", `Usted paga ${P}, y el peso de la especie ${N} queda muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
  ["Con el cierre de", `Con el cierre de ${P}, el peso de la especie ${N} queda muy elevado.`, ["ATRIBUCION", "IDIOMA"]],
];

describe("capa 5 · el camino completo (generador falso → generarConPuertas → validarSalida)", () => {
  it("control positivo: la salida buena PUBLICA por el mismo camino", async () => {
    const r = await porElCaminoCompleto(salidaCon(BUENA));
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it.each(CASOS_RECHAZADOS)("RECHAZADO: %s, con sus códigos", async (_caso, plantilla, esperados) => {
    const r = await porElCaminoCompleto(salidaCon(plantilla));
    expect(r.ok, "debía rechazarse").toBe(false);
    if (r.ok) return;
    for (const codigo of esperados) expect(r.motivos, `${plantilla} → ${r.motivos.join(",")}`).toContain(codigo);
  });

  it("la misma frase mala como ítem de «Para revisar» también se rechaza", async () => {
    for (const [, plantilla] of CASOS_RECHAZADOS.slice(0, 6)) {
      const conItem = JSON.stringify({
        frases: [BUENA, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })),
        revisar: [{ segmentos: segmentosDe(frase(paquete, plantilla.replace(", muy elevado", "")).texto) }],
      });
      expect((await porElCaminoCompleto(conItem)).ok, plantilla).toBe(false);
    }
  });
});
