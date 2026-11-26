// Candado de la línea que no se cruza (008 no recomienda comprar ni vender) sobre los textos nuevos de los precios
// intradía: las líneas que imprime el CLI, los mensajes del bucle, los avisos de la configuración y el fuente de los
// archivos nuevos (textos, comentarios e identificadores partidos en palabras). Usa el detector de /operar
// (`prohibidasEn`), con control positivo: si el detector deja de morder, esto se pone rojo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reporteCiclo, reporteDepuracion } from "@/precios/intradia/reporte";
import { leerConfigIntradia } from "@/servicio-precios/intradia-configuracion";
import { prohibidasEn } from "../operar/informe/lenguaje";

const RAIZ = path.join(__dirname, "..", "..", "..");
const FUENTES = [
  "src/precios/intradia/yahoo.ts", "src/precios/intradia/guardar.ts", "src/precios/intradia/especies.ts", "src/precios/intradia/ciclo.ts",
  "src/precios/intradia/depurar.ts", "src/precios/intradia/leer.ts", "src/precios/intradia/reporte.ts",
  "src/servicio-precios/intradia-configuracion.ts", "src/servicio-precios/intradia.ts", "scripts/actualizar-intradia.ts",
];

describe("candado de lenguaje de los precios intradía", () => {
  it("control positivo: el detector muerde", () => {
    expect(prohibidasEn("Le conviene vender ya: es buen momento.")).not.toEqual([]);
  });

  it("ninguna línea del CLI ni aviso de la configuración recomienda, aconseja ni juzga", () => {
    const lineas = [
      ...reporteCiclo({ codigo: 0, especies: 3, peticiones: 3, barrasNuevas: 12, fallidas: [], sinCalendario: false }).lineas,
      ...reporteCiclo({ codigo: 3, especies: 3, peticiones: 3, barrasNuevas: 0, fallidas: [{ instrumentoId: "id-ficticio", codigo: "YAHOO_HTTP_404" }], sinCalendario: true }).lineas,
      ...reporteCiclo({ codigo: 4, especies: 0, peticiones: 0, barrasNuevas: 0, fallidas: [], sinCalendario: false }).lineas,
      ...reporteCiclo({ codigo: 7, especies: 3, peticiones: 2, barrasNuevas: 1, fallidas: [], sinCalendario: false }).lineas,
      ...reporteDepuracion(5).lineas,
      ...leerConfigIntradia({ INV_INTRADIA_ENCENDIDO: "x", INV_INTRADIA_CICLO_SEG: "x", INV_INTRADIA_DESDE_COT: "x", INV_INTRADIA_PAUSA_MS: "x", INV_INTRADIA_RETENCION_DIAS: "x", INV_INTRADIA_HOST_YAHOO: "x" }).avisos,
    ];
    expect(lineas.length).toBeGreaterThan(8);
    expect(lineas.filter((t) => prohibidasEn(t).length > 0)).toEqual([]);
  });

  it("ni el fuente de los archivos nuevos", () => {
    const partir = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
    const malos = FUENTES.flatMap((f) => prohibidasEn(partir(readFileSync(path.join(RAIZ, f), "utf8"))).map((p) => `${f}: ${p}`));
    expect(malos).toEqual([]);
  });
});
