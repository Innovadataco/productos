// El sobre AES-256-GCM (#11): integridad, contexto (AAD) y kid. Claves aleatorias, generadas aquí.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErrorCifrado } from "@/cifrado/errores";
import { obtenerLlavero } from "@/cifrado/llavero";
import { clasificarSobre, cifrar, descifrar, esSobre, type Sobre } from "@/cifrado/sobre";

const b64 = () => randomBytes(32).toString("base64");
const V1 = b64();
const V2 = b64();
/** Llavero con la v1 activa (solo v1 cargada). */
const clave = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v1", CIFRADO_CLAVE_V1: V1 });
/** Rotado: la v2 es la activa y la v1 sigue cargada para descifrar lo viejo. */
const rotado = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v2", CIFRADO_CLAVE_V1: V1, CIFRADO_CLAVE_V2: V2 });
/** Solo la v2: lo cifrado con la v1 ya no se puede abrir. */
const soloV2 = obtenerLlavero({ CIFRADO_CLAVE_ACTIVA: "v2", CIFRADO_CLAVE_V2: V2 });
const CONTEXTO = ["tabla.campo", "fila-1"] as const;

function codigoDe(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return e instanceof ErrorCifrado ? e.codigo : `otro: ${String(e)}`;
  }
  return "sin error";
}

/** Cambia un byte del campo base64 indicado (el sobre sigue bien formado). */
function alterar(sobre: Sobre, campo: "iv" | "tag" | "ct"): Sobre {
  const bytes = Buffer.from(sobre[campo], "base64");
  bytes[0] = bytes[0]! ^ 0xff;
  return { ...sobre, [campo]: bytes.toString("base64") };
}

describe("cifrar y descifrar", () => {
  it("ida y vuelta: devuelve el mismo texto", () => {
    const texto = "dato ficticio · ñandú · 12.345,67";
    expect(descifrar(cifrar(texto, CONTEXTO, clave), CONTEXTO, clave)).toBe(texto);
  });

  it("el sobre tiene exactamente v, kid, iv (12 B), tag (16 B) y ct, sin el texto en claro", () => {
    const texto = "texto-que-no-debe-verse";
    const sobre = cifrar(texto, CONTEXTO, clave);
    expect(Object.keys(sobre).sort()).toEqual(["ct", "iv", "kid", "tag", "v"]);
    expect(sobre.v).toBe(1);
    expect(sobre.kid).toBe("v1");
    expect(Buffer.from(sobre.iv, "base64")).toHaveLength(12);
    expect(Buffer.from(sobre.tag, "base64")).toHaveLength(16);
    expect(JSON.stringify(sobre)).not.toContain(texto);
    expect(JSON.stringify(sobre)).not.toContain(Buffer.from(texto).toString("base64"));
  });

  it("el IV es aleatorio: el mismo texto da sobres distintos", () => {
    const a = cifrar("igual", CONTEXTO, clave);
    const b = cifrar("igual", CONTEXTO, clave);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("acepta el texto vacío", () => {
    expect(descifrar(cifrar("", CONTEXTO, clave), CONTEXTO, clave)).toBe("");
  });
});

describe("rotación: cifra con la activa, descifra con la versión del sobre", () => {
  it("con la v2 activa, el sobre nuevo lleva kid v2 y el viejo (v1) se sigue abriendo", () => {
    const viejo = cifrar("viejo", CONTEXTO, clave);
    const nuevo = cifrar("nuevo", CONTEXTO, rotado);
    expect(viejo.kid).toBe("v1");
    expect(nuevo.kid).toBe("v2");
    expect(descifrar(viejo, CONTEXTO, rotado)).toBe("viejo");
    expect(descifrar(nuevo, CONTEXTO, soloV2)).toBe("nuevo");
  });
});

describe("descifrar falla cerrado", () => {
  const sobre = cifrar("secreto ficticio", CONTEXTO, clave);

  it("con otro contexto (el sobre se movió de fila o de campo): AUTENTICACION_FALLIDA", () => {
    expect(codigoDe(() => descifrar(sobre, ["tabla.campo", "fila-2"], clave))).toBe("AUTENTICACION_FALLIDA");
    expect(codigoDe(() => descifrar(sobre, ["otra.columna", "fila-1"], clave))).toBe("AUTENTICACION_FALLIDA");
  });

  it.each(["iv", "tag", "ct"] as const)("con el %s alterado: AUTENTICACION_FALLIDA", (campo) => {
    expect(codigoDe(() => descifrar(alterar(sobre, campo), CONTEXTO, clave))).toBe("AUTENTICACION_FALLIDA");
  });

  it("con una etiqueta corta (12 B): SOBRE_INVALIDO, no se intenta", () => {
    const corta = { ...sobre, tag: Buffer.from(sobre.tag, "base64").subarray(0, 12).toString("base64") };
    expect(codigoDe(() => descifrar(corta, CONTEXTO, clave))).toBe("SOBRE_INVALIDO");
  });

  it("si la versión del sobre no está cargada: CLAVE_NO_DISPONIBLE", () => {
    expect(codigoDe(() => descifrar(sobre, CONTEXTO, soloV2))).toBe("CLAVE_NO_DISPONIBLE");
  });

  it("con el kid falsificado a otra versión cargada: AUTENTICACION_FALLIDA", () => {
    expect(codigoDe(() => descifrar({ ...sobre, kid: "v2" }, CONTEXTO, rotado))).toBe("AUTENTICACION_FALLIDA");
  });

  it.each([
    ["texto plano", "en claro"],
    ["objeto en claro", { "Valor total": "1.00" }],
    ["null", null],
  ])("lo que no es un sobre (%s): SOBRE_INVALIDO", (_caso, valor) => {
    expect(codigoDe(() => descifrar(valor, CONTEXTO, clave))).toBe("SOBRE_INVALIDO");
  });

  it("el mensaje del error no trae el texto ni el sobre", () => {
    try {
      descifrar(alterar(sobre, "ct"), CONTEXTO, clave);
    } catch (e) {
      expect((e as Error).message).not.toContain("secreto");
      expect((e as Error).message).not.toContain(sobre.ct);
    }
  });
});

describe("esSobre y clasificarSobre", () => {
  const sobre = cifrar("x", CONTEXTO, clave);

  it("reconoce un sobre bien formado", () => {
    expect(esSobre(sobre)).toBe(true);
    expect(clasificarSobre(sobre)).toBe("sobre");
  });

  it.each([
    ["una llave de más", { ...sobre, extra: "1" }],
    ["sin ct", { v: sobre.v, kid: sobre.kid, iv: sobre.iv, tag: sobre.tag }],
    ["otra versión", { ...sobre, v: 2 }],
    ["kid que no es una versión", { ...sobre, kid: "abc123" }],
    ["kid v0", { ...sobre, kid: "v0" }],
    ["kid de más de 6 dígitos", { ...sobre, kid: "v1234567" }],
    ["iv que no es base64", { ...sobre, iv: "@@@@@@@@@@@@@@@@" }],
    ["iv de otro largo", { ...sobre, iv: Buffer.alloc(16).toString("base64") }],
    ["ct con base64 no canónica", { ...sobre, ct: "QQ" }],
  ])("un sobre dañado (%s) no es sobre: es anómalo", (_caso, valor) => {
    expect(esSobre(valor)).toBe(false);
    expect(clasificarSobre(valor)).toBe("anomalo");
  });

  it.each([
    ["objeto de una fila", { "Fecha y hora": "2024-11-13", Estado: "Aprobado" }],
    ["texto", "abc"],
    ["número", 5],
    ["null", null],
    ["arreglo", ["v", "ct"]],
  ])("lo que no se parece a un sobre (%s) es «otro»", (_caso, valor) => {
    expect(esSobre(valor)).toBe(false);
    expect(clasificarSobre(valor)).toBe("otro");
  });
});
