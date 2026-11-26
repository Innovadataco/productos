/**
 * La vista ciega de SIMULACION: es la de DIARIO. Lleva el hecho del nombre de la especie (solo id, clave y etiqueta; NUNCA el
 * valor: el código pone el nombre en la referencia, condición C1 de PI), `sujeto` y `especie` como en DIARIO, y además `rango` e
 * `importancia` (códigos de lista cerrada, sin dígitos). Los tres tipos de hoy no cambian: su vista no lleva `rango` ni
 * `importancia`. El resto del candado (fugas plantadas) está en `candados/vista-ciega-v2.candado.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { CAMPOS_HECHO_CIEGO } from "@/ia/contrato";
import { barreraLocal } from "@/ia/local/barrera";
import { construirPaquete, especieDe } from "@/ia/paquete";
import { vistaParaNube } from "@/ia/nube/peticion";
import { ESQUEMA_SALIDA_V3 } from "@/ia/prompts/esquema";
import { armarPedido } from "@/ia/generador";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { ENTRADAS_FICTICIAS, entradaSimulacion } from "../apoyo/hechos.ficticio";

const PROMPT = { texto: "Describa cómo queda el portafolio con los hechos dados.", version: "resumen-ficticio-v1", hash: "0".repeat(64) } as const;

describe("CAMPOS_HECHO_CIEGO", () => {
  it("agrega rango e importancia a la lista cerrada, sin quitar nada", () => {
    expect([...CAMPOS_HECHO_CIEGO]).toEqual(["id", "clave", "etiqueta", "sujeto", "especie", "direccion", "cercania", "frescura", "calidad", "obligatorio", "rango", "importancia"]);
  });
});

describe("la vista ciega de SIMULACION", () => {
  const paquete = construirPaquete(entradaSimulacion());
  const vista = vistaCiega(paquete);

  it("lleva el hecho del nombre (id, clave y etiqueta), sin el nombre ni ningún valor, y la guarda lo acepta", () => {
    const nombre = vista.hechos[0];
    expect(nombre).toMatchObject({ id: "H01", clave: "ESPECIE_NOMBRE", etiqueta: "nombre de la especie" });
    const json = JSON.stringify(vista);
    expect(json).not.toMatch(/FICTICIA|valor|presentacion/u);
    expect(fugasDeVistaCiega(vista, paquete)).toEqual([]);
    expect(fugasDeVistaCiega(vista, paquete)).not.toContain("NOMBRE_DE_ESPECIE");
  });

  it("los puntos de una especie llevan sujeto y especie (el id del nombre); los del portafolio, ninguno; la regla, por su ancla", () => {
    const porClave = (clave: string) => vista.hechos.find((h) => h.clave === clave);
    expect(porClave("PESO_ESPECIE")).toMatchObject({ sujeto: "H01", especie: "H01", rango: "MUY_ELEVADO", importancia: "ALTA", obligatorio: true });
    expect(porClave("PUNTO_CONCENTRACION")).not.toHaveProperty("sujeto");
    expect(porClave("PUNTO_CONCENTRACION")).not.toHaveProperty("especie");
    expect(porClave("PUNTO_NIVEL_REGLA")).toMatchObject({ sujeto: "H07", especie: "H01", rango: "MUY_CERCA" });
    expect(especieDe(paquete, "H08")?.id).toBe("H01");
  });

  it("no lleva valores, presentaciones, fechas ni fuentes, y no pasa la guarda con un hecho de menos", () => {
    expect(fugasDeVistaCiega({ ...vista, hechos: vista.hechos.slice(1) }, paquete)).toContain("NO_CORRESPONDE");
  });

  it("la barrera local y la petición a la nube la aceptan, con las listas cerradas", () => {
    const pedido = armarPedido({ paquete, prompt: PROMPT, esquemaSalida: ESQUEMA_SALIDA_V3, limiteMs: 60_000 });
    expect(barreraLocal(pedido)).toMatchObject({ ok: true });
    expect(vistaParaNube(vista)).not.toBeNull();
  });
});

describe("los tres tipos de hoy no cambian", () => {
  it.each(["DIARIO", "REGLAS", "ESCENARIOS"] as const)("la vista de %s no lleva rango ni importancia y conserva su nombre de especie como hecho", (tipo) => {
    const vista = vistaCiega(construirPaquete(ENTRADAS_FICTICIAS[tipo]()));
    expect(JSON.stringify(vista)).not.toMatch(/"rango"|"importancia"/u);
    expect(vista.hechos.some((h) => h.clave === "ESPECIE_NOMBRE")).toBe(true);
    expect(vista.hechos.length).toBe(construirPaquete(ENTRADAS_FICTICIAS[tipo]()).hechos.length);
  });
});
