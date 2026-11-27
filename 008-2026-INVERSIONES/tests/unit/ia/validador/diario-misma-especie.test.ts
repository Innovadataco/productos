/**
 * DIARIO, frase con dos datos de una especie (defecto del vocabulario): el modelo escribió «de la especie de la especie»
 * y «la misma especie», y la salida salió RECHAZADA por IDIOMA.VOCABULARIO porque «misma» no está en el vocabulario (a
 * propósito: abriría tres huecos). El arreglo es del PROMPT (v5): un dato de especie por frase, con un molde por dato.
 * Valores y especie inventados; el validador no cambia.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO, entradaDeCatalogo, type ClaveDiario } from "@/ia/catalogo";
import type { PaqueteHechos } from "@/ia/contrato";
import { PROMPTS } from "@/ia/prompts/prompts";
import { diagnosticarSalida } from "@/ia/validador/diagnostico";
import { validarSalida } from "@/ia/validador/validar";
import { palabrasFueraDelVocabulario } from "@/ia/validador/vocabulario";
import { salidaDe } from "./apoyo/salidas.ficticio";
import { paqueteDiarioEspecie } from "./apoyo/diario-especie.ficticio";

/** Los moldes del DIARIO, escritos a mano: [nombre] es la referencia del campo especie y [dato], la del propio dato. */
const MOLDES_ESPERADOS: Readonly<Record<string, string>> = {
  VALOR_ESPECIE: "El valor de la especie [nombre] es [dato].",
  PESO_ESPECIE: "El peso de la especie [nombre] en el portafolio es [dato].",
  RENTABILIDAD_ESPECIE: "La rentabilidad sin vender de la especie [nombre] es [dato].",
  CIERRE_ESPECIE: "El precio de cierre de la especie [nombre] es [dato].",
  FECHA_CIERRE_ESPECIE: "La fecha del cierre de la especie [nombre] es [dato].",
  VARIACION_DIA_ESPECIE: "La variación del día de la especie [nombre] es [dato].",
};

const FRASE_OBSERVADA = "La rentabilidad sin vender de la especie de la especie {ESPECIE_NOMBRE} es {RENTABILIDAD_ESPECIE}, "
  + "pero el precio de cierre de la misma especie es {CIERRE_ESPECIE}.";
const MOLDE_A_PLANTILLA: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(MOLDES_ESPERADOS).map(([clave, molde]) => [clave, molde.replace("[nombre]", "{ESPECIE_NOMBRE}").replace("[dato]", `{${clave}}`)]),
);

const diario = (): PaqueteHechos<"DIARIO"> => paqueteDiarioEspecie();
/** El molde parte la etiqueta del catálogo justo después de «de la especie», que es donde va el nombre. */
const FIN_DE_LA_PARTE_FIJA = "de la especie";
const clavesExigidas = (): readonly string[] =>
  (Object.keys(CATALOGO.DIARIO) as ClaveDiario[]).filter((c) => entradaDeCatalogo("DIARIO", c)?.politicaSujeto === "EXIGIDO");

describe("regresión: la salida observada se rechaza por el vocabulario (no cambia con el arreglo del prompt)", () => {
  it("IDIOMA.VOCABULARIO en la frase del modelo, y la única palabra de fuera es «misma»", () => {
    const paquete = diario();
    const cruda = salidaDe(paquete, FRASE_OBSERVADA);
    const resultado = validarSalida(cruda, paquete);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain("IDIOMA");
    expect(resultado.hallazgos.map((h) => h.patron)).toContain("IDIOMA.VOCABULARIO");
    const hallazgo = diagnosticarSalida(cruda, paquete).find((h) => h.patron === "IDIOMA.VOCABULARIO");
    expect(hallazgo?.parte).toBe("MODELO");
    expect(palabrasFueraDelVocabulario(FRASE_OBSERVADA, "DIARIO")).toEqual(["misma"]);
    expect(palabrasFueraDelVocabulario(FRASE_OBSERVADA.replace("misma ", ""), "DIARIO")).toEqual([]);
  });
});

describe("el prompt DIARIO da un molde por dato de especie", () => {
  const texto = PROMPTS.DIARIO.texto;

  it("la tabla de la prueba cubre exactamente los datos de especie del catálogo, con la etiqueta del catálogo y un solo «[nombre]»", () => {
    expect(Object.keys(MOLDES_ESPERADOS).sort()).toEqual([...clavesExigidas()].sort());
    for (const [clave, molde] of Object.entries(MOLDES_ESPERADOS)) {
      const etiqueta = entradaDeCatalogo("DIARIO", clave)?.etiqueta ?? "";
      expect(etiqueta, clave).not.toBe("");
      const cortes = etiqueta.toLowerCase().split(FIN_DE_LA_PARTE_FIJA).map((t) => t.trim());
      expect(cortes.length, clave).toBe(2);
      const [antes, despues] = cortes as [string, string];
      const esperado = [antes, FIN_DE_LA_PARTE_FIJA, "[nombre]", ...(despues === "" ? [] : [despues]), "es [dato]."].join(" ");
      expect(molde.toLowerCase(), clave).toContain(esperado);
      expect(molde.split("[nombre]").length - 1, clave).toBe(1);
    }
  });

  it.each(Object.entries(MOLDES_ESPERADOS))("%s: el prompt trae el molde literal", (_clave, molde) => {
    expect(texto).toContain(molde);
  });

  it("pide un dato de especie por frase, dice que la etiqueta ya trae «de la especie» y prohíbe «misma» y «mismo»", () => {
    expect(texto).toContain("Un solo dato de especie por frase");
    expect(texto).toContain("La etiqueta ya trae «de la especie»: no la repita");
    expect(texto).toContain("abra otra frase con su molde");
    expect(texto).toContain("No use «misma» ni «mismo»");
  });
});

describe("guarda del diseño: una salida que sigue los moldes publica (si falla, se ajusta el molde, nunca el validador)", () => {
  it.each(Object.entries(MOLDE_A_PLANTILLA))("%s: un molde en una frase publica, y lo renderizado no dice «especie de la especie»", (_clave, plantilla) => {
    const paquete = diario();
    const resultado = validarSalida(salidaDe(paquete, plantilla), paquete);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.resumen.texto).not.toMatch(/especie de la especie/iu);
    expect(resultado.resumen.texto).toContain("FICTICIA-DELTA");
  });

  it("dos datos de la especie en dos frases, cada una con su molde: publica", () => {
    const paquete = diario();
    const moldes = [MOLDE_A_PLANTILLA.RENTABILIDAD_ESPECIE, MOLDE_A_PLANTILLA.CIERRE_ESPECIE] as readonly string[];
    const resultado = validarSalida(salidaDe(paquete, ...moldes), paquete);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.resumen.texto).not.toMatch(/misma|especie de la especie/iu);
  });
});
