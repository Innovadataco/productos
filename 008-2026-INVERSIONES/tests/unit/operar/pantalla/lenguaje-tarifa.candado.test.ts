// Candado de la línea que no se cruza (008 no recomienda comprar ni vender) sobre los textos nuevos de O5 y de la sección
// «¿Y si…?»: los de /edicion/tarifas, los del simulador en pantalla, los del control y de la comisión con tarifa, y el
// fuente de los archivos nuevos (textos, comentarios e identificadores). Usa el detector de /operar (`prohibidasEn`), con
// control positivo: si el detector deja de morder, esto se pone rojo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVISO_CAJA_AV_NEGATIVA, CAJA_ESCRITA, CAJA_SIN_CERTIFICACION, SIN_CIERRE, textoCajaCertificada } from "@/app/operar/serializar-simulacion";
import { COMISIONISTAS_SIMULADOR, LADOS_SIMULADOR, ORIGEN_COMISION, TEXTOS_SIMULADOR, mensajeDeEstado } from "@/app/operar/textos-simulador";
import { AYUDAS_TARIFA, ETIQUETAS_TARIFA, TEXTOS_TARIFAS, etiquetaDeCampo, mensajeTarifa } from "@/app/edicion/tarifas/textos-tarifas";
import { ETIQUETA_TARIFA, textoComision } from "@/operar/simulador/textos";
import { prohibidasEn } from "../informe/lenguaje";
import { tarifa } from "../tarifa/apoyo/tarifa.ficticio";

const CODIGOS = ["FORMATO_INVALIDO", "VACIO", "DEMASIADO_LARGO", "PORCENTAJE_INVALIDO", "IVA_INVALIDO", "MONTO_INVALIDO", "COMISIONISTA_INVALIDO", "LADO_INVALIDO", "TIPO_CARGO_INVALIDO", "NOMBRE_INVALIDO", "CARGOS_DEMASIADOS", "FECHA_INVALIDA", "VIGENCIA_DEMASIADO_LEJANA", "TARIFA_CAMBIO", "AUTOR_INEXISTENTE", "OTRO"];
const SRC = path.join(__dirname, "..", "..", "..", "..", "src");
const FUENTES = [
  "app/operar/Simulador.tsx", "app/operar/textos-simulador.ts", "app/operar/tipos-simulador.ts", "app/operar/serializar-simulacion.ts",
  "app/edicion/tarifas/FormularioTarifa.tsx", "app/edicion/tarifas/Informacion.tsx", "app/edicion/tarifas/textos-tarifas.ts", "app/edicion/tarifas/datos.ts", "app/edicion/tarifas/page.tsx",
  "app/api/operar/simular/route.ts", "app/api/operar/tarifas/route.ts",
  "operar/tarifa/control.ts", "operar/tarifa/vigente.ts", "operar/tarifa/pedido.ts", "operar/tarifa/leer.ts", "operar/tarifa/crear.ts", "operar/tarifa/parametros.ts",
  "operar/pantalla/entrada.ts", "operar/pantalla/leer.ts", "operar/pantalla/frecuencia.ts", "operar/simulador/tarifa.ts",
];

const textos = (): string[] => [
  ...Object.values(TEXTOS_SIMULADOR), ...LADOS_SIMULADOR.map((l) => l.texto), ...COMISIONISTAS_SIMULADOR.map((c) => c.texto), ...Object.values(ORIGEN_COMISION),
  ...[400, 401, 429, 500].map(mensajeDeEstado),
  ...Object.values(TEXTOS_TARIFAS), ...Object.values(ETIQUETAS_TARIFA), ...Object.values(AYUDAS_TARIFA), ...CODIGOS.map(mensajeTarifa),
  ...["comisionista", "otrosCargos", "otrosCargos.2.valor", "x"].map(etiquetaDeCampo),
  ETIQUETA_TARIFA, textoComision({ estado: "TARIFA", lado: "VENTA", valor: tarifa().porcentaje, tarifa: tarifa({ comisionista: "AV" }) }),
  CAJA_SIN_CERTIFICACION, SIN_CIERRE, textoCajaCertificada("2027-03-12"), CAJA_ESCRITA, AVISO_CAJA_AV_NEGATIVA,
];

describe("candado de lenguaje de O5 y de «¿Y si…?»", () => {
  it("control positivo: el detector muerde", () => {
    expect(prohibidasEn("Le conviene vender ya: es buen momento.")).not.toEqual([]);
  });

  it("ningún texto recomienda, aconseja ni juzga", () => {
    const malos = textos().filter((t) => prohibidasEn(t).length > 0);
    expect(textos().length).toBeGreaterThan(60);
    expect(malos).toEqual([]);
  });

  it("ni el fuente de los archivos nuevos (textos, comentarios e identificadores partidos en palabras)", () => {
    const partir = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
    const malos = FUENTES.flatMap((f) => prohibidasEn(partir(readFileSync(path.join(SRC, f), "utf8"))).map((p) => `${f}: ${p}`));
    expect(malos).toEqual([]);
  });
});
