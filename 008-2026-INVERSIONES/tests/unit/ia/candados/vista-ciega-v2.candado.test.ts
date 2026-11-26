/**
 * Candado de la vista ciega v2 (condiciones C1 y C3 de PI). Cada fuga PLANTADA en la vista de SIMULACION tiene que dar
 * rojo en la guarda (`fugasDeVistaCiega`), en la barrera de la puerta local y en la petición a la nube, que no ven el
 * paquete y solo aceptan listas cerradas: un dígito, un rango de otra clave, un valor plantado, un nombre plantado y los
 * campos `lado`, `cambio` o `antes`; y el nombre de la especie (el hecho, un `sujeto` o una `especie` que lo apunte).
 * Cada caso lleva su control positivo (la vista limpia pasa) para que el rojo no sea por otra causa.
 */
import { describe, expect, it } from "vitest";
import { barreraLocal } from "@/ia/local/barrera";
import { armarPedido } from "@/ia/generador";
import { vistaParaNube } from "@/ia/nube/peticion";
import { construirPaquete } from "@/ia/paquete";
import { ESQUEMA_SALIDA_V3 } from "@/ia/prompts/esquema";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { entradaSimulacion } from "../apoyo/hechos.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const limpia = JSON.parse(JSON.stringify(vistaCiega(paquete))) as { tipo: string; hechos: Record<string, unknown>[] };
const PROMPT = { texto: "Describa cómo queda el portafolio con los hechos dados.", version: "resumen-ficticio-v1" };

/** La vista limpia con el hecho de esa clave cambiado. */
const conClave = (clave: string, cambios: Record<string, unknown>): unknown => ({
  ...limpia,
  hechos: limpia.hechos.map((h) => (h.clave === clave ? { ...h, ...cambios } : h)),
});
const pedidoCon = (vista: unknown): unknown => ({ ...armarPedido({ paquete, prompt: PROMPT, esquemaSalida: ESQUEMA_SALIDA_V3, limiteMs: 60_000 }), vista });

/** [caso, vista, código de la guarda, ¿la ven también la barrera local y la nube, que no tienen el paquete?]. */
const FUGAS: readonly (readonly [string, unknown, string, boolean])[] = [
  ["la vista copia el valor del paquete (el defecto que el candado existe para atrapar)", conClave("PESO_ESPECIE", { valor: "42.5" }), "CAMPO_NO_PERMITIDO", true],
  ["la vista copia la presentación", conClave("PESO_ESPECIE", { presentacion: "42,5 %" }), "CAMPO_NO_PERMITIDO", true],
  ["un dígito en el rango", conClave("PESO_ESPECIE", { rango: "MUY_ELEVADO_5" }), "DIGITO_FUERA_DE_REFERENCIA", true],
  ["un dígito en la etiqueta", conClave("PESO_ESPECIE", { etiqueta: "peso de la especie 42" }), "DIGITO_FUERA_DE_REFERENCIA", true],
  ["el rango de otra clave (TOCADA en el peso)", conClave("PESO_ESPECIE", { rango: "TOCADA", importancia: "ALTA" }), "NO_CORRESPONDE", true],
  ["un rango inventado", conClave("PESO_ESPECIE", { rango: "ENORME" }), "NO_CORRESPONDE", true],
  ["otra importancia que la del rango", conClave("PESO_ESPECIE", { importancia: "BAJA" }), "NO_CORRESPONDE", true],
  ["el valor plantado en la etiqueta", conClave("PESO_ESPECIE", { etiqueta: "peso de la especie 42,5 %" }), "PRESENTACION_DEL_PAQUETE", true],
  ["el nombre de la especie plantado en la etiqueta", conClave("PESO_ESPECIE", { etiqueta: "peso de la especie FICTICIA-ALFA" }), "NOMBRE_DE_ESPECIE", true],
  ["el nombre de la especie plantado en el rango", conClave("PESO_ESPECIE", { rango: "FICTICIA-ALFA" }), "NOMBRE_DE_ESPECIE", true],
  ["el campo lado", conClave("PESO_ESPECIE", { lado: "COMPRAR" }), "CAMPO_NO_PERMITIDO", true],
  ["el campo cambio", conClave("PESO_ESPECIE", { cambio: "SUBE" }), "CAMPO_NO_PERMITIDO", true],
  ["el campo antes", conClave("PESO_ESPECIE", { antes: "ELEVADO" }), "CAMPO_NO_PERMITIDO", true],
  ["el campo despues", conClave("PESO_ESPECIE", { despues: "MUY_ELEVADO" }), "CAMPO_NO_PERMITIDO", true],
  ["un sujeto que apunta a otro hecho (el nombre pasa a ser otro dato)", conClave("PESO_ESPECIE", { sujeto: "H03" }), "NO_CORRESPONDE", false],
  ["una especie que apunta a otro hecho", conClave("PESO_ESPECIE", { especie: "H03" }), "NO_CORRESPONDE", false],
  ["el hecho del nombre con el nombre plantado como etiqueta", conClave("ESPECIE_NOMBRE", { etiqueta: "FICTICIA-ALFA" }), "NOMBRE_DE_ESPECIE", false],
  ["el hecho del nombre con un campo valor", conClave("ESPECIE_NOMBRE", { valor: "FICTICIA-ALFA" }), "CAMPO_NO_PERMITIDO", true],
  ["un hecho de menos", { ...limpia, hechos: limpia.hechos.slice(1) }, "NO_CORRESPONDE", false],
];

describe("vista ciega v2 · control positivo", () => {
  it("la vista limpia de SIMULACION pasa la guarda, la barrera local y la petición a la nube", () => {
    expect(fugasDeVistaCiega(limpia, paquete)).toEqual([]);
    expect(barreraLocal(pedidoCon(limpia))).toMatchObject({ ok: true });
    expect(vistaParaNube(limpia)).not.toBeNull();
  });
});

describe("vista ciega v2 · cada fuga plantada da rojo", () => {
  it.each(FUGAS)("%s: la guarda da %s", (_caso, vista, codigo) => {
    expect(fugasDeVistaCiega(vista, paquete)).toContain(codigo);
  });

  it.each(FUGAS.filter(([, , , sinPaquete]) => sinPaquete))("%s: la barrera local y la petición a la nube la rechazan sin ver el paquete", (_caso, vista) => {
    expect(barreraLocal(pedidoCon(vista)).ok).toBe(false);
    expect(vistaParaNube(vista)).toBeNull();
  });
});

describe("vista ciega v2 · listas cerradas de rango e importancia en la barrera y la nube", () => {
  it.each([
    ["rango de otra clave", { rango: "TOCADA", importancia: "ALTA" }],
    ["rango fuera de lista", { rango: "ENORME", importancia: "ALTA" }],
    ["importancia que no es la del rango", { rango: "MUY_ELEVADO", importancia: "BAJA" }],
    ["importancia fuera de lista", { rango: "MUY_ELEVADO", importancia: "URGENTE" }],
    ["rango que no es texto", { rango: 7, importancia: "ALTA" }],
    ["sin importancia", { rango: "MUY_ELEVADO", importancia: undefined }],
    ["sin rango", { rango: undefined, importancia: "ALTA" }],
  ])("un punto con %s lo rechazan la barrera y la nube", (_caso, cambios) => {
    const vista = conClave("PESO_ESPECIE", cambios);
    expect(barreraLocal(pedidoCon(vista)).ok).toBe(false);
    expect(vistaParaNube(vista)).toBeNull();
  });

  it("los tres de hoy: un rango o una importancia en su vista también se rechaza (no los llevan)", () => {
    const diario = {
      tipo: "DIARIO",
      hechos: [{ id: "H01", clave: "VALOR_ACCIONES", etiqueta: "valor de las acciones", direccion: "SUBE", cercania: "NO_APLICA", frescura: "RECIENTE", calidad: "VERIFICADO", obligatorio: false, rango: "ELEVADO", importancia: "ALTA" }],
    };
    expect(vistaParaNube(diario)).toBeNull();
    const sin = { tipo: "DIARIO", hechos: [{ ...diario.hechos[0], rango: undefined, importancia: undefined }] };
    delete (sin.hechos[0] as Record<string, unknown>).rango;
    delete (sin.hechos[0] as Record<string, unknown>).importancia;
    expect(vistaParaNube(sin)).not.toBeNull();
  });
});
