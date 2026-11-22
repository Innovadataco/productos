/**
 * Plantilla sin IA (nivel 0): un texto determinista por tipo, armado solo con el paquete (las etiquetas del catálogo y
 * las citas de los hechos obligatorios, con el nombre de su especie), en el mismo formato que la salida de un modelo.
 * Prueba obligatoria: pasa el MISMO validador, también con paquetes al azar con semilla, dentro de los límites.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_RESUMEN, type Hecho, type IdHecho, type PaqueteHechos } from "@/ia/contrato";
import { LIMITES_SALIDA } from "@/ia/validador/codigos";
import { leerSalida } from "@/ia/validador/leer";
import { resumenSinIa, salidaDePlantilla } from "@/ia/validador/plantilla";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { paqueteFicticio } from "./apoyo/salidas.ficticio";

/** El nombre de la especie al final de la cadena de sujetos (o nada). */
function raiz(hecho: Hecho, paquete: PaqueteHechos): IdHecho | undefined {
  let actual: Hecho | undefined = hecho;
  for (let i = 0; i < paquete.hechos.length && actual?.sujeto !== undefined; i += 1) {
    const sujeto: IdHecho = actual.sujeto;
    actual = paquete.hechos.find((h) => h.id === sujeto);
  }
  return actual !== hecho && actual?.unidad === "NOMBRE" ? actual.id : undefined;
}

function revisar(paquete: PaqueteHechos): void {
  const resultado = resumenSinIa(paquete);
  expect(resultado.ok, resultado.ok ? "" : resultado.motivos.join(",")).toBe(true);
  if (!resultado.ok) return;
  const { frases, citados, texto } = resultado.resumen;
  expect(frases.length).toBeGreaterThanOrEqual(LIMITES_SALIDA.minFrases);
  expect(frases.length).toBeLessThanOrEqual(LIMITES_SALIDA.maxFrases);
  for (const f of frases) expect([...f.texto].length).toBeLessThanOrEqual(LIMITES_SALIDA.maxLargoFrase);
  expect(frases.reduce((s, f) => s + [...f.texto].length, 0)).toBeLessThanOrEqual(LIMITES_SALIDA.maxLargoTotal);
  const obligatorios = paquete.hechos.filter((h) => h.obligatorio);
  for (const h of obligatorios) expect(citados).toContain(h.id);
  // Solo los obligatorios y el nombre de su especie (o, si no hay ninguno, el primer hecho que no es un nombre).
  const noNombres = paquete.hechos.filter((h) => h.unidad !== "NOMBRE");
  const base = obligatorios.some((h) => h.unidad !== "NOMBRE") || noNombres.length === 0 ? obligatorios : [...obligatorios, noNombres[0] as Hecho];
  const permitidos = new Set(base.flatMap((h) => [h.id, raiz(h, paquete)]).filter((x): x is IdHecho => x !== undefined));
  if (base.length === 0) for (const h of paquete.hechos.slice(0, 1)) permitidos.add(h.id);
  for (const id of citados) expect(permitidos.has(id)).toBe(true);
  expect(texto).toBe(frases.map((f) => f.texto).join(" "));
}

describe("plantilla sin IA", () => {
  it.each(TIPOS_RESUMEN)("%s: la entrada ficticia pasa el validador", (tipo) => {
    revisar(paqueteFicticio(tipo));
  });

  it("sale en el formato de la salida de un modelo y pasa por validarSalida tal cual", () => {
    const paquete = paqueteFicticio("DIARIO");
    const cruda = salidaDePlantilla(paquete);
    expect(leerSalida(cruda)).not.toBeNull();
    expect(validarSalida(cruda, paquete)).toEqual(resumenSinIa(paquete));
  });

  it("es determinista y no lleva dígitos fuera de las citas", () => {
    for (const tipo of TIPOS_RESUMEN) {
      const paquete = paqueteFicticio(tipo);
      expect(salidaDePlantilla(paquete)).toBe(salidaDePlantilla(paquete));
      const textos = (leerSalida(salidaDePlantilla(paquete))?.frases ?? []).map((f) => f.texto).join(" ");
      expect(textos.replace(/\{H[0-9]{2}\}/g, "")).not.toMatch(/\p{N}/u);
    }
  });

  it("sin obligatorios, cita el primer hecho que no es un nombre (con su especie)", () => {
    const paquete = paqueteFicticio("ESCENARIOS");
    expect(paquete.hechos.some((h) => h.obligatorio)).toBe(false);
    const r = resumenSinIa(paquete);
    expect(r.ok && r.resumen.citados).toEqual([paquete.hechos[0]?.id]);
  });

  it("con todos los hechos obligatorios de la entrada ficticia, los cita a todos", () => {
    for (const tipo of TIPOS_RESUMEN) {
      const paquete = paqueteFicticio(tipo, Object.fromEntries(paqueteFicticio(tipo).hechos.map((h) => [h.clave, { obligatorio: true }])));
      revisar(paquete);
    }
  });

  it.each(TIPOS_RESUMEN)("%s: paquetes al azar con semilla pasan el mismo validador", (tipo) => {
    const prng = crearPrng(41_377);
    for (let i = 0; i < 300; i += 1) revisar(paqueteAlAzar(prng, tipo));
  });
});
