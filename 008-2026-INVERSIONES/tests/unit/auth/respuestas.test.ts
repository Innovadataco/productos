// Respuestas JSON del login: siempre sin caché y, cuando hace falta, con más de una Set-Cookie (al pasar
// el segundo paso se crea la sesión y se borra la pre-sesión en la misma respuesta).
import { describe, expect, it } from "vitest";
import { MENSAJE_SEGUNDO_PASO, respuestaJson } from "@/auth/respuestas";

describe("respuestaJson", () => {
  it("lleva no-store, el estado y el cuerpo", async () => {
    const r = respuestaJson({ ok: true }, 200);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ ok: true });
  });

  it("agrega varias Set-Cookie, cada una en su cabecera", () => {
    const r = respuestaJson({ ok: true }, 200, {}, ["a=1; Path=/", "b=; Path=/; Max-Age=0"]);
    expect(r.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=; Path=/; Max-Age=0"]);
  });

  it("conserva las cabeceras extra y no deja que pisen el no-store", () => {
    const r = respuestaJson({}, 429, { "Retry-After": "3", "Cache-Control": "public" });
    expect(r.headers.get("retry-after")).toBe("3");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("el mensaje del segundo paso es uno solo y no dice qué falló", () => {
    expect(MENSAJE_SEGUNDO_PASO).toBe("Código incorrecto");
  });
});
