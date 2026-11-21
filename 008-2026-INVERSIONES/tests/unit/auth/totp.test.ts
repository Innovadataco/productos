// TOTP del dueño (RFC 6238 sobre HOTP de RFC 4226): HMAC-SHA1, pasos de 30 s, 6 dígitos y ventana de
// ±1 paso, con antireplay por el último paso usado. Se prueba contra los vectores de los dos RFC y los
// de base32 de RFC 4648. El secreto de los vectores es el del RFC (público), no uno real.
import { describe, expect, it } from "vitest";
import { TOTP_DIGITOS, TOTP_PERIODO_S, TOTP_SECRETO_BYTES, TOTP_VENTANA } from "@/auth/limites";
import {
  ALFABETO_CROCKFORD,
  codificarBase32,
  decodificarBase32,
  formaDeCodigoTotp,
  generarSecretoTotp,
  hotp,
  normalizarCodigoTotp,
  pasoDe,
  sinRelleno,
  uriOtpauth,
  verificarTotp,
} from "@/auth/totp";

/** El secreto de los apéndices de RFC 4226 y RFC 6238 (SHA-1): «12345678901234567890» en ASCII. */
const SECRETO_RFC = Buffer.from("12345678901234567890", "ascii");
const S = 1000;

describe("parámetros", () => {
  it("son los de las apps comunes: SHA-1, 30 s, 6 dígitos, ±1 paso y 160 bits de secreto", () => {
    expect(TOTP_PERIODO_S).toBe(30);
    expect(TOTP_DIGITOS).toBe(6);
    expect(TOTP_VENTANA).toBe(1);
    expect(TOTP_SECRETO_BYTES * 8).toBeGreaterThanOrEqual(160);
  });
});

describe("hotp (RFC 4226, apéndice D)", () => {
  const ESPERADOS = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  it.each(ESPERADOS.map((codigo, contador) => [contador, codigo] as const))("contador %i → %s", (contador, codigo) => {
    expect(hotp(SECRETO_RFC, contador)).toBe(codigo);
  });
});

describe("totp (RFC 6238, apéndice B, SHA-1)", () => {
  const VECTORES = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const;
  it.each(VECTORES)("en t = %i s el código de 8 dígitos es %s", (t, codigo) => {
    expect(hotp(SECRETO_RFC, pasoDe(t * S), 8)).toBe(codigo);
  });
  it.each(VECTORES)("en t = %i s el de 6 dígitos son los últimos 6 de %s", (t, codigo) => {
    expect(hotp(SECRETO_RFC, pasoDe(t * S))).toBe(codigo.slice(-6));
  });
  it("el paso es el entero de t / 30", () => {
    expect(pasoDe(0)).toBe(0);
    expect(pasoDe(29_999)).toBe(0);
    expect(pasoDe(30_000)).toBe(1);
    expect(pasoDe(20000000000 * S)).toBe(666666666);
  });
});

describe("base32 (RFC 4648, §10)", () => {
  const VECTORES = [
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ] as const;
  it.each(VECTORES)("«%s» se codifica «%s» y vuelve igual", (texto, base32) => {
    expect(codificarBase32(Buffer.from(texto, "ascii"))).toBe(base32);
    expect(decodificarBase32(base32)?.toString("ascii")).toBe(texto);
  });
  it("acepta la forma sin relleno (la del otpauth)", () => {
    expect(decodificarBase32("MZXW6YTBOI")?.toString("ascii")).toBe("foobar");
  });
  it.each(["mzxw6ytb", "MZXW6YT1", "MZXW6YTB=", "MZXW6YQ==", "M", "MZX", "MZXW 6YTB", "MZ======"])("rechaza «%s» (no canónico o fuera del alfabeto)", (texto) => {
    expect(decodificarBase32(texto)).toBeNull();
  });
  it("el secreto del RFC en base32 es el conocido", () => {
    expect(codificarBase32(SECRETO_RFC)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
});

describe("base32 con otro alfabeto y sin relleno", () => {
  it("con el alfabeto de Crockford, 10 bytes dan 16 caracteres sin relleno", () => {
    expect(ALFABETO_CROCKFORD).toBe("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    expect(codificarBase32(Buffer.alloc(10, 0xff), ALFABETO_CROCKFORD)).toBe("ZZZZZZZZZZZZZZZZ");
    expect(codificarBase32(Buffer.alloc(10, 0), ALFABETO_CROCKFORD)).toBe("0000000000000000");
  });

  it("sinRelleno quita solo el relleno final", () => {
    expect(sinRelleno("MZXW6YTBOI======")).toBe("MZXW6YTBOI");
    expect(sinRelleno("MZXW6YTB")).toBe("MZXW6YTB");
  });
});

describe("normalizarCodigoTotp", () => {
  it.each([
    ["287082", "287082"],
    ["287 082", "287082"],
    [" 287082 ", "287082"],
    ["28 70 82", "287082"],
    ["287\u00a0082", "287082"],
  ])("«%s» → %s", (entrada, salida) => {
    expect(normalizarCodigoTotp(entrada)).toBe(salida);
  });

  it.each(["", "28708", "2870820", "287-082", "28708a", "２８７０８２"])("«%s» no es un código TOTP", (entrada) => {
    expect(normalizarCodigoTotp(entrada)).toBeNull();
  });
});

describe("verificarTotp", () => {
  /** t = 59 s: paso 1. Los códigos de los pasos 0, 1 y 2 son los del apéndice D. */
  const AHORA = 59 * S;
  const DE_PASO = (p: number) => hotp(SECRETO_RFC, p);

  it("acepta el código del paso actual y devuelve ese paso", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(1), AHORA, null)).toEqual({ ok: true, paso: 1 });
  });

  it("acepta un paso antes y uno después (ventana ±1)", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(0), AHORA, null)).toEqual({ ok: true, paso: 0 });
    expect(verificarTotp(SECRETO_RFC, DE_PASO(2), AHORA, null)).toEqual({ ok: true, paso: 2 });
  });

  it("rechaza un código de dos pasos después", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(3), AHORA, null)).toEqual({ ok: false, motivo: "INCORRECTO" });
  });

  it("rechaza un código de dos pasos antes", () => {
    const despues = 4 * 30 * S;
    expect(verificarTotp(SECRETO_RFC, DE_PASO(2), despues, null)).toEqual({ ok: false, motivo: "INCORRECTO" });
  });

  it("antireplay: el mismo paso, o uno anterior, ya no entra (REPETIDO)", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(1), AHORA, 1)).toEqual({ ok: false, motivo: "REPETIDO" });
    expect(verificarTotp(SECRETO_RFC, DE_PASO(0), AHORA, 1)).toEqual({ ok: false, motivo: "REPETIDO" });
  });

  it("antireplay: un paso mayor que el último sí entra", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(2), AHORA, 1)).toEqual({ ok: true, paso: 2 });
  });

  it("un código que no es del secreto es INCORRECTO, no REPETIDO", () => {
    const otro = Buffer.from("otro-secreto-ficticio", "ascii");
    expect(verificarTotp(otro, DE_PASO(1), AHORA, 5)).toEqual({ ok: false, motivo: "INCORRECTO" });
  });

  it.each(["", "28708", "2870820", "28708a", " 287082", "２８７０８２", "-28708"])("«%s» no tiene la forma y es INCORRECTO sin lanzar", (codigo) => {
    expect(formaDeCodigoTotp(codigo)).toBe(false);
    expect(verificarTotp(SECRETO_RFC, codigo, AHORA, null)).toEqual({ ok: false, motivo: "INCORRECTO" });
  });

  it("el paso 0 en el reloj 0 no mira pasos negativos", () => {
    expect(verificarTotp(SECRETO_RFC, DE_PASO(0), 0, null)).toEqual({ ok: true, paso: 0 });
  });
});

describe("secreto y otpauth", () => {
  it("el secreto es aleatorio de 20 bytes", () => {
    const a = generarSecretoTotp();
    const b = generarSecretoTotp();
    expect(a).toHaveLength(TOTP_SECRETO_BYTES);
    expect(a.equals(b)).toBe(false);
  });

  it("el otpauth lleva emisor, cuenta codificada, el base32 sin relleno y los parámetros", () => {
    const uri = uriOtpauth(SECRETO_RFC, "dueno+e2e@ejemplo.invalid");
    expect(uri).toBe(
      "otpauth://totp/Inversiones:dueno%2Be2e%40ejemplo.invalid?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Inversiones&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("una cuenta con «:» o «&» no rompe el otpauth", () => {
    const uri = new URL(uriOtpauth(SECRETO_RFC, "a:b&c@ejemplo.invalid"));
    expect(uri.searchParams.get("issuer")).toBe("Inversiones");
    expect(decodeURIComponent(uri.pathname)).toBe("/Inversiones:a:b&c@ejemplo.invalid");
    expect(uri.pathname).not.toContain("&");
  });
});
