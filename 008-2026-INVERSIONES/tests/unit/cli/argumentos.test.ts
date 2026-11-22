// Los CLI de 008 como proceso (hueco de pruebas): con argumentos inválidos o con --ayuda (que ninguno
// implementa: es una opción desconocida) salen con 2 y su uso, ANTES de tocar la base; y ningún error
// imprime datos. La base es inalcanzable a propósito (puerto 1 de 127.0.0.1): si un CLI la tocara, saldría
// con 1 y un PrismaClientInitializationError, no con 2. El entorno del hijo es mínimo: no hereda la
// DATABASE_URL ni las claves de quien corre las pruebas. Sin red. Datos inventados.
// Fuera de aquí: actualizar-precios.ts (frente de precios) y construir-lotes.ts (frente de lotes).
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../../ayudas/cli";

const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
/** Lo que nunca debe salir en la consola de un CLI: la URL de la base, su host y su clave. */
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];
const ENTORNO = entornoMinimo({ DATABASE_URL: INALCANZABLE });

const correr = (script: string, args: readonly string[]): Salida => correrCli(script, args, ENTORNO);

/** Un CSV que existe (importar-trii revisa los archivos antes de abrir la base); su contenido no se llega a leer. */
const carpeta = mkdtempSync(join(tmpdir(), "inv008-cli-unit-"));
const existente = join(carpeta, "extracto-cli.ficticio.csv");
writeFileSync(existente, "Fecha y hora,Ticker,Estado,Valor total\n");
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

/** Sale con `codigo`, dice `esperado`, un 2 no llegó a la base, y no imprime nada de `ademas` ni de la URL. */
function comprobar(s: Salida, codigo: number, esperado: string, ademas: readonly string[] = []): void {
  comprobarSalida(s, codigo, esperado, [...NUNCA, ...ademas]);
  if (codigo === 2) expect(s.texto, "un 2 no debe haber intentado la base").not.toContain("PrismaClient");
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

  // Datos mal formados → 2 en registrar-escision y, desde O2, también en lote-escision (sus casos, en
  // tests/unit/cli/escision-proceso.test.ts).
  it("registrar-escision: --ayuda → 2; datos mal formados → 2 con el código por campo, sin repetir los valores", () => {
    comprobar(correr("registrar-escision.ts", ["--ayuda"]), 2, "Argumentos inválidos. Opciones: --origen --destino --fecha");
    const s = correr("registrar-escision.ts", ["--origen", "fict-minusculas", "--destino", "FICTDES", "--fecha", "26-02-2024"]);
    comprobar(s, 2, "origen · NEMOTECNICO_FORMATO", ["fict-minusculas", "26-02-2024"]);
    expect(s.texto).toContain("fecha · FECHA_FORMATO");
  });
});

// O1: importar-trii tomaba la opción siguiente a --email como el correo (`--email --crear-dueno a.csv`) y, sin
// dueño, creaba un DUENO con ese «correo». Ahora todo argumento raro sale con 2 y el uso ANTES de abrir la base
// (con la base inalcanzable, tocarla daría 1). Tampoco sigue si npm se quedó con una opción (sin «--»).
describe("CLI importar-trii · argumentos estrictos (O1, sin base)", { timeout: 12 * POR_CLI_MS }, () => {
  const uso = "Uso: npm run importar:trii -- --email";
  const correo = "dueno-o1@ejemplo.invalid";
  const archivo = "extracto-o1.ficticio.csv";

  it("una opción en el lugar del correo (--email --crear-dueno) → 2 con el uso, sin tocar la base", () => {
    comprobar(correr("importar-trii.ts", ["--email", "--crear-dueno", archivo]), 2, uso, [archivo]);
    comprobar(correr("importar-trii.ts", ["--crear-dueno", "--email", "--ficticia", archivo]), 2, uso, [archivo]);
  });

  it("un correo mal formado → 2 con el uso, sin repetirlo", () => {
    for (const malo of ["no-es-correo", "-dueno-o1@ejemplo.invalid", "dueno o1@ejemplo.invalid", ""]) {
      comprobar(correr("importar-trii.ts", ["--email", malo, archivo]), 2, uso, malo ? [malo, archivo] : [archivo]);
    }
  });

  it("una opción desconocida, repetida o mal formada → 2 con el uso", () => {
    for (const argv of [
      ["--email", correo, "--crear-duenno", archivo],
      ["--email", correo, "--email", "otro-o1@ejemplo.invalid", archivo],
      ["--email", correo, "--crear-dueno", "--crear-dueno", archivo],
      [`--email=${correo}`, archivo],
      ["-e", correo, archivo],
      ["--email", correo, "--", archivo],
    ]) {
      comprobar(correr("importar-trii.ts", argv), 2, uso, [correo, archivo]);
    }
  });

  // `npm run importar:trii --email c --crear-dueno a.csv` (sin «--»): npm deja argv = [c, a.csv] y las opciones en
  // npm_config_email / npm_config_crear_dueno ("true", o "" con `--x=false`). Decisión G5 (B): sale con 2 si la
  // variable está y la opción NO llegó en argv; una `email=` del .npmrc no bloquea el uso correcto con «--».
  it("npm se quedó con una opción (npm_config_* y la opción ausente de argv) → 2 y cómo escribirlo", () => {
    for (const valor of ["true", ""]) {
      const sinDueno = correrCli("importar-trii.ts", ["--email", correo, archivo], { ...ENTORNO, npm_config_crear_dueno: valor });
      comprobar(sinDueno, 2, "npm se quedó con --crear-dueno", [correo, archivo]);
      expect(sinDueno.texto).toContain("npm run importar:trii -- --email");
      const sinEmail = correrCli("importar-trii.ts", [correo, archivo], { ...ENTORNO, npm_config_email: valor });
      comprobar(sinEmail, 2, "npm se quedó con --email", [correo, archivo]);
    }
  });

  it("un archivo que no existe → 2 antes de abrir la base, sin su nombre ni su ruta (G4)", () => {
    const s = correr("importar-trii.ts", ["--email", correo, "--crear-dueno", join(carpeta, archivo)]);
    comprobar(s, 2, "El archivo 1 de 1 no existe o no es un archivo", [correo, archivo, carpeta]);
    const dos = correr("importar-trii.ts", ["--email", correo, existente, join(carpeta, archivo)]);
    comprobar(dos, 2, "El archivo 2 de 2 no existe o no es un archivo", [correo, archivo, carpeta]);
    comprobar(correr("importar-trii.ts", ["--email", correo, carpeta]), 2, "El archivo 1 de 1 no existe o no es un archivo", [correo, carpeta]);
  });

  // Revisión de seguridad (M1): ni un archivo que no se puede leer ni uno de más de 5 MB deben dejar creado el dueño.
  it("un archivo que existe pero no se puede leer → 2 antes de abrir la base, sin su nombre", () => {
    const cerrado = join(carpeta, "cerrado-o1.ficticio.csv");
    writeFileSync(cerrado, "Fecha y hora,Ticker,Estado,Valor total\n");
    chmodSync(cerrado, 0o000);
    try {
      comprobar(correr("importar-trii.ts", ["--email", correo, "--crear-dueno", cerrado]), 2, "El archivo 1 de 1 no se pudo leer. No se tocó la base.", [correo, "cerrado-o1", carpeta]);
    } finally {
      chmodSync(cerrado, 0o600);
    }
  });

  it("si todos los archivos pasan de 5 MB sale con 1 SIN abrir la base (no crea el dueño); el aviso sigue por archivo", () => {
    const grande = join(carpeta, "grande-o1.ficticio.csv");
    writeFileSync(grande, Buffer.alloc(5 * 1024 * 1024 + 1, 0x41));
    const s = correr("importar-trii.ts", ["--email", correo, "--crear-dueno", grande]);
    comprobar(s, 1, "❌ grande-o1.ficticio.csv: pasa de 5 MB, no se importa.", [correo, carpeta]);
    expect(s.texto, "no debe haber abierto la base").not.toContain("PrismaClient");
    const mixto = correr("importar-trii.ts", ["--email", correo, grande, existente]);
    comprobar(mixto, 1, "❌ grande-o1.ficticio.csv: pasa de 5 MB, no se importa.", [correo, carpeta]);
    expect(mixto.texto, "con uno importable sí abre la base").toContain("PrismaClientInitializationError");
  });
});

// crear-acceso-inicial también crea el dueño: con la misma lupa, un valor que empieza por «-» nunca es el correo.
describe("CLI crear-acceso-inicial e importar-plan · una opción nunca es el correo (O1, sin base)", { timeout: 4 * POR_CLI_MS }, () => {
  it("crear-acceso-inicial --email <valor que empieza por «-»> → 2 con el uso, sin tocar la base", () => {
    const uso = "Uso: npx tsx scripts/crear-acceso-inicial.ts --email";
    comprobar(correr("crear-acceso-inicial.ts", ["--email", "--reiniciar-totp"]), 2, uso);
    comprobar(correr("crear-acceso-inicial.ts", ["--email", "--dueno-o1@ejemplo.invalid"]), 2, uso, ["--dueno-o1@ejemplo.invalid"]);
    comprobar(correr("crear-acceso-inicial.ts", ["--email", "-dueno-o1@ejemplo.invalid"]), 2, uso, ["-dueno-o1@ejemplo.invalid"]);
  });

  it("importar-plan --email --aplicar → 2 con el uso (no toma la opción como correo)", () => {
    comprobar(correr("importar-plan.ts", ["--ficha", "f.ficticio.md", "--email", "--aplicar"]), 2, "Uso: npx tsx scripts/importar-plan.ts --ficha");
  });
});

describe("CLI · un error de la base no imprime datos (base inalcanzable)", { timeout: 4 * POR_CLI_MS }, () => {
  it("importar-trii con correo y archivo → 1 con solo la clase del error, sin correo, archivo ni URL", () => {
    const s = correr("importar-trii.ts", ["--email", "dueno-cli@ejemplo.invalid", existente]);
    comprobar(s, 1, "❌ La importación falló: PrismaClientInitializationError", ["dueno-cli@ejemplo.invalid", "extracto-cli.ficticio.csv", carpeta]);
  });

  it("importar-trii con «--» bien puesto y un email= en el .npmrc (npm_config_email) no se bloquea: llega a la base (G5)", () => {
    const s = correrCli("importar-trii.ts", ["--email", "dueno-cli@ejemplo.invalid", existente], { ...ENTORNO, npm_config_email: "otro-rc@ejemplo.invalid" });
    comprobar(s, 1, "❌ La importación falló: PrismaClientInitializationError", ["dueno-cli@ejemplo.invalid", "otro-rc@ejemplo.invalid", carpeta]);
  });

  it("lote-escision con datos bien formados → 1 «ERROR_BASE», sin los datos del lote", () => {
    const s = correr("lote-escision.ts", ["--destino", "FICTLOTE", "--fecha-evento", "2027-03-17", "--cantidad", "4613", "--costo-unitario", "1237.53"]);
    comprobar(s, 1, "❌ No se pudo confirmar el registro: ERROR_BASE", ["FICTLOTE", "2027-03-17", "4613", "1237"]);
  });

  it("registrar-escision con datos bien formados → 1 «ERROR_BASE», sin los datos del evento", () => {
    const args = ["--origen", "FICTORI", "--destino", "FICTDES", "--fecha", "2027-03-17", "--nota", "nota ficticia reservada"];
    comprobar(correr("registrar-escision.ts", args), 1, "❌ No se pudo confirmar el registro: ERROR_BASE", ["FICTORI", "FICTDES", "2027-03-17", "nota ficticia"]);
  });
});
