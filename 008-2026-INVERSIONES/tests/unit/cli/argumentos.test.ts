// Los CLI de 008 como proceso (hueco de pruebas): con argumentos inválidos o con --ayuda (que ninguno
// implementa: es una opción desconocida) salen con 2 y su uso, ANTES de tocar la base; y ningún error
// imprime datos. La base es inalcanzable a propósito (puerto 1 de 127.0.0.1): si un CLI la tocara, saldría
// con 1 y un PrismaClientInitializationError, no con 2. El entorno del hijo es mínimo: no hereda la
// DATABASE_URL ni las claves de quien corre las pruebas. Sin red. Datos inventados.
// Fuera de aquí: actualizar-precios.ts (frente de precios) y construir-lotes.ts (frente de lotes).
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..");
const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
/** Lo que nunca debe salir en la consola de un CLI: la URL de la base, su host y su clave. */
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];
const POR_CLI_MS = 60_000;

interface Salida {
  readonly codigo: number | null;
  readonly texto: string;
}

function correr(script: string, args: readonly string[]): Salida {
  const r = spawnSync(TSX, [join("scripts", script), ...args], {
    cwd: RAIZ,
    env: { PATH: process.env.PATH ?? "", DATABASE_URL: INALCANZABLE, NO_COLOR: "1" },
    encoding: "utf8",
    timeout: POR_CLI_MS,
  });
  return { codigo: r.status, texto: `${r.stdout}${r.stderr}` };
}

/** Sale con `codigo`, dice `esperado`, no llegó a la base y no imprime nada de `ademas` ni de la URL. */
function comprobar(s: Salida, codigo: number, esperado: string, ademas: readonly string[] = []): void {
  expect(s.codigo, s.texto).toBe(codigo);
  expect(s.texto).toContain(esperado);
  if (codigo === 2) expect(s.texto, "un 2 no debe haber intentado la base").not.toContain("PrismaClient");
  for (const p of [...NUNCA, ...ademas]) expect(s.texto, p).not.toContain(p);
}

describe("CLI · argumentos inválidos y --ayuda (sin base)", { timeout: 4 * POR_CLI_MS }, () => {
  it("importar-trii: --ayuda, sin argumentos o sin archivo → 2 con su uso, sin repetir el correo", () => {
    const uso = "Uso: npm run importar:trii -- --email";
    comprobar(correr("importar-trii.ts", ["--ayuda"]), 2, uso);
    comprobar(correr("importar-trii.ts", []), 2, uso);
    comprobar(correr("importar-trii.ts", ["--email", "dueno-cli@ejemplo.invalid"]), 2, uso, ["dueno-cli@ejemplo.invalid"]);
  });

  it("importar-plan: --ayuda, --ficha sin valor o --aplicar repetido → 2 con su uso", () => {
    const uso = "Uso: npx tsx scripts/importar-plan.ts --ficha";
    comprobar(correr("importar-plan.ts", ["--ayuda"]), 2, uso);
    comprobar(correr("importar-plan.ts", ["--ficha"]), 2, uso);
    comprobar(correr("importar-plan.ts", ["--ficha", "f.ficticio.md", "--email", "d@ejemplo.invalid", "--aplicar", "--aplicar"]), 2, uso);
  });

  it("actualizar-fondo: --ayuda, fecha inválida, rango al revés o registro mal formado → 2 con el código por campo", () => {
    comprobar(correr("actualizar-fondo.ts", ["--ayuda"]), 2, "argumentos · ARGUMENTOS_INVALIDOS");
    comprobar(correr("actualizar-fondo.ts", ["--desde", "2024-13-01"]), 2, "desde · FECHA_INVALIDA");
    comprobar(correr("actualizar-fondo.ts", ["--desde", "2024-02-10", "--hasta", "2024-02-01"]), 2, "rango · RANGO_INVALIDO");
    const registro = correr("actualizar-fondo.ts", ["--registrar", "--codigo", "FICT-NO-NUMERICO", "--nombre", ""]);
    comprobar(registro, 2, "codigo · CODIGO_FIC_FORMATO", ["FICT-NO-NUMERICO"]);
    expect(registro.texto).toContain("nombre · NOMBRE_FORMATO");
  });

  it("cifrar-existentes: --ayuda, --aplicar sin --base, --lote fuera de rango o --base mal escrita → 2 con su uso", () => {
    const uso = "Uso: npx tsx scripts/cifrar-existentes.ts";
    comprobar(correr("cifrar-existentes.ts", ["--ayuda"]), 2, "Opción desconocida: «--ayuda».");
    comprobar(correr("cifrar-existentes.ts", ["--aplicar"]), 2, "Para escribir hay que nombrar la base");
    comprobar(correr("cifrar-existentes.ts", ["--lote", "0"]), 2, "--lote debe ser un entero entre 1 y 5000.");
    comprobar(correr("cifrar-existentes.ts", ["--re-cifrar", "--base", "Base-Mala"]), 2, uso, ["Base-Mala"]);
  });

  it("lote-escision: --ayuda o un argumento suelto → 2 con sus opciones", () => {
    const opciones = "Argumentos inválidos. Opciones: --destino --fecha-evento --cantidad --costo-unitario";
    comprobar(correr("lote-escision.ts", ["--ayuda"]), 2, opciones);
    comprobar(correr("lote-escision.ts", ["FICTSUELTO"]), 2, opciones, ["FICTSUELTO"]);
  });

  it("registrar-escision: --ayuda → 2; datos mal formados → 2 con el código por campo, sin repetir los valores", () => {
    comprobar(correr("registrar-escision.ts", ["--ayuda"]), 2, "Argumentos inválidos. Opciones: --origen --destino --fecha");
    const s = correr("registrar-escision.ts", ["--origen", "fict-minusculas", "--destino", "FICTDES", "--fecha", "26-02-2024"]);
    comprobar(s, 2, "origen · NEMOTECNICO_FORMATO", ["fict-minusculas", "26-02-2024"]);
    expect(s.texto).toContain("fecha · FECHA_FORMATO");
  });
});

describe("CLI · un error de la base no imprime datos (base inalcanzable)", { timeout: 4 * POR_CLI_MS }, () => {
  it("importar-trii con correo y archivo → 1 con solo la clase del error, sin correo, archivo ni URL", () => {
    const s = correr("importar-trii.ts", ["--email", "dueno-cli@ejemplo.invalid", "extracto-cli.ficticio.csv"]);
    comprobar(s, 1, "❌ La importación falló: PrismaClientInitializationError", ["dueno-cli@ejemplo.invalid", "extracto-cli.ficticio.csv"]);
  });

  it("lote-escision con datos bien formados → 1 «ERROR_BASE», sin los datos del lote", () => {
    const s = correr("lote-escision.ts", ["--destino", "FICTLOTE", "--fecha-evento", "2024-02-26", "--cantidad", "777", "--costo-unitario", "12345.5"]);
    comprobar(s, 1, "❌ No se registró: ERROR_BASE", ["FICTLOTE", "2024-02-26", "777", "12345"]);
  });

  it("registrar-escision con datos bien formados → 1 «ERROR_BASE», sin los datos del evento", () => {
    const args = ["--origen", "FICTORI", "--destino", "FICTDES", "--fecha", "2024-02-26", "--nota", "nota ficticia reservada"];
    comprobar(correr("registrar-escision.ts", args), 1, "❌ No se registró: ERROR_BASE", ["FICTORI", "FICTDES", "2024-02-26", "nota ficticia"]);
  });
});
