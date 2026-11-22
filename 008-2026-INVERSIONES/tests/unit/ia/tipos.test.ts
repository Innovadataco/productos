/**
 * Hallazgos de la revisión de tipos. Las aserciones de tipo las verifica `npm run typecheck` (`@ts-expect-error` que
 * sobra es un error de compilación); las de ejecución, `npm test`.
 * - TIPOS-ALTO-1: el paquete completo (y un hecho completo) no es asignable a la vista ciega.
 * - TIPOS-MEDIO-8: `PaqueteDeAlgunTipo` estrecha las claves por `tipo`.
 * - TIPOS-BAJO-10: `IdHecho` sin H00, `esIdHecho` y `politicaSujeto` en el catálogo.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { CATALOGO, type ClaveDiario, type ClaveReglas } from "@/ia/catalogo";
import { PATRON_ID_HECHO, esIdHecho, type HechoCiego, type IdHecho, type PaqueteCiego, type PaqueteDeAlgunTipo } from "@/ia/contrato";
import type { PedidoGeneracion } from "@/ia/generador";
import { construirPaquete } from "@/ia/paquete";
import { vistaCiega } from "@/ia/vista-ciega";
import { entradaDiario, entradaReglas } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

describe("TIPOS-ALTO-1 · el paquete completo no pasa por vista ciega al compilar", () => {
  it("ni el paquete, ni un hecho, ni un pedido con el paquete en la vista compilan como ciegos", () => {
    const paquete = construirPaquete(entradaDiario());
    // @ts-expect-error: un PaqueteHechos (con valores y presentaciones) no es un PaqueteCiego
    const vista: PaqueteCiego = paquete;
    // @ts-expect-error: un Hecho completo no es un HechoCiego
    const hecho: HechoCiego = paquete.hechos[0] as (typeof paquete.hechos)[number];
    const prompt = { ...PROMPT_FICTICIO, hash: "" };
    // @ts-expect-error: un pedido no puede llevar el paquete completo como vista
    const pedido: PedidoGeneracion = { vista: paquete, prompt, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS };
    expect([vista, hecho, pedido].every((x) => x !== undefined)).toBe(true);
    const ciega: PaqueteCiego = vistaCiega(paquete);
    expect(ciega.hechos).toHaveLength(paquete.hechos.length);
  });
});

describe("TIPOS-MEDIO-8 · PaqueteDeAlgunTipo estrecha por tipo", () => {
  it("al comprobar el tipo, las claves quedan las de ese tipo", () => {
    const paquetes: readonly PaqueteDeAlgunTipo[] = [construirPaquete(entradaDiario()), construirPaquete(entradaReglas())];
    for (const p of paquetes) {
      if (p.tipo === "DIARIO") expectTypeOf(p.hechos[0]?.clave).toEqualTypeOf<ClaveDiario | undefined>();
      if (p.tipo === "REGLAS") expectTypeOf(p.hechos[0]?.clave).toEqualTypeOf<ClaveReglas | undefined>();
    }
    expect(paquetes.map((p) => p.tipo)).toEqual(["DIARIO", "REGLAS"]);
  });
});

describe("TIPOS-BAJO-10 · ids sin H00, esIdHecho y politicaSujeto", () => {
  it("H00 no es un id, ni por tipo ni por patrón", () => {
    // @ts-expect-error: H00 no es un IdHecho (los ids van de H01 a H99)
    const cero: IdHecho = "H00";
    expect(cero).toBe("H00");
    expect(PATRON_ID_HECHO.test("H00")).toBe(false);
    expect(PATRON_ID_HECHO.test("H01") && PATRON_ID_HECHO.test("H10") && PATRON_ID_HECHO.test("H99")).toBe(true);
  });

  it("esIdHecho estrecha el texto a IdHecho", () => {
    const texto: string = "H07";
    expect(esIdHecho(texto)).toBe(true);
    if (esIdHecho(texto)) expectTypeOf(texto).toEqualTypeOf<IdHecho>();
    for (const malo of ["H00", "H1", "H100", "h07", "{H07}", ""]) expect(esIdHecho(malo)).toBe(false);
  });

  it("la política de sujeto del catálogo se llama politicaSujeto (no se confunde con Hecho.sujeto)", () => {
    expect(CATALOGO.DIARIO.VALOR_ESPECIE.politicaSujeto).toBe("EXIGIDO");
    expect(CATALOGO.REGLAS.REGLA_PLAZO.politicaSujeto).toBe("OPCIONAL");
    expect(CATALOGO.DIARIO.VALOR_ACCIONES.politicaSujeto).toBe("NINGUNO");
    expect(Object.hasOwn(CATALOGO.DIARIO.VALOR_ESPECIE, "sujeto")).toBe(false);
  });
});
