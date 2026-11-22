/**
 * Propiedad de la vista ciega con paquetes AL AZAR (PRNG con semilla, reproducible): valores decimales con signo,
 * fechas, especies FICTICIA-*, fuentes, avisos y versiones de cálculo inventadas, y presentaciones es-CO. En cada
 * paquete, el JSON de la vista no tiene ningún dígito fuera de los ids, ni un valor, una presentación, un nombre, una
 * fuente o una fecha del paquete, ni una clave prohibida; y la guarda lo acepta. La propiedad no pasa en vacío: las
 * corridas cubren todas las claves del catálogo y hechos con sujeto.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { clavesProhibidasEn } from "@/ia/prohibidas";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "./apoyo/aleatorio.ficticio";
import { camposDeMas, fugasEn, hayDigitosFueraDeIds } from "./apoyo/detectores";

const SEMILLA = 37_911;
const CORRIDAS = 300;

describe("vista ciega · propiedad con paquetes al azar", () => {
  it(`en ${CORRIDAS} paquetes (semilla ${SEMILLA}) la vista no filtra nada y la guarda la acepta`, () => {
    const prng = crearPrng(SEMILLA);
    const vistas = new Map<string, Set<string>>(TIPOS_RESUMEN.map((t) => [t, new Set<string>()]));
    let conSujeto = 0;
    let hechos = 0;
    for (let i = 0; i < CORRIDAS; i += 1) {
      const paquete = paqueteAlAzar(prng, TIPOS_RESUMEN[i % TIPOS_RESUMEN.length]);
      const vista = vistaCiega(paquete);
      const json = JSON.stringify(vista);
      expect(hayDigitosFueraDeIds(json), `corrida ${i}`).toBe(false);
      expect(fugasEn(json, paquete), `corrida ${i}`).toEqual([]);
      expect(json.toLowerCase()).not.toContain("ficticia");
      expect(clavesProhibidasEn(vista)).toEqual([]);
      expect(clavesProhibidasEn(paquete)).toEqual([]);
      expect(camposDeMas(vista)).toEqual([]);
      expect(fugasDeVistaCiega(vista, paquete)).toEqual([]);
      for (const h of paquete.hechos) {
        vistas.get(paquete.tipo)?.add(h.clave);
        if (h.sujeto !== undefined) conSujeto += 1;
        hechos += 1;
      }
    }
    for (const tipo of TIPOS_RESUMEN) expect([...(vistas.get(tipo) ?? [])].sort(), tipo).toEqual(Object.keys(CATALOGO[tipo]).sort());
    expect(conSujeto).toBeGreaterThan(CORRIDAS);
    expect(hechos).toBeGreaterThan(CORRIDAS * 10);
  });

  it("la misma semilla da los mismos paquetes (reproducible)", () => {
    const a = crearPrng(SEMILLA);
    const b = crearPrng(SEMILLA);
    for (let i = 0; i < 20; i += 1) expect(paqueteAlAzar(a).hash).toBe(paqueteAlAzar(b).hash);
  });
});
