// Códigos de recuperación del TOTP: 10 por generación, de 80 bits (16 caracteres base32 de Crockford en
// grupos de 4), un solo uso. En la base va solo su sha256: con 80 bits de entropía, probarlos todos contra
// un sha256 filtrado es inviable. Al escribirlos a mano se perdonan minúsculas, guiones, espacios e I/L/O.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CODIGOS_RECUPERACION, CODIGO_RECUPERACION_BYTES } from "@/auth/limites";
import { generarCodigosRecuperacion, hashCodigoRecuperacion, normalizarCodigoRecuperacion } from "@/auth/recuperacion";

const FORMA = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

describe("generarCodigosRecuperacion", () => {
  it("da 10 códigos distintos con la forma XXXX-XXXX-XXXX-XXXX (alfabeto de Crockford)", () => {
    const codigos = generarCodigosRecuperacion();
    expect(codigos).toHaveLength(CODIGOS_RECUPERACION);
    expect(CODIGOS_RECUPERACION).toBe(10);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) expect(c).toMatch(FORMA);
  });

  it("cada código lleva 80 bits: 16 caracteres de 5 bits", () => {
    expect(CODIGO_RECUPERACION_BYTES * 8).toBe(80);
    const [primero = ""] = generarCodigosRecuperacion();
    expect(primero.replace(/-/g, "")).toHaveLength(16);
  });

  it("son aleatorios: dos generaciones no comparten códigos y salen todos los caracteres", () => {
    const muchos = Array.from({ length: 60 }, () => generarCodigosRecuperacion()).flat();
    expect(new Set(muchos).size).toBe(muchos.length);
    expect(new Set(muchos.join("").replace(/-/g, "")).size).toBe(32);
  });
});

describe("normalizarCodigoRecuperacion", () => {
  it("quita guiones y espacios y pasa a mayúsculas", () => {
    expect(normalizarCodigoRecuperacion("abcd-efgh-jkmn-pqrs")).toBe("ABCDEFGHJKMNPQRS");
    expect(normalizarCodigoRecuperacion(" ABCD EFGH JKMN PQRS ")).toBe("ABCDEFGHJKMNPQRS");
  });

  it("lee I y L como 1 y O como 0 (Crockford)", () => {
    expect(normalizarCodigoRecuperacion("IlOo-0000-1111-2222")).toBe("1100000011112222");
  });

  it.each(["", "ABCD-EFGH-JKMN-PQR", "ABCD-EFGH-JKMN-PQRST", "ABCD-EFGH-JKMN-PQRU", "ABCD-EFGH-JKMN-PQR*", "123456", "x".repeat(500)])(
    "«%s» no es un código de recuperación",
    (texto) => {
      expect(normalizarCodigoRecuperacion(texto)).toBeNull();
    },
  );

  it("un código recién generado se normaliza a sí mismo sin guiones", () => {
    for (const c of generarCodigosRecuperacion()) expect(normalizarCodigoRecuperacion(c)).toBe(c.replace(/-/g, ""));
  });
});

describe("hashCodigoRecuperacion", () => {
  it("es el sha256 hexadecimal del código normalizado", () => {
    expect(hashCodigoRecuperacion("ABCDEFGHJKMNPQRS")).toBe(createHash("sha256").update("ABCDEFGHJKMNPQRS", "utf8").digest("hex"));
    expect(hashCodigoRecuperacion("ABCDEFGHJKMNPQRS")).toMatch(/^[0-9a-f]{64}$/);
  });
});
