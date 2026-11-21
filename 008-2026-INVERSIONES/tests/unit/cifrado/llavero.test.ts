// Contrato de las claves con versión (#11): CIFRADO_CLAVE_ACTIVA=v<n> y CIFRADO_CLAVE_V<n> en base64.
// Todas las claves son aleatorias, generadas aquí.
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorCifrado } from "@/cifrado/errores";
import { obtenerLlavero } from "@/cifrado/llavero";

const b64 = (n = 32) => randomBytes(n).toString("base64");

/** El error que lanza `f`, para afirmar su código y que su mensaje no trae el valor. */
function errorDe(f: () => unknown): ErrorCifrado {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorCifrado) return e;
    throw new Error(`se esperaba ErrorCifrado y llegó ${String(e)}`);
  }
  throw new Error("se esperaba ErrorCifrado y no hubo error");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("obtenerLlavero · qué carga", () => {
  it("la activa y su clave de 32 bytes", () => {
    const v1 = b64();
    const llavero = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: v1 });
    expect(llavero.activa).toBe("v1");
    expect(llavero.claves.get("v1")?.equals(Buffer.from(v1, "base64"))).toBe(true);
  });

  it("varias versiones: cifra con la activa y conserva las otras para descifrar", () => {
    const llavero = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v2", CIFRADO_CLAVE_V1: b64(), CIFRADO_CLAVE_V2: b64(), CIFRADO_CLAVE_V10: b64() });
    expect(llavero.activa).toBe("v2");
    expect([...llavero.claves.keys()].sort()).toEqual(["v1", "v10", "v2"]);
  });

  it("acepta versiones de hasta 6 dígitos (v999999)", () => {
    expect(obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v999999", CIFRADO_CLAVE_V999999: b64() }).activa).toBe("v999999");
  });

  it("recorta espacios y saltos de línea alrededor de los valores", () => {
    const v1 = b64();
    const llavero = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: " v1 ", CIFRADO_CLAVE_V1: `${v1}\n` });
    expect(llavero.claves.get("v1")?.equals(Buffer.from(v1, "base64"))).toBe(true);
  });

  it("una versión vacía no se carga (cuenta como ausente)", () => {
    const llavero = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: b64(), CIFRADO_CLAVE_V2: "" });
    expect([...llavero.claves.keys()]).toEqual(["v1"]);
  });

  it("con la misma entrada devuelve el llavero en caché; con otra, uno nuevo", () => {
    const entorno = { CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: b64() };
    expect(obtenerLlavero({ ...entorno })).toBe(obtenerLlavero({ ...entorno }));
    expect(obtenerLlavero({ ...entorno, CIFRADO_CLAVE_V1: b64() })).not.toBe(obtenerLlavero(entorno));
  });
});

describe("obtenerLlavero · falla cerrado, con código y sin el valor", () => {
  it("sin CIFRADO_CLAVE_ACTIVA: CLAVE_ACTIVA_AUSENTE, aunque haya claves", () => {
    expect(errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_V1: b64() })).codigo).toBe("CLAVE_ACTIVA_AUSENTE");
    expect(errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "  ", CIFRADO_CLAVE_V1: b64() })).codigo).toBe("CLAVE_ACTIVA_AUSENTE");
  });

  it("las variables retiradas (CIFRADO_CLAVE, CIFRADO_CLAVE_FILE) ya no cuentan: CLAVE_ACTIVA_AUSENTE", () => {
    expect(errorDe(() => obtenerLlavero({ CIFRADO_CLAVE: b64(), CIFRADO_CLAVE_FILE: "/ruta/ficticia" })).codigo).toBe("CLAVE_ACTIVA_AUSENTE");
  });

  it.each(["1", "V1", "v0", "v01", "v-1", "v1.0", "uno", "v1234567"])("activa mal escrita («%s»): CLAVE_ACTIVA_INVALIDA", (activa) => {
    expect(errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: activa, CIFRADO_CLAVE_V1: b64() })).codigo).toBe("CLAVE_ACTIVA_INVALIDA");
  });

  it("la activa sin su CIFRADO_CLAVE_V<n>: CLAVE_AUSENTE", () => {
    const e = errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v2", CIFRADO_CLAVE_V1: b64() }));
    expect(e.codigo).toBe("CLAVE_AUSENTE");
    expect(e.message).toContain("v2");
  });

  it.each([
    ["31 bytes", b64(31)],
    ["33 bytes", b64(33)],
    ["sin relleno", b64().replace(/=+$/, "")],
    ["alfabeto URL (- y _)", `${b64().slice(0, 41)}-_=`],
    ["con espacios adentro", `${b64().slice(0, 20)} ${b64().slice(20)}`],
    ["texto que no es base64", "esto-no-es-una-clave-de-32-bytes!!!!!!!!!!!"],
    ["32 caracteres UTF-8 (PI los acepta; aquí no)", "x".repeat(32)],
  ])("una clave inválida (%s) hace fallar, aunque no sea la activa: CLAVE_INVALIDA sin el valor", (_caso, valor) => {
    const e = errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: b64(), CIFRADO_CLAVE_V2: valor }));
    expect(e.codigo).toBe("CLAVE_INVALIDA");
    expect(e.message).toContain("v2");
    expect(e.message).not.toContain(valor.trim());
  });

  it.each(["CIFRADO_CLAVE_V0", "CIFRADO_CLAVE_V01", "CIFRADO_CLAVE_VX", "CIFRADO_CLAVE_V1_VIEJA", "CIFRADO_CLAVE_V1234567"])(
    "una variable con nombre de versión mal escrito (%s): CLAVE_NOMBRE_INVALIDO",
    (nombre) => {
      const valor = b64();
      const e = errorDe(() => obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: b64(), [nombre]: valor }));
      expect(e.codigo).toBe("CLAVE_NOMBRE_INVALIDO");
      expect(e.message).not.toContain(valor);
    },
  );

  it("el error se llama ErrorCifrado y no trae causa (el CLI de importación imprime nombre y código)", () => {
    const e = errorDe(() => obtenerLlavero({}));
    expect(e.name).toBe("ErrorCifrado");
    expect(e.cause).toBeUndefined();
  });
});

describe("producción (NODE_ENV=production)", () => {
  it("importar los módulos sin claves NO lanza (next build corre sin secretos); cifrar sí, al usarlo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "");
    vi.resetModules();
    const campos = await import("@/cifrado/campos");
    const errores = await import("@/cifrado/errores");
    let codigo = "sin error";
    try {
      campos.cifrarCrudo({ "Valor total": "1.00" }, { tipoFuente: "TRII_CAJA", claveNatural: "0".repeat(64), ocurrencia: 1 });
    } catch (e) {
      codigo = e instanceof errores.ErrorCifrado ? e.codigo : String(e);
    }
    expect(codigo).toBe("CLAVE_ACTIVA_AUSENTE");
  });

  it("con la activa sin su clave también falla al usarla, no al importar", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CIFRADO_CLAVE_ACTIVA", "v3");
    vi.resetModules();
    const { obtenerLlavero: obtener } = await import("@/cifrado/llavero");
    const { ErrorCifrado: Err } = await import("@/cifrado/errores");
    let codigo = "sin error";
    try {
      obtener();
    } catch (e) {
      codigo = e instanceof Err ? e.codigo : String(e);
    }
    expect(codigo).toBe("CLAVE_AUSENTE");
  });
});
