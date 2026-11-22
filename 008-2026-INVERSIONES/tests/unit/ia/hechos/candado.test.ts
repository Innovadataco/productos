/**
 * Candado de los armadores, por CONDUCTA y con control positivo (condición 1 de PI): la acción de una regla, la
 * cantidad, la tenencia, el texto libre de reglas y decisiones, el encargo, las cuentas, el correo, las unidades del
 * fondo, los ids y los textos de los avisos NUNCA entran al paquete. Se pasan las estructuras con su forma real,
 * con esos campos marcados, y se busca cada marca en el JSON canónico del paquete. El control positivo prueba que el
 * mismo detector muerde cuando una marca sí entra, y que el paquete rechaza esos campos si alguien los agrega.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { jsonCanonico } from "@/ia/hash";
import { armarDiario, armarEscenarios, armarReglas, type EntradaArmadoReglas } from "@/ia/hechos";
import { borrador, marcasDeHoy } from "@/ia/hechos/comun";
import { deDecimal } from "@/ia/hechos/decimal";
import { numerarGrupos } from "@/ia/hechos/grupos";
import { construirPaquete } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import { clavesProhibidasEn } from "@/ia/prohibidas";
import { vistaCiega } from "@/ia/vista-ciega";
import { fugasEn, hayDigitosFueraDeIds } from "../apoyo/detectores";
import { ACCION_PLANTADA, BETA, D, HOY, MARCAS, entradaDiarioConPlantados, entradaEscenariosFicticia, entradaReglasFicticia, reglasLeidas } from "./apoyo.ficticio";

const conBigInt = (valor: unknown): string => JSON.stringify(valor, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));

/** Las marcas que aparecen en el texto (sin distinguir mayúsculas). */
const marcasEn = (texto: string): readonly string[] => Object.values(MARCAS).filter((m) => texto.toLowerCase().includes(m.toLowerCase()));

/** ¿Alguno de los campos de texto libre del paquete nombra la acción de la regla? (las claves del catálogo no cuentan). */
function accionEnTextoLibre(paquete: PaqueteHechos): boolean {
  // La etiqueta la pone el catálogo («ganancia sin vender» es un hecho, no una acción): no es texto que llegue de la entrada.
  const libres = [...paquete.hechos.flatMap((h) => [h.valor, h.presentacion, h.fuente]), ...paquete.avisos, ...Object.values(paquete.versionesCalculo)];
  return libres.some((t) => /\b(vender|venda|comprar|compre|no_actuar|mantener)\b/iu.test(t));
}

/** Las decisiones del diario con su texto libre, de más en la entrada (ningún armador las lee). */
const reglasConDecisiones = (): EntradaArmadoReglas =>
  ({ ...entradaReglasFicticia(), decisiones: [{ motivo: MARCAS.motivo, accion: "COMPRAR", cantidad: BigInt(MARCAS.cantidad) }] }) as EntradaArmadoReglas;

const CASOS = [
  ["DIARIO", entradaDiarioConPlantados, (e: unknown) => armarDiario(e as never)],
  ["REGLAS", reglasConDecisiones, (e: unknown) => armarReglas(e as never)],
  ["ESCENARIOS", entradaEscenariosFicticia, (e: unknown) => armarEscenarios(e as never)],
] as const;

describe("candado de los armadores · lo prohibido no entra al paquete", () => {
  it.each(CASOS)("%s: la entrada trae las marcas (si no, la prueba no vigilaría nada)", (_tipo, entrada) => {
    expect(marcasEn(conBigInt(entrada())).length).toBeGreaterThanOrEqual(4);
  });

  it.each(CASOS)("%s: ninguna marca aparece en el JSON canónico del paquete", (_tipo, entrada, armar) => {
    const e = entrada();
    const enLaEntrada = marcasEn(conBigInt(e));
    const paquete = armar(e);
    expect(enLaEntrada.length).toBeGreaterThan(0);
    expect(marcasEn(jsonCanonico(paquete))).toEqual([]);
  });

  it.each(CASOS)("%s: la acción de la regla no aparece en ningún texto libre y no hay claves prohibidas", (_tipo, entrada, armar) => {
    const paquete = armar(entrada());
    expect(accionEnTextoLibre(paquete)).toBe(false);
    expect(clavesProhibidasEn(paquete)).toEqual([]);
  });

  it.each(CASOS)("%s: la vista ciega no lleva valores, presentaciones, nombres, fuentes ni fechas", (_tipo, entrada, armar) => {
    const paquete = armar(entrada());
    const json = JSON.stringify(vistaCiega(paquete));
    expect(fugasEn(json, paquete)).toEqual([]);
    expect(hayDigitosFueraDeIds(json)).toBe(false);
  });

  it("la fuente de una serie es la de su catálogo: una fuente con una marca no entra (el armador falla)", () => {
    const entrada = entradaDiarioConPlantados();
    const serie = entrada.series[0]!;
    const conMarca = { ...entrada, series: [{ ...serie, cifra: { ...serie.cifra, fuente: `sfc:${MARCAS.cuenta}` } }, ...entrada.series.slice(1)] };
    expect(() => armarDiario(conMarca)).toThrow(/FUENTE_DESCONOCIDA/);
  });

  it("condición 2 de PI desde el origen: el valor es la cifra fuente canónica y la presentación sale de él", () => {
    const entrada = entradaDiarioConPlantados();
    const paquete = armarDiario(entrada);
    const valor = paquete.hechos.find((h) => h.clave === "VALOR_ACCIONES");
    expect(valor?.valor).toBe(deDecimal(entrada.tablero.valorAcciones));
    expect(valor?.presentacion).toBe(presentar(deDecimal(entrada.tablero.valorAcciones), "PESOS"));
  });
});

describe("candado de los armadores · control positivo", () => {
  it("el detector de marcas muerde cuando una marca entra por un canal permitido (el nombre o la fuente)", () => {
    const [plantado] = numerarGrupos("REGLAS", [{
      prioridad: 1,
      hechos: [borrador("ESPECIE_NOMBRE", `FICTICIA-${MARCAS.cantidad}`, `${ACCION_PLANTADA} ${MARCAS.detalle}`, marcasDeHoy(HOY, "REGISTRO"))],
    }]).hechos;
    const paquete = construirPaquete({ tipo: "REGLAS", hoy: HOY, versionesCalculo: {}, avisos: [], hechos: [plantado!] });
    expect(marcasEn(jsonCanonico(paquete))).toEqual([MARCAS.cantidad, MARCAS.detalle]);
    expect(accionEnTextoLibre(paquete)).toBe(true);
  });

  it("un armador que copiara el texto libre de la regla a la fuente quedaría en rojo (mutación simulada)", () => {
    const [regla] = reglasLeidas();
    const especie = borrador("ESPECIE_NOMBRE", BETA, regla!.detalle, marcasDeHoy(HOY, "REGISTRO"));
    const ancla = borrador("REGLA_DEL_PLAN", "2027-02-03", "plan-ficticio", marcasDeHoy(HOY, "PLAN"), { sujeto: especie });
    const nivel = borrador("REGLA_NIVEL", deDecimal(D("4497.11")), `cantidad ${regla!.cantidad}`, marcasDeHoy(HOY, "PLAN"), { sujeto: ancla });
    const fuga = numerarGrupos("REGLAS", [{ prioridad: 1, hechos: [especie, ancla, nivel] }]).hechos;
    const paquete = construirPaquete({ tipo: "REGLAS", hoy: HOY, versionesCalculo: {}, avisos: [], hechos: fuga });
    expect(marcasEn(jsonCanonico(paquete))).toEqual([MARCAS.cantidad, MARCAS.detalle]);
  });

  it.each(["accion", "cantidad", "detalle", "encargo", "cuenta", "tenencia", "unidades", "correo", "instrumentoId", "motivo"])(
    "si alguien agrega «%s» a un hecho, construirPaquete lo rechaza (CLAVE_PROHIBIDA o CAMPO_DESCONOCIDO)",
    (campo) => {
      const paquete = armarReglas(entradaReglasFicticia());
      const hechos = paquete.hechos.map(({ etiqueta: _e, unidad: _u, ...resto }, i) => (i === 1 ? { ...resto, [campo]: MARCAS.cantidad } : resto));
      expect(() => construirPaquete({ tipo: "REGLAS", hoy: paquete.hoy, versionesCalculo: paquete.versionesCalculo, avisos: paquete.avisos, hechos } as never))
        .toThrow(/CLAVE_PROHIBIDA|CAMPO_DESCONOCIDO/);
    },
  );
});
