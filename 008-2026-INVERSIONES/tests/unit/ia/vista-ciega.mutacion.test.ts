/**
 * Mutación de la vista: si alguien agrega a la vista `valor`, `presentacion` u otro campo del paquete completo, estas
 * pruebas se ponen rojas por tres caminos independientes: la guarda de `src/ia/` (que también corre dentro de
 * `vistaCiega`), los detectores escritos aparte en la prueba (dígitos y datos del paquete) y la lista de campos
 * escrita a mano. La mutación real del código se demuestra en el informe del PR.
 */
import { describe, expect, it } from "vitest";
import type { Hecho, PaqueteHechos } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { camposDeMas, fugasEn, hayDigitosFueraDeIds } from "./apoyo/detectores";
import { ENTRADAS_FICTICIAS } from "./apoyo/hechos.ficticio";

type CampoDelHecho = Exclude<keyof Hecho, "id" | "clave" | "etiqueta" | "sujeto" | "direccion" | "cercania" | "frescura" | "calidad" | "obligatorio">;
const CAMPOS_DEL_HECHO: readonly CampoDelHecho[] = ["valor", "presentacion", "unidad", "fuente", "fecha"];
type CampoDelPaquete = "version" | "hoy" | "avisos" | "versionesCalculo" | "hash";
const CAMPOS_DEL_PAQUETE: readonly CampoDelPaquete[] = ["version", "hoy", "avisos", "versionesCalculo", "hash"];

/** La vista mutada como la dejaría una proyección que copiara el campo del hecho. */
function vistaConCampoDelHecho(paquete: PaqueteHechos, campo: CampoDelHecho): unknown {
  const vista = vistaCiega(paquete);
  return { ...vista, hechos: vista.hechos.map((h, i) => ({ ...h, [campo]: (paquete.hechos[i] as Hecho)[campo] })) };
}

describe.each(Object.keys(ENTRADAS_FICTICIAS) as (keyof typeof ENTRADAS_FICTICIAS)[])("mutación de la vista de %s", (tipo) => {
  const paquete = construirPaquete(ENTRADAS_FICTICIAS[tipo]());

  it.each(CAMPOS_DEL_HECHO)("agregar «%s» a cada hecho pone roja la guarda y los detectores aparte", (campo) => {
    const mutada = vistaConCampoDelHecho(paquete, campo);
    const json = JSON.stringify(mutada);
    expect(fugasDeVistaCiega(mutada, paquete)).toContain("CAMPO_NO_PERMITIDO");
    expect(camposDeMas(mutada).length).toBeGreaterThan(0);
    if (campo !== "unidad") expect(fugasEn(json, paquete).length > 0 || hayDigitosFueraDeIds(json)).toBe(true);
  });

  it.each(["valor", "presentacion"] as const)("agregar «%s» deja ver el dato: dígitos o nombres del paquete", (campo) => {
    const mutada = vistaConCampoDelHecho(paquete, campo);
    const json = JSON.stringify(mutada);
    const codigos = fugasDeVistaCiega(mutada, paquete);
    expect(fugasEn(json, paquete)).toContain(campo);
    const nombres = paquete.hechos.some((h) => h.unidad === "NOMBRE");
    expect(codigos.includes("DIGITO_FUERA_DE_REFERENCIA") || codigos.includes("NOMBRE_DE_ESPECIE")).toBe(true);
    if (nombres) expect(codigos).toContain("NOMBRE_DE_ESPECIE");
  });

  it.each(CAMPOS_DEL_PAQUETE)("agregar «%s» del paquete a la vista pone roja la guarda", (campo) => {
    const mutada = { ...vistaCiega(paquete), [campo]: paquete[campo] };
    expect(fugasDeVistaCiega(mutada, paquete)).toContain("CAMPO_NO_PERMITIDO");
    expect(camposDeMas(mutada)).toEqual([campo]);
  });
});
