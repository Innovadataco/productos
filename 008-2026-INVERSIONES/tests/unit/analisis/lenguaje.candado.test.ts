// Candado: la zona del motor de análisis (src/analisis/**) y lo que el motor devuelve no dan acciones ni juicios
// («compre», «venda», «recomend…», «conviene», «debería», «oportunidad», «buen momento» y parecidas). Con control
// positivo: un texto o un archivo plantado con una de esas palabras lo pone en rojo. Puro (solo lee la zona).
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { CLAVES_OBSERVACION, UMBRALES, UNIDADES } from "@/analisis/catalogo";
import { observaciones } from "@/analisis/observaciones";
import { hallarProhibidas, leerZona, prohibidasEnZona } from "./candados";
import { analisisConTodo, HOY } from "./fixtures/analisis.ficticio";
import { decision, dia, diasHabiles, horizonte, portafolio, retornosRepetidos, serieDeRetornos } from "./fixtures/portafolio.ficticio";

const PLANTADAS = [
  "compre", "venda", "Compre ya", "comprar", "vender", "mantenga", "recomendamos", "recomienda", "recomendación", "conviene", "noConviene",
  "debería", "deberia", "oportunidad", "buen momento", "aconsejamos", "consejo", "sugerimos", "sugiere", "aprovechar", "buena", "mala",
  "es la MEJOR", "ES_MEJOR", "barata", "atractiva", "sobrevalorada", "venta", "Buy now", "sell",
];
const NEUTRAS = ["la ventana común", "pesoCubierto", "DECIMALES_METRICA", "normalizar", "comprobar", "el mínimo", "contribución", "malla", "DECIMALES"];

describe("candado de lenguaje · control positivo", () => {
  it.each(PLANTADAS)("«%s» plantada se detecta", (palabra) => {
    expect(hallarProhibidas(`// texto plantado: ${palabra}.`).length).toBeGreaterThan(0);
  });

  it("un archivo plantado en una copia de la zona la pone en rojo, con su ruta y su línea", () => {
    const copia = new Map([...leerZona(), ["plantado.ts", "export const NOTA = 1;\n// le conviene revisar\n"]]);
    expect(prohibidasEnZona(copia)).toEqual(["plantado.ts:2: conviene"]);
  });

  it("los textos neutros no se detectan", () => {
    expect(NEUTRAS.flatMap((t) => hallarProhibidas(t))).toEqual([]);
  });
});

describe("candado de lenguaje · la zona", () => {
  const zona = leerZona();

  it("recorre toda la zona (no un directorio vacío)", () => {
    expect(zona.size).toBeGreaterThanOrEqual(15);
    expect([...zona.keys()]).toEqual(expect.arrayContaining(["analizar.ts", "observaciones.ts", "catalogo.ts", "tipos.ts"]));
  });

  it("ningún archivo, comentario, texto ni etiqueta de src/analisis da acciones o juicios", () => {
    expect(prohibidasEnZona(zona)).toEqual([]);
  });
});

describe("candado de lenguaje · lo que devuelve el motor", () => {
  it("ni el catálogo, ni un análisis, ni sus observaciones", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const e = portafolio(
      [
        { id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(dias, 1237.4, retornosRepetidos(299)) },
        { id: "FICTICIA-B", cantidad: 11, cierres: serieDeRetornos(dias.slice(100), 4613.27, retornosRepetidos(199, -1)) },
      ],
      { decisiones: [decision("FICTICIA-DEC-A", horizonte(30, { veredicto: "NO_FUNCIONO", pesos: "-1237.41" }), horizonte(90))] },
    );
    const { a, reglas } = analisisConTodo();
    const textos = [
      JSON.stringify({ CLAVES_OBSERVACION, UMBRALES, UNIDADES }),
      JSON.stringify(analizar(e)),
      JSON.stringify(observaciones(analizar(e), { reglas: [] }, e.hoy)),
      JSON.stringify(observaciones(a, { reglas }, dia(HOY))),
    ];
    expect(textos.flatMap((t) => hallarProhibidas(t))).toEqual([]);
  });
});
