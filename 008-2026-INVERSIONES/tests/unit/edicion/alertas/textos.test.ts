// Los textos de /edicion/alertas: cada ayuda dice el rango del motor (una sola fuente: RANGOS_UMBRALES), cada código del
// dominio tiene su mensaje y ningún texto recomienda comprar ni vender.
import { describe, expect, it } from "vitest";
import { RANGOS_UMBRALES, UMBRALES_OMISION } from "@/alertas/umbrales";
import { AYUDAS_ALERTAS, ETIQUETAS_ALERTAS, TEXTOS_ALERTAS, mensajeAlertas } from "@/app/edicion/alertas/textos-alertas";
import { ETIQUETAS_CAMPO, MENSAJES } from "@/app/edicion/textos";
import { prohibidasEn } from "../../operar/informe/lenguaje";

const es = (n: number): string => String(n).replace(".", ",");

describe("textos de /edicion/alertas", () => {
  it.each(Object.entries(RANGOS_UMBRALES))("la ayuda de %s dice su mínimo y su máximo", (campo, { min, max }) => {
    const ayuda = AYUDAS_ALERTAS[campo as keyof typeof AYUDAS_ALERTAS];
    expect(ayuda).toContain(`De ${es(min)} a ${es(max)}`);
  });

  it("cada campo del motor (umbral e interruptor) tiene su etiqueta", () => {
    for (const campo of Object.keys(UMBRALES_OMISION)) expect(ETIQUETAS_ALERTAS, campo).toHaveProperty(campo);
  });

  it("cada código que da el servidor tiene mensaje propio; uno desconocido cae al genérico", () => {
    for (const c of ["FORMATO_INVALIDO", "VACIO", "DEMASIADO_LARGO", "FUERA_DE_RANGO", "DEBE_SER_ENTERO", "DECIMALES_DE_MAS", "UMBRAL_CAMBIO", "AUTOR_INEXISTENTE"]) {
      expect(mensajeAlertas(c), c).not.toBe(mensajeAlertas("NO_EXISTE"));
    }
  });

  it("el resumen común del área dice lo mismo: etiquetas de campo y mensajes de cada código", () => {
    for (const [campo, etiqueta] of Object.entries(ETIQUETAS_ALERTAS)) {
      if (campo !== "cuerpo" && campo !== "motivo" && campo !== "versionBase") expect(ETIQUETAS_CAMPO[campo], campo).toBe(etiqueta);
    }
    for (const c of ["FUERA_DE_RANGO", "DEBE_SER_ENTERO", "DECIMALES_DE_MAS", "UMBRAL_CAMBIO", "AUTOR_INEXISTENTE"]) expect(MENSAJES[c], c).toBe(mensajeAlertas(c));
  });

  it("ningún texto recomienda comprar ni vender (con control positivo)", () => {
    const todos = [...Object.values(TEXTOS_ALERTAS), ...Object.values(ETIQUETAS_ALERTAS), ...Object.values(AYUDAS_ALERTAS)].join(" · ");
    expect(prohibidasEn(todos)).toEqual([]);
    expect(prohibidasEn("Le conviene comprar hoy")).not.toEqual([]);
  });
});
