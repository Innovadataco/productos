// Argumentos de scripts/importar-trii.ts (O1), sin proceso: estrictos y puros. Lo que no se reconoce lanza con un
// mensaje que nunca repite correos ni rutas (a lo sumo el nombre de una opción). Datos inventados.
import { describe, expect, it } from "vitest";
import { ErrorArgumentosImportarTrii, USO_IMPORTAR_TRII, leerArgumentosImportarTrii } from "@/cli/argumentos-importar-trii";

const CORREO = "dueno-o1@ejemplo.invalid";
const A = "a.ficticio.csv";
const B = "dir/b.ficticio.csv";
const leer = (argv: readonly string[], entorno: Readonly<Record<string, string | undefined>> = {}) => leerArgumentosImportarTrii(argv, entorno);

/** Lanza ErrorArgumentosImportarTrii con `mensaje` y sin repetir `nunca`. */
function rechaza(argv: readonly string[], mensaje: string | RegExp, entorno: Readonly<Record<string, string | undefined>> = {}, nunca: readonly string[] = [CORREO, A, B]): void {
  let error: unknown;
  try {
    leer(argv, entorno);
  } catch (e) {
    error = e;
  }
  expect(error, JSON.stringify(argv)).toBeInstanceOf(ErrorArgumentosImportarTrii);
  const texto = (error as Error).message;
  if (typeof mensaje === "string") expect(texto, JSON.stringify(argv)).toContain(mensaje);
  else expect(texto, JSON.stringify(argv)).toMatch(mensaje);
  for (const dato of nunca) expect(texto, dato).not.toContain(dato);
}

describe("leerArgumentosImportarTrii · lo válido", () => {
  it("--email y un archivo, en cualquier orden; --crear-dueno opcional", () => {
    expect(leer(["--email", CORREO, A])).toEqual({ email: CORREO, archivos: [A], crearDueno: false });
    expect(leer([A, "--email", CORREO])).toEqual({ email: CORREO, archivos: [A], crearDueno: false });
    expect(leer(["--crear-dueno", "--email", CORREO, A, B])).toEqual({ email: CORREO, archivos: [A, B], crearDueno: true });
    expect(leer([A, "--email", CORREO, B, "--crear-dueno"])).toEqual({ email: CORREO, archivos: [A, B], crearDueno: true });
  });

  it("un email= del .npmrc (npm_config_email) no bloquea si --email llegó en argv (G5)", () => {
    expect(leer(["--email", CORREO, A], { npm_config_email: "otro-rc@ejemplo.invalid" }).email).toBe(CORREO);
    expect(leer(["--email", CORREO, "--crear-dueno", A], { npm_config_crear_dueno: "true" }).crearDueno).toBe(true);
  });

  it("el uso nombra las dos opciones y el «--» de npm", () => {
    expect(USO_IMPORTAR_TRII).toContain("Uso: npm run importar:trii -- --email <correo-del-dueño> [--crear-dueno] <archivo.csv>");
  });
});

describe("leerArgumentosImportarTrii · lo que se rechaza", () => {
  it("una opción o un valor que empieza por «-» en el lugar del correo", () => {
    rechaza(["--email", "--crear-dueno", A], "--email necesita un correo válido");
    rechaza(["--email", "-d@ejemplo.invalid", A], "--email necesita un correo válido", {}, [A, "d@ejemplo.invalid"]);
    rechaza(["--email"], "--email necesita un correo válido");
  });

  it("un correo mal formado, sin repetirlo", () => {
    for (const malo of ["no-es-correo", "a b@ejemplo.invalid", "d\u001b@ejemplo.invalid"]) rechaza(["--email", malo, A], "--email necesita un correo válido", {}, [malo, A]);
  });

  it("opciones repetidas", () => {
    rechaza(["--email", CORREO, "--email", "otro-o1@ejemplo.invalid", A], "--email está repetida", {}, [CORREO, "otro-o1@ejemplo.invalid", A]);
    rechaza(["--email", CORREO, "--crear-dueno", "--crear-dueno", A], "--crear-dueno está repetida");
  });

  it("opciones desconocidas o mal formadas: repite solo el nombre de la opción", () => {
    rechaza(["--email", CORREO, "--crear-duenno", A], "Opción desconocida: «--crear-duenno».");
    rechaza(["-e", CORREO, A], "Opción desconocida: «-e».");
    rechaza([`--email=${CORREO}`, A], "Opción desconocida: «--email».");
    rechaza(["--email", CORREO, "--", A], /^Opción desconocida\.$/);
    rechaza(["--email", CORREO, `--${CORREO}`, A], /^Opción desconocida\.$/);
    rechaza(["--email", CORREO, "--\u001b[2J", A], /^Opción desconocida\.$/);
    rechaza(["--email", CORREO, `--${"x".repeat(40)}`, A], /^Opción desconocida\.$/);
  });

  it("falta --email o falta el archivo", () => {
    rechaza([A], "Falta --email <correo-del-dueño>.");
    rechaza([], "Falta --email <correo-del-dueño>.");
    rechaza(["--email", CORREO], "Falta al menos un archivo .csv.");
    rechaza(["--email", CORREO, "--crear-dueno"], "Falta al menos un archivo .csv.");
  });

  it("npm se quedó con una opción (npm_config_* y la opción ausente de argv), antes que todo lo demás (G5)", () => {
    for (const valor of ["true", "", "false"]) {
      rechaza(["--email", CORREO, A], "npm se quedó con --crear-dueno", { npm_config_crear_dueno: valor });
      rechaza([CORREO, A], "npm se quedó con --email", { npm_config_email: valor });
    }
    rechaza([A], "npm se quedó con --email", { npm_config_email: CORREO });
    rechaza([CORREO, A], "npm run importar:trii -- --email", { npm_config_email: "true" });
  });
});
