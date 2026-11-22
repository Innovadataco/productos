// Lector estricto común de las opciones de los CLI (src/cli/opciones.ts): lo que estaba copiado en los argumentos de
// la vía B de los precios, del fondo y de las series, y en los de los exportadores de BanRep y de la TRM. Fija el
// orden de los chequeos, los mensajes exactos (nunca repiten una ruta, una fecha ni un correo: a lo sumo el nombre de
// una opción), el aviso de npm como parámetro y la identidad de la clase de error por sus dos rutas de import.
// Datos inventados.
import { describe, expect, it } from "vitest";
import {
  ErrorArgumentosCarga, avisoNpmRun, exigirRango, fechaDeOpcion, leerConParseArgs, leerOpciones, mensajeDesconocida,
  opcionRequerida, tomadaPorNpm, variableDeNpm,
} from "@/cli/opciones";
import { ErrorArgumentosCarga as ErrorPorPrecios } from "@/precios/argumentos-carga";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const RUTA = "/carpeta-ficticia/lista.ficticio.txt";
const OPCIONES = { "--lista": "una ruta", "--desde": "una fecha AAAA-MM-DD", "--hasta-dia": "una fecha AAAA-MM-DD" } as const;

function mensaje(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorArgumentosCarga);
    return (e as Error).message;
  }
  throw new Error("no lanzó");
}

describe("ErrorArgumentosCarga", () => {
  it("es la misma clase por src/cli/opciones y por src/precios/argumentos-carga (los scripts deciden la salida 2 con instanceof)", () => {
    expect(ErrorPorPrecios).toBe(ErrorArgumentosCarga);
    const e = new ErrorArgumentosCarga("x");
    expect(e).toBeInstanceOf(ErrorPorPrecios);
    expect(e.name).toBe("ErrorArgumentosCarga");
  });
});

describe("variableDeNpm y tomadaPorNpm", () => {
  it("npm deja la opción en npm_config_<nombre>, con «_» por «-»", () => {
    expect(variableDeNpm("--desde")).toBe("npm_config_desde");
    expect(variableDeNpm("--crear-dueno")).toBe("npm_config_crear_dueno");
  });

  it("la primera opción, en el orden dado, que npm se quedó y no llegó en argv", () => {
    const entorno = { npm_config_hasta_dia: "2027-03-09", npm_config_lista: RUTA };
    expect(tomadaPorNpm(["--lista", "--hasta-dia"], [], entorno)).toBe("--lista");
    expect(tomadaPorNpm(["--hasta-dia", "--lista"], [], entorno)).toBe("--hasta-dia");
    expect(tomadaPorNpm(["--lista", "--hasta-dia"], ["--lista", RUTA], entorno)).toBe("--hasta-dia");
    expect(tomadaPorNpm(["--lista"], ["--lista", RUTA], entorno)).toBeUndefined();
    expect(tomadaPorNpm(["--lista"], [], {})).toBeUndefined();
  });
});

describe("mensajeDesconocida", () => {
  it.each([
    ["--ayuda", "Opción desconocida: «--ayuda»."],
    ["-x", "Opción desconocida: «-x»."],
    [`--lista=${RUTA}`, "Opción desconocida: «--lista»."],
    ["--", "Opción desconocida."],
    ["--a\u001b[2Jb", "Opción desconocida."],
    [`--${"a".repeat(32)}`, "Opción desconocida."],
    ["--Mayus", "Opción desconocida."],
  ])("%j → %s (solo repite un nombre con forma de opción)", (argumento, esperado) => {
    expect(mensajeDesconocida(argumento)).toBe(esperado);
  });
});

describe("leerOpciones", () => {
  const leer = (argv: readonly string[], entorno: Record<string, string> = {}) => leerOpciones(argv, OPCIONES, entorno);

  it("cada opción con su valor, en cualquier orden; las que no llegaron no están", () => {
    const v = leer(["--desde", "2027-03-02", "--lista", RUTA]);
    expect([...v.entries()]).toEqual([["--desde", "2027-03-02"], ["--lista", RUTA]]);
    expect(v.has("--hasta-dia")).toBe(false);
  });

  it.each([
    ["un suelto", [RUTA], "Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción)."],
    ["una desconocida", ["--otra", RUTA], "Opción desconocida: «--otra»."],
    ["--opcion=valor", [`--lista=${RUTA}`], "Opción desconocida: «--lista»."],
    ["«--» solo", ["--"], "Opción desconocida."],
    ["una repetida", ["--lista", RUTA, "--lista", RUTA], "--lista está repetida."],
    ["sin valor", ["--lista"], "--lista necesita una ruta (no una opción ni algo que empiece por «-»)."],
    ["otra opción como valor", ["--desde", "--lista"], "--desde necesita una fecha AAAA-MM-DD (no una opción ni algo que empiece por «-»)."],
    ["un valor con «-»", ["--lista", "-a.txt"], "--lista necesita una ruta (no una opción ni algo que empiece por «-»)."],
  ])("%s: el mensaje exacto, sin repetir la ruta", (_n, argv, esperado) => {
    const m = mensaje(() => leer(argv));
    expect(m).toBe(esperado);
    expect(m).not.toContain("ficticio");
  });

  it("los chequeos van en orden: suelto → desconocida → repetida → valor", () => {
    expect(mensaje(() => leer(["--lista", RUTA, "suelto", "--otra"]))).toContain("Argumento suelto");
    expect(mensaje(() => leer(["--lista", RUTA, "--otra", "--lista"]))).toBe("Opción desconocida: «--otra».");
    expect(mensaje(() => leer(["--lista", RUTA, "--lista", "-x"]))).toBe("--lista está repetida.");
  });

  it("npm se quedó con una opción: el aviso va antes que todo lo demás, con el texto por defecto", () => {
    expect(mensaje(() => leer(["suelto"], { npm_config_hasta_dia: "2027-03-09" }))).toBe(avisoNpmRun("--hasta-dia"));
    expect(avisoNpmRun("--hasta-dia")).toBe("npm se quedó con --hasta-dia: escriba «npm run -s <comando> -- --hasta-dia …» (con «--»).");
  });

  it("el aviso de npm es un parámetro (el de BanRep dice su comando)", () => {
    const aviso = (opcion: string) => `aviso propio de ${opcion}`;
    expect(mensaje(() => leerOpciones([], OPCIONES, { npm_config_lista: RUTA }, aviso))).toBe("aviso propio de --lista");
  });

  it("con la opción en argv, la variable de npm no bloquea", () => {
    expect(leer(["--lista", RUTA], { npm_config_lista: RUTA }).get("--lista")).toBe(RUTA);
  });

  it("sin argumentos: un mapa vacío", () => {
    expect(leer([]).size).toBe(0);
  });
});

describe("opcionRequerida", () => {
  it("el valor, o «Falta <opción> <tipo>.»", () => {
    const v = leerOpciones(["--lista", RUTA], OPCIONES, {});
    expect(opcionRequerida(v, "--lista", "lista.txt")).toBe(RUTA);
    expect(mensaje(() => opcionRequerida(v, "--desde", "AAAA-MM-DD"))).toBe("Falta --desde <AAAA-MM-DD>.");
  });
});

describe("fechaDeOpcion", () => {
  it("una fecha AAAA-MM-DD exacta, de negocio (medianoche UTC); sin valor, undefined", () => {
    expect(fechaDeOpcion("2027-03-02", "--desde")).toEqual(utc("2027-03-02"));
    expect(fechaDeOpcion(undefined, "--desde")).toBeUndefined();
  });

  it.each(["2027-3-2", " 2027-03-02", "2027-03-02 ", "2027-02-30", "02/03/2027", "2027-03-02T00:00"])("%j se rechaza sin repetir la fecha", (texto) => {
    expect(mensaje(() => fechaDeOpcion(texto, "--hasta-dia"))).toBe("--hasta-dia debe ser una fecha AAAA-MM-DD válida.");
  });
});

describe("exigirRango", () => {
  const TOPE = utc("2027-03-19");

  it("--desde ≤ --hasta ≤ tope y a lo sumo maxDias entre los dos: pasa", () => {
    expect(() => exigirRango(utc("2027-03-02"), TOPE, TOPE, 17)).not.toThrow();
    expect(() => exigirRango(TOPE, TOPE, TOPE, 0)).not.toThrow();
  });

  it("al revés o pasado del tope: el mensaje dice el tope («hoy» por defecto)", () => {
    expect(mensaje(() => exigirRango(utc("2027-03-11"), utc("2027-03-02"), TOPE, 37))).toBe("Rango inválido: --desde ≤ --hasta ≤ hoy.");
    expect(mensaje(() => exigirRango(utc("2027-03-02"), utc("2027-03-23"), TOPE, 37))).toBe("Rango inválido: --desde ≤ --hasta ≤ hoy.");
    expect(mensaje(() => exigirRango(utc("2027-03-02"), utc("2027-03-23"), TOPE, 37, "hoy + 3 día(s)"))).toBe("Rango inválido: --desde ≤ --hasta ≤ hoy + 3 día(s).");
  });

  it("más de maxDias: pídalo por tramos (el orden se mira antes)", () => {
    expect(mensaje(() => exigirRango(utc("2027-03-01"), TOPE, TOPE, 17))).toBe("Rango inválido: más de 17 días (pídalo por tramos).");
    expect(mensaje(() => exigirRango(utc("2027-03-11"), utc("2027-03-02"), TOPE, 0))).toBe("Rango inválido: --desde ≤ --hasta ≤ hoy.");
  });
});

describe("leerConParseArgs (familia parseArgs con tokens: decretos, rendimientos y movimiento del fondo)", () => {
  const OPCIONES_PA = { archivo: { type: "string" }, email: { type: "string" }, aplicar: { type: "boolean" } } as const;
  const leer = (argv: readonly string[]) => leerConParseArgs(argv, OPCIONES_PA);

  it("los valores y ninguna repetida", () => {
    expect(leer(["--archivo", RUTA, "--aplicar"])).toEqual({ valores: { archivo: RUTA, aplicar: true }, repetidas: [] });
    expect(leer([])).toEqual({ valores: {}, repetidas: [] });
  });

  it.each([
    ["una desconocida", ["--otra", "x"]],
    ["un suelto", [RUTA]],
    ["«--» solo", ["--"]],
    ["«--» y un suelto", ["--archivo", RUTA, "--", "x"]],
    ["un valor que parece opción", ["--archivo", "--email"]],
    ["una bandera con valor", ["--aplicar=si"]],
  ])("%s: null (el error de parseArgs no se muestra)", (_n, argv) => {
    expect(leer(argv)).toBeNull();
  });

  it("las repetidas, una vez cada una y en el orden de su segunda aparición", () => {
    const r = leer(["--email", "a@x.invalid", "--archivo", RUTA, "--archivo", RUTA, "--email", "b@x.invalid", "--archivo", RUTA, "--aplicar"]);
    expect(r?.repetidas).toEqual(["archivo", "email"]);
  });

  it("--opcion=valor sí lo admite parseArgs (cada módulo valida el valor)", () => {
    expect(leer([`--archivo=-${RUTA}`])?.valores).toEqual({ archivo: `-${RUTA}` });
  });
});
