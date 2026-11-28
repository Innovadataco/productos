/**
 * Los argumentos de `ia:evaluar` (E7): tres subcomandos (`casos`, `correr` e `informe`), listas blancas de opciones por
 * subcomando, cada una una sola vez, y valores revisados. Cierran en fallo con un código, sin repetir el valor recibido.
 */
import { describe, expect, it } from "vitest";
import { SEMILLA_INVENTADOS } from "@/ia/evaluacion/inventados.ficticio";
import { ErrorArgumentosEvaluacion, leerArgumentosEvaluacion, PAUSA_POR_OMISION_MS, USO_EVALUAR, VARIABLE_DESTINO } from "@/ia/evaluacion/argumentos";

const SALIDA = "/ruta/absoluta/ficticia/e7";
const leer = (argv: readonly string[], entorno: Record<string, string> = {}) => leerArgumentosEvaluacion(argv, entorno);

function codigoDe(argv: readonly string[], entorno: Record<string, string> = {}): string {
  try {
    leer(argv, entorno);
    return "SIN_ERROR";
  } catch (e) {
    if (!(e instanceof ErrorArgumentosEvaluacion)) return `OTRO:${String(e)}`;
    for (const a of argv.filter((x) => !x.startsWith("--") && x.length > 3)) expect(e.message, a).not.toContain(a);
    return e.codigo;
  }
}

describe("leerArgumentosEvaluacion", () => {
  it("la variable del destino y el uso", () => {
    expect(VARIABLE_DESTINO).toBe("INV_IA_LOCAL_DESTINO");
    expect(USO_EVALUAR).toMatch(/^Uso: npm run ia:evaluar -- /);
    expect(USO_EVALUAR).toContain(VARIABLE_DESTINO);
  });

  it("casos: la semilla por omisión, otra semilla o el archivo exportado", () => {
    expect(leer(["casos"])).toEqual({ comando: "casos", semilla: SEMILLA_INVENTADOS, paquetes: null, casos: null });
    expect(leer(["casos", "--semilla", "4613"])).toEqual({ comando: "casos", semilla: 4613, paquetes: null, casos: null });
    expect(leer(["casos", "--paquetes", "/ruta/ficticia/hechos.json"])).toEqual({ comando: "casos", semilla: null, paquetes: "/ruta/ficticia/hechos.json", casos: null });
  });

  it("correr: modelo y salida obligatorios; dos pasadas, pausa de dos segundos y todos los casos por omisión", () => {
    expect(leer(["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA])).toEqual({
      comando: "correr", modelo: "qwen2.5:14b", salida: SALIDA, semilla: SEMILLA_INVENTADOS, paquetes: null, casos: null, pasadas: 2, maxCasos: null, pausaMs: PAUSA_POR_OMISION_MS,
    });
    expect(PAUSA_POR_OMISION_MS).toBe(2000);
    expect(leer(["correr", "--salida", SALIDA, "--modelo", "aya-expanse:32b", "--pasadas", "1", "--max-casos", "7", "--pausa-s", "0", "--paquetes", "/ruta/ficticia/hechos.json"])).toEqual({
      comando: "correr", modelo: "aya-expanse:32b", salida: SALIDA, semilla: null, paquetes: "/ruta/ficticia/hechos.json", casos: null, pasadas: 1, maxCasos: 7, pausaMs: 0,
    });
  });

  it("--casos: una lista de ids separados por coma, en casos y en correr; el máximo de --max-casos sube a 42", () => {
    expect(leer(["casos", "--casos", "DIARIO-16,DIARIO-17"])).toMatchObject({ comando: "casos", casos: ["DIARIO-16", "DIARIO-17"] });
    expect(leer(["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--casos", "DIARIO-16"])).toMatchObject({ comando: "correr", casos: ["DIARIO-16"], maxCasos: null });
    expect(leer(["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--max-casos", "42"])).toMatchObject({ maxCasos: 42 });
  });

  it("informe: salida y fuentes; pares 10 por omisión, o TODOS", () => {
    expect(leer(["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b,plantilla"])).toEqual({
      comando: "informe", salida: SALIDA, fuentes: ["qwen2.5:14b", "plantilla"], pares: 10, semilla: SEMILLA_INVENTADOS,
    });
    expect(leer(["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b,gemma2:27b,aya-expanse:32b", "--pares", "todos", "--semilla", "1237"])).toMatchObject({
      fuentes: ["qwen2.5:14b", "gemma2:27b", "aya-expanse:32b"], pares: "TODOS", semilla: 1237,
    });
  });

  for (const [nombre, argv, codigo] of [
    ["sin subcomando", [], "USO"],
    ["un subcomando desconocido", ["borrar"], "USO"],
    ["--ayuda", ["correr", "--ayuda"], "USO"],
    ["una opción de otro subcomando", ["casos", "--modelo", "qwen2.5:14b"], "OPCION_DESCONOCIDA"],
    ["un argumento suelto", ["correr", "qwen2.5:14b"], "ARGUMENTO_SUELTO"],
    ["una opción sin valor", ["correr", "--modelo"], "FALTA_VALOR"],
    ["una opción repetida", ["correr", "--modelo", "qwen2.5:14b", "--modelo", "gemma2:27b", "--salida", SALIDA], "OPCION_REPETIDA"],
    ["sin modelo", ["correr", "--salida", SALIDA], "FALTA_MODELO"],
    ["sin salida", ["correr", "--modelo", "qwen2.5:14b"], "FALTA_SALIDA"],
    ["una salida relativa", ["correr", "--modelo", "qwen2.5:14b", "--salida", "resultados/e7"], "SALIDA_RELATIVA"],
    ["un archivo de paquetes relativo", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--paquetes", "hechos-exportados.json"], "PAQUETES_RELATIVA"],
    ["semilla con paquetes", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--paquetes", "/ruta/ficticia/hechos.json", "--semilla", "4613"], "SEMILLA_CON_PAQUETES"],
    ["un modelo con espacios", ["correr", "--modelo", "modelo con espacios", "--salida", SALIDA], "MODELO_INVALIDO"],
    ["un modelo llamado como la línea base", ["correr", "--modelo", "plantilla", "--salida", SALIDA], "MODELO_INVALIDO"],
    ["una semilla negativa", ["casos", "--semilla", "-1"], "SEMILLA_INVALIDA"],
    ["una semilla con decimales", ["casos", "--semilla", "4613.5"], "SEMILLA_INVALIDA"],
    ["tres pasadas", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--pasadas", "3"], "PASADAS_INVALIDAS"],
    ["cero casos", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--max-casos", "0"], "MAX_CASOS_INVALIDO"],
    ["más casos que los que hay", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--max-casos", "43"], "MAX_CASOS_INVALIDO"],
    ["casos con un id mal formado", ["casos", "--casos", "diario-16"], "CASOS_INVALIDOS"],
    ["casos con una lista vacía entre comas", ["casos", "--casos", "DIARIO-16,,DIARIO-17"], "CASOS_INVALIDOS"],
    ["casos con un id repetido", ["casos", "--casos", "DIARIO-16,DIARIO-16"], "CASOS_INVALIDOS"],
    ["casos con más ids que casos hay", ["casos", "--casos", Array.from({ length: 43 }, (_, i) => `DIARIO-${String(i + 1).padStart(2, "0")}`).join(",")], "CASOS_INVALIDOS"],
    ["casos junto con max-casos", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--casos", "DIARIO-16", "--max-casos", "1"], "CASOS_CON_MAX_CASOS"],
    ["casos en informe", ["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b,plantilla", "--casos", "DIARIO-16"], "OPCION_DESCONOCIDA"],
    ["una pausa de más de un minuto", ["correr", "--modelo", "qwen2.5:14b", "--salida", SALIDA, "--pausa-s", "61"], "PAUSA_INVALIDA"],
    ["informe sin fuentes", ["informe", "--salida", SALIDA], "FALTAN_FUENTES"],
    ["una sola fuente", ["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b"], "FUENTES_INVALIDAS"],
    ["una fuente repetida", ["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b,qwen2.5:14b"], "FUENTES_INVALIDAS"],
    ["cinco fuentes", ["informe", "--salida", SALIDA, "--fuentes", "a:1,b:2,c:3,d:4,plantilla"], "FUENTES_INVALIDAS"],
    ["cero pares", ["informe", "--salida", SALIDA, "--fuentes", "qwen2.5:14b,plantilla", "--pares", "0"], "PARES_INVALIDOS"],
  ] as const) {
    it(`${nombre}: ${codigo}`, () => {
      expect(codigoDe(argv)).toBe(codigo);
    });
  }

  it("si npm se quedó con una opción (faltó «--»), lo dice", () => {
    expect(codigoDe(["correr", "--salida", SALIDA], { npm_config_modelo: "qwen2.5:14b" })).toBe("NPM_SE_QUEDO");
  });
});
