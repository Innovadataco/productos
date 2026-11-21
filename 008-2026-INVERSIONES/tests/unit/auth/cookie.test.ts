// La cookie de la sesión (D-014): `__Host-sesion` con HttpOnly, Secure, SameSite=Strict, Path=/ y sin
// Domain, 8 h. El borrado lleva los mismos atributos (si no, el navegador lo rechaza y la sesión sigue).
import { describe, expect, it } from "vitest";
import { NOMBRE_COOKIE, cookieDeBorrado, cookieDeSesion, leerToken } from "@/auth/cookie";

const partes = (setCookie: string) => setCookie.split(";").map((p) => p.trim());

describe("cookie de sesión", () => {
  it("se llama __Host-sesion", () => {
    expect(NOMBRE_COOKIE).toBe("__Host-sesion");
  });

  it("al crearla lleva HttpOnly, Secure, SameSite=Strict, Path=/, 8 h y ningún Domain", () => {
    const p = partes(cookieDeSesion("abc.def.ghi"));
    expect(p[0]).toBe("__Host-sesion=abc.def.ghi");
    expect(p).toEqual(expect.arrayContaining(["Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=28800"]));
    expect(p.some((x) => /^domain=/i.test(x))).toBe(false);
  });

  it("al borrarla lleva los mismos atributos, vacía y vencida", () => {
    const p = partes(cookieDeBorrado());
    expect(p[0]).toBe("__Host-sesion=");
    expect(p).toEqual(expect.arrayContaining(["Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=0"]));
    expect(p.some((x) => /^domain=/i.test(x))).toBe(false);
  });

  it("se niega a escribir un valor que rompería la cabecera", () => {
    expect(() => cookieDeSesion("a;b")).toThrow();
    expect(() => cookieDeSesion("a\r\nSet-Cookie: x=1")).toThrow();
  });
});

describe("leerToken", () => {
  it("toma la cookie por su nombre exacto, no una que lo contenga", () => {
    expect(leerToken("x__Host-sesion=falso; __Host-sesion=real; otra=1")).toBe("real");
    expect(leerToken("sesion=falso; __Host-sesionx=falso")).toBeUndefined();
  });

  it("sin cabecera o sin la cookie devuelve undefined", () => {
    expect(leerToken(null)).toBeUndefined();
    expect(leerToken("")).toBeUndefined();
    expect(leerToken("__Host-sesion=")).toBeUndefined();
  });
});
