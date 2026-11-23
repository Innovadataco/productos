/**
 * La vista ciega con `especie` (hechos-v1, cambio aditivo de la vista): cada hecho de una especie lleva, además de su
 * `sujeto`, el id del hecho ESPECIE_NOMBRE ya resuelto (directo, o a través del ancla de su regla). El nombre de la
 * especie y los hechos del portafolio no lo llevan. Sigue sin dígitos fuera de los ids.
 *
 * Control positivo: la vista limpia pasa la guarda y las dos barreras (local y nube); una `especie` plantada (otro id,
 * un nombre, un campo de menos, la clave en otro lugar) se rechaza con su código.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { armarPedido } from "@/ia/generador";
import { barreraLocal } from "@/ia/local/barrera";
import { vistaParaNube } from "@/ia/nube/peticion";
import { construirPaquete, especieDe } from "@/ia/paquete";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { casosInventados } from "@/ia/evaluacion/casos";
import { hayDigitosFueraDeIds } from "./apoyo/detectores";
import { ENTRADAS_FICTICIAS, ESPECIE_ALFA, entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

type Mutable = { tipo: unknown; hechos: Record<string, unknown>[] } & Record<string, unknown>;
const editable = (paquete: PaqueteHechos): Mutable => structuredClone(vistaCiega(paquete)) as unknown as Mutable;

/** La especie que debe llevar cada hecho: la de `especieDe`, salvo en el propio nombre. */
const especieEsperada = (paquete: PaqueteHechos, i: number): string | undefined => {
  const hecho = paquete.hechos[i];
  if (hecho === undefined || hecho.unidad === "NOMBRE") return undefined;
  return especieDe(paquete, hecho.id)?.id;
};

describe("vista ciega · especie resuelta", () => {
  const paquetes: readonly PaqueteHechos[] = [
    ...(Object.keys(ENTRADAS_FICTICIAS) as (keyof typeof ENTRADAS_FICTICIAS)[]).map((t) => construirPaquete(ENTRADAS_FICTICIAS[t]())),
    ...casosInventados().map((c) => c.paquete),
  ];

  it("cada hecho de una especie lleva el id de su nombre; el nombre y el portafolio no lo llevan", () => {
    let conEspecie = 0;
    let deDosSaltos = 0;
    for (const paquete of paquetes) {
      const vista = vistaCiega(paquete);
      vista.hechos.forEach((ciego, i) => {
        const esperada = especieEsperada(paquete, i);
        expect(Object.hasOwn(ciego, "especie"), `${paquete.tipo} ${ciego.id}`).toBe(esperada !== undefined);
        expect(ciego.especie).toBe(esperada);
        if (esperada !== undefined) conEspecie += 1;
        if (esperada !== undefined && ciego.sujeto !== esperada) deDosSaltos += 1;
      });
      expect(hayDigitosFueraDeIds(JSON.stringify(vista))).toBe(false);
    }
    expect(conEspecie).toBeGreaterThan(0);
    expect(deDosSaltos).toBeGreaterThan(0);
  });

  it("control positivo: las vistas con especie pasan la guarda, la barrera local y la de la nube", () => {
    for (const paquete of paquetes) {
      const vista = vistaCiega(paquete);
      expect(fugasDeVistaCiega(vista, paquete)).toEqual([]);
      expect(vistaParaNube(vista)).not.toBeNull();
      const pedido = armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
      expect(barreraLocal(pedido).ok).toBe(true);
    }
  });
});

describe("vista ciega · especie plantada", () => {
  const paquete = construirPaquete(entradaDiario());
  // En la entrada DIARIO ficticia, H01 es el nombre, H02 un dato de esa especie y H03 un dato del portafolio.

  const PLANTADOS: readonly (readonly [string, (v: Mutable) => void, readonly string[]])[] = [
    ["otro id en especie", (v) => { v.hechos[1]!.especie = "H03"; }, ["NO_CORRESPONDE"]],
    ["sin especie en un dato de especie", (v) => { delete v.hechos[1]!.especie; }, ["NO_CORRESPONDE"]],
    ["especie en un dato del portafolio", (v) => { v.hechos[2]!.especie = "H01"; }, ["NO_CORRESPONDE"]],
    ["especie en el propio nombre", (v) => { v.hechos[0]!.especie = "H01"; }, ["NO_CORRESPONDE"]],
    ["el nombre de la especie en especie", (v) => { v.hechos[1]!.especie = ESPECIE_ALFA; }, ["NOMBRE_DE_ESPECIE", "CLAVE_PROHIBIDA", "NO_CORRESPONDE"]],
    ["un texto sin dígitos en especie", (v) => { v.hechos[1]!.especie = "alfa"; }, ["CLAVE_PROHIBIDA", "NO_CORRESPONDE"]],
    ["la clave especie en la raíz", (v) => { v.especie = "H01"; }, ["CAMPO_NO_PERMITIDO", "CLAVE_PROHIBIDA"]],
    ["la clave especie anidada", (v) => { v.hechos[1]!.especie = { id: "H01" }; }, ["CLAVE_PROHIBIDA", "NO_CORRESPONDE"]],
    ["una ruta de texto que imita la de un hecho", (v) => { v["hechos[1].especie"] = "H01"; }, ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "CLAVE_PROHIBIDA"]],
    ["otra clave con la raíz (especies)", (v) => { v.hechos[1]!.especies = "H01"; }, ["CAMPO_NO_PERMITIDO", "CLAVE_PROHIBIDA"]],
    ["especie con mayúscula", (v) => { v.hechos[1]!.Especie = "H01"; }, ["CAMPO_NO_PERMITIDO", "CLAVE_PROHIBIDA"]],
  ];

  it.each(PLANTADOS)("rechaza %s, con sus códigos", (_caso, plantar, codigos) => {
    const vista = editable(paquete);
    plantar(vista);
    const halladas = fugasDeVistaCiega(vista, paquete);
    expect([...halladas].sort()).toEqual([...codigos].sort());
  });

  it("las barreras sin paquete rechazan una especie que no es un id", () => {
    const vista = editable(paquete);
    vista.hechos[1]!.especie = "alfa";
    expect(vistaParaNube(vista)).toBeNull();
    const pedido = armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
    expect(barreraLocal({ ...pedido, vista }).ok).toBe(false);
    const conIndefinida = editable(paquete);
    conIndefinida.hechos[2]!.especie = undefined;
    expect(barreraLocal({ ...pedido, vista: conIndefinida }).ok).toBe(false);
  });
});
