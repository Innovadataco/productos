/**
 * Inyección de cifras al azar, con semilla: sobre salidas que pasan (la plantilla de paquetes al azar, control
 * positivo), se mete una cifra en una frase al azar y en una posición al azar. Siempre se rechaza:
 * - dígitos ASCII, con separadores es-CO o de otros sistemas de numeración: CIFRA_SUELTA (y RENDER_CIFRA);
 * - la presentación EXACTA de un hecho del paquete, escrita por el modelo: CIFRA_SUELTA y RENDER_CIFRA (condición 2);
 * - una cifra en palabras entre dos palabras: CIFRA_EN_PALABRAS;
 * - un signo pegado a una cita: rechazo (FORMATO).
 */
import { describe, expect, it } from "vitest";
import { TIPOS_RESUMEN, type PaqueteHechos } from "@/ia/contrato";
import { resumenSinIa, salidaDePlantilla } from "@/ia/validador/plantilla";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng, type Prng } from "@/proyecciones/prng";
import { elegir, paqueteAlAzar } from "../apoyo/aleatorio.ficticio";

interface FraseCruda { readonly hechos: readonly string[]; readonly texto: string }

const SISTEMAS = ["0123456789", "٠١٢٣٤٥٦٧٨٩", "０１２３４５６７８９", "०१२३४५६७८९", "⁰¹²³⁴⁵⁶⁷⁸⁹", "₀₁₂₃₄₅₆₇₈₉"] as const;
const SUELTOS = ["½", "Ⅳ", "③", "¾", "ↁ"] as const;
const EN_PALABRAS = ["tres", "quince", "doscientos", "mil", "millones", "mitad", "docena", "porciento", "marzo", "lunes", "ayer", "segundo", "cero", "noventa"] as const;
const SIGNOS = ["−", "-", "+", "±"] as const;

function cifraAlAzar(prng: Prng): string {
  if (prng.uniforme() < 0.2) return elegir(prng, SUELTOS);
  const sistema = [...elegir(prng, SISTEMAS)];
  const largo = 1 + prng.enteroMenorQue(7);
  const digitos = Array.from({ length: largo }, (_, i) => elegir(prng, i === 0 ? sistema.slice(1) : sistema)).join("");
  const separador = prng.uniforme() < 0.5 ? "" : elegir(prng, [".", ","]);
  return separador === "" || largo < 2 ? digitos : `${digitos.slice(0, 1)}${separador}${digitos.slice(1)}`;
}

const frasesDe = (cruda: string): FraseCruda[] => (JSON.parse(cruda) as { frases: FraseCruda[] }).frases;
const conFrases = (frases: readonly FraseCruda[]): string => JSON.stringify({ frases });

function insertar(frases: readonly FraseCruda[], prng: Prng, armar: (texto: string) => string): string {
  const i = prng.enteroMenorQue(frases.length);
  return conFrases(frases.map((f, j) => (j === i ? { ...f, texto: armar(f.texto) } : f)));
}

const enPosicion = (prng: Prng, insertado: string) => (texto: string): string => {
  const pos = prng.enteroMenorQue(texto.length + 1);
  return `${texto.slice(0, pos)}${insertado}${texto.slice(pos)}`;
};

const entrePalabras = (prng: Prng, palabra: string) => (texto: string): string => {
  const espacios = [...texto.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (espacios.length === 0) return `${palabra} ${texto}`;
  const pos = elegir(prng, espacios);
  return `${texto.slice(0, pos)} ${palabra}${texto.slice(pos)}`;
};

function motivos(cruda: string, paquete: PaqueteHechos): readonly string[] {
  const r = validarSalida(cruda, paquete);
  return r.ok ? [] : r.motivos;
}

describe.each(TIPOS_RESUMEN)("inyección de cifras · %s", (tipo) => {
  const prng = crearPrng(17_389 + TIPOS_RESUMEN.indexOf(tipo));
  const paquetes = Array.from({ length: 113 }, () => paqueteAlAzar(prng, tipo));

  it("control positivo: la plantilla de cada paquete pasa", () => {
    for (const paquete of paquetes) expect(resumenSinIa(paquete).ok).toBe(true);
  });

  it("dígitos de cualquier sistema, en cualquier posición: siempre CIFRA_SUELTA", () => {
    for (const paquete of paquetes) {
      for (let k = 0; k < 4; k += 1) {
        const cruda = insertar(frasesDe(salidaDePlantilla(paquete)), prng, enPosicion(prng, cifraAlAzar(prng)));
        expect(motivos(cruda, paquete)).toContain("CIFRA_SUELTA");
      }
    }
  });

  it("la presentación exacta de un hecho, escrita por el modelo: CIFRA_SUELTA y RENDER_CIFRA", () => {
    let probados = 0;
    for (const paquete of paquetes) {
      const conCifra = paquete.hechos.filter((h) => h.unidad !== "NOMBRE");
      if (conCifra.length === 0) continue;
      probados += 1;
      const presentacion = elegir(prng, conCifra).presentacion;
      const cruda = insertar(frasesDe(salidaDePlantilla(paquete)), prng, entrePalabras(prng, presentacion));
      expect(motivos(cruda, paquete)).toEqual(expect.arrayContaining(["CIFRA_SUELTA", "RENDER_CIFRA"]));
    }
    expect(probados).toBeGreaterThan(paquetes.length / 2);
  });

  it("una cifra en palabras entre dos palabras: siempre CIFRA_EN_PALABRAS", () => {
    for (const paquete of paquetes) {
      const cruda = insertar(frasesDe(salidaDePlantilla(paquete)), prng, entrePalabras(prng, elegir(prng, EN_PALABRAS)));
      expect(motivos(cruda, paquete)).toContain("CIFRA_EN_PALABRAS");
    }
  });

  it("un signo pegado a una cita: FORMATO (cita pegada) y RENDER_CIFRA (el signo cambia la cifra)", () => {
    for (const paquete of paquetes) {
      const signo = elegir(prng, SIGNOS);
      const cruda = insertar(frasesDe(salidaDePlantilla(paquete)), prng, (texto) => texto.replace(/\{H[0-9]{2}\}/u, (cita) => `${signo}${cita}`));
      expect(motivos(cruda, paquete)).toEqual(expect.arrayContaining(["FORMATO", "RENDER_CIFRA"]));
    }
  });
});
