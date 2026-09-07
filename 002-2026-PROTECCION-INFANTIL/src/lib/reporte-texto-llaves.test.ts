import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
    parseKeyEstricta,
    llavePorVersion,
    llaveActiva,
    aadDe,
    cifrarConLlave,
    descifrarConLlave,
} from "./reporte-texto-llaves";

const LLAVE_OK = randomBytes(32).toString("base64"); // 44 chars base64 canónico

describe("parseKeyEstricta · round-trip base64, NUNCA la rama UTF-8 (revisión adversarial #15)", () => {
    it("acepta base64 canónico de 32 bytes ('openssl rand -base64 32')", () => {
        expect(parseKeyEstricta(LLAVE_OK, "TEST_KEY").length).toBe(32);
    });

    // Candado de conducta: los tres que HOY se cuelan por param-encryption.parseKey
    // (dos por la rama base64 laxa, uno por la rama UTF-8) deben MORIR acá. Si alguien
    // reintroduce la rama UTF-8 o valida solo por longitud, estos casos pasan y el test
    // se pone rojo.
    it.each([
        ["frase de 43 chars sin espacios (rama base64 laxa)", "MiClaveDeProteccionInfantilParaCifrarTextos"],
        ["frase de 49 chars con espacios (rama base64 laxa)", "Proteccion Infantil llave maestra del piloto 2026"],
        ["frase UTF-8 de 32 chars (rama UTF-8 que se elimina)", "a".repeat(32)],
        ["cadena vacía", ""],
    ])("rechaza %s", (_desc, raw) => {
        expect(() => parseKeyEstricta(raw, "TEST_KEY")).toThrow();
    });

    it("rechaza undefined con throw ruidoso (nunca return null)", () => {
        expect(() => parseKeyEstricta(undefined, "TEST_KEY")).toThrow(/TEST_KEY/);
    });
});

describe("registro de llaves · llavePorVersion / llaveActiva", () => {
    const backup = { ...process.env };
    afterEach(() => {
        process.env = { ...backup };
    });

    it("llavePorVersion lee REPORTE_TEXTO_KEY_V<n> y valida estricto", () => {
        process.env.REPORTE_TEXTO_KEY_V7 = LLAVE_OK;
        expect(llavePorVersion(7).length).toBe(32);
    });

    it("llavePorVersion LANZA nombrando la variable si la versión no está provisionada", () => {
        delete process.env.REPORTE_TEXTO_KEY_V8;
        expect(() => llavePorVersion(8)).toThrow(/REPORTE_TEXTO_KEY_V8/);
    });

    it("llaveActiva usa REPORTE_TEXTO_KEY_ACTIVA con default 1", () => {
        process.env.REPORTE_TEXTO_KEY_V1 = LLAVE_OK;
        delete process.env.REPORTE_TEXTO_KEY_ACTIVA;
        expect(llaveActiva().version).toBe(1);
    });

    it("llaveActiva sigue el puntero para la rotación", () => {
        process.env.REPORTE_TEXTO_KEY_V2 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "2";
        expect(llaveActiva().version).toBe(2);
    });
});

describe("cripto con AAD · sin fail-open (revisión adversarial #10, llaves:check §7)", () => {
    const llave = randomBytes(32);
    const aad = aadDe("cont_abc123", "texto");

    it("round-trip devuelve el plano idéntico (incluye acentos/ñ)", () => {
        const plano = "relato de la denuncia · menor de 8 años · áéíóú ñ";
        const sobre = cifrarConLlave(plano, llave, aad);
        expect(descifrarConLlave(sobre, llave, aad)).toBe(plano);
    });

    it("AAD alterado (otro campo) LANZA — no intercambia texto ↔ textoOriginal", () => {
        const sobre = cifrarConLlave("x", llave, aad);
        const aadOtroCampo = aadDe("cont_abc123", "textoOriginal");
        expect(() => descifrarConLlave(sobre, llave, aadOtroCampo)).toThrow();
    });

    it("AAD de otra fila LANZA — no mueve el sobre a otro contenido", () => {
        const sobre = cifrarConLlave("x", llave, aad);
        const aadOtraFila = aadDe("cont_XXXXXX", "texto");
        expect(() => descifrarConLlave(sobre, llave, aadOtraFila)).toThrow();
    });

    it("llave equivocada LANZA", () => {
        const sobre = cifrarConLlave("x", llave, aad);
        expect(() => descifrarConLlave(sobre, randomBytes(32), aad)).toThrow();
    });

    it("un valor que no es sobre (texto plano) LANZA — nunca fail-open al valor crudo", () => {
        expect(() => descifrarConLlave("texto plano histórico", llave, aad)).toThrow();
    });
});
