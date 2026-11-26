/**
 * Plantilla sin IA (nivel 0): un texto determinista por tipo, armado solo con el paquete (las etiquetas del catálogo y
 * las citas de los hechos obligatorios, con el nombre de su especie), en el mismo formato que la salida de un modelo.
 * Prueba obligatoria: pasa el MISMO validador, también con paquetes al azar con semilla, dentro de los límites.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS, type Hecho, type IdHecho, type PaqueteHechos } from "@/ia/contrato";
import { ErrorValidador, LIMITES_SALIDA } from "@/ia/validador/codigos";
import { construirPaquete } from "@/ia/paquete";
import { leerSalida } from "@/ia/validador/leer";
import { resumenSinIa, salidaDePlantilla } from "@/ia/validador/plantilla";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { entradaAlAzar, paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { paqueteAlAzarConTope, paqueteFicticio, TOPE_OBLIGATORIOS } from "./apoyo/salidas.ficticio";

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
  // Sin ningún dato que no sea un nombre no hay frase que citar: la plantilla se rechaza (cierra en fallo).
  if (paquete.hechos.every((h) => h.unidad === "NOMBRE")) {
    expect(resultado.ok).toBe(false);
    return;
  }
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
  for (const id of citados) expect(permitidos.has(id)).toBe(true);
  expect(texto).toBe(frases.map((f) => f.texto).join(" "));
}

describe("plantilla sin IA", () => {
  it.each(TIPOS_DIARIOS)("%s: la entrada ficticia pasa el validador", (tipo) => {
    revisar(paqueteFicticio(tipo));
  });

  it("sale en el formato de la salida de un modelo y pasa por validarSalida tal cual", () => {
    const paquete = paqueteFicticio("DIARIO");
    const cruda = salidaDePlantilla(paquete);
    expect(leerSalida(cruda)).not.toBeNull();
    expect(validarSalida(cruda, paquete)).toEqual(resumenSinIa(paquete));
  });

  it("los nombres obligatorios sueltos van en una frase que cita un dato, nunca solos", () => {
    const prng = crearPrng(29_573);
    let conSueltos = 0;
    for (let i = 0; i < 307; i += 1) {
      const paquete = paqueteAlAzarConTope(prng, "DIARIO");
      const conSujeto = new Set(paquete.hechos.filter((h) => h.obligatorio && h.unidad !== "NOMBRE").map((h) => h.sujeto));
      if (!paquete.hechos.some((h) => h.unidad === "NOMBRE" && h.obligatorio && !conSujeto.has(h.id))) continue;
      conSueltos += 1;
      revisar(paquete);
    }
    expect(conSueltos).toBeGreaterThan(0);
  });

  it("un paquete con solo nombres de especie no tiene plantilla válida", () => {
    const prng = crearPrng(31_337);
    let soloNombres = 0;
    for (let i = 0; i < 2_311 && soloNombres === 0; i += 1) {
      const paquete = paqueteAlAzar(prng);
      if (!paquete.hechos.every((h) => h.unidad === "NOMBRE")) continue;
      soloNombres += 1;
      expect(resumenSinIa(paquete).ok).toBe(false);
    }
    expect(soloNombres).toBeGreaterThan(0);
  });

  it("es determinista y no lleva dígitos fuera de las citas", () => {
    for (const tipo of TIPOS_DIARIOS) {
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
    for (const tipo of TIPOS_DIARIOS) {
      const paquete = paqueteFicticio(tipo, Object.fromEntries(paqueteFicticio(tipo).hechos.map((h) => [h.clave, { obligatorio: true }])));
      revisar(paquete);
    }
  });

  it("con un paquete que no salió de construirPaquete lanza ErrorValidador", () => {
    expect(() => salidaDePlantilla({ ...paqueteFicticio("DIARIO") })).toThrow(ErrorValidador);
  });

  it("si los obligatorios no caben, la plantilla no pasa los límites y el validador la rechaza con exactamente esos códigos", () => {
    const prng = crearPrng(4_613);
    const rechazos = new Map<string, number>();
    for (let i = 0; i < 113; i += 1) {
      const entrada = entradaAlAzar(prng, "DIARIO");
      const paquete = construirPaquete({ ...entrada, hechos: entrada.hechos.map((h) => ({ ...h, obligatorio: true })) });
      const frases = leerSalida(salidaDePlantilla(paquete))?.frases ?? [];
      expect(frases.length).toBeLessThanOrEqual(LIMITES_SALIDA.maxFrases);
      const resultado = resumenSinIa(paquete);
      if (resultado.ok) continue;
      // Lo que la plantilla no alcanzó a citar, el código lo escribe en otras frases (T4): el conjunto pasa de los límites.
      const patrones = resultado.hallazgos.map((h) => h.patron).sort().join("|");
      rechazos.set(patrones, (rechazos.get(patrones) ?? 0) + 1);
    }
    // Con la semilla fija: 13 pasan solo el total de caracteres y 17 pasan también el máximo de frases. Ninguna otra salida.
    expect(Object.fromEntries(rechazos)).toEqual({ "LONGITUD.TOTAL": 13, "LONGITUD.FRASES|LONGITUD.TOTAL": 17 });
  });

  it.each(TIPOS_DIARIOS)("%s: paquetes al azar con semilla (con el tope de obligatorios) pasan el mismo validador", (tipo) => {
    const prng = crearPrng(41_377);
    let conObligatorios = 0;
    for (let i = 0; i < 307; i += 1) {
      const paquete = paqueteAlAzarConTope(prng, tipo);
      const obligatorios = paquete.hechos.filter((h) => h.obligatorio).length;
      expect(obligatorios).toBeLessThanOrEqual(TOPE_OBLIGATORIOS);
      if (obligatorios === TOPE_OBLIGATORIOS) conObligatorios += 1;
      revisar(paquete);
    }
    expect(conObligatorios).toBeGreaterThan(0);
  });
});
