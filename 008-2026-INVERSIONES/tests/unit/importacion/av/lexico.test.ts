import { describe, expect, it } from "vitest";
import { ErrorPdf } from "@/importacion/av/pdf/errores";
import { Lexico, leerValor, type PdfValor } from "@/importacion/av/pdf/lexico";
import { decodificarWinAnsi } from "@/importacion/av/pdf/winansi";

const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const valor = (s: string): PdfValor => leerValor(new Lexico(bytes(s)));
const cadena = (s: string): string => {
  const v = valor(s);
  if (typeof v !== "object" || v === null || v.tipo !== "cadena") throw new Error("no es cadena");
  return Buffer.from(v.v).toString("latin1");
};
const codigo = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorPdf) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("léxico de PDF: cadenas literales", () => {
  it("resuelve los escapes de paréntesis, barra, salto y octal", () => {
    expect(cadena("(a\\(b\\)c\\\\d\\101\\n)")).toBe("a(b)c\\dA\n");
  });

  it("acepta paréntesis balanceados sin escapar", () => {
    expect(cadena("(a(b)c)")).toBe("a(b)c");
  });

  it("une la línea partida con barra al final y normaliza CRLF a LF", () => {
    expect(cadena("(ab\\\ncd)")).toBe("abcd");
    expect(cadena("(ab\r\ncd)")).toBe("ab\ncd");
  });

  it("lee octales de 1, 2 y 3 dígitos", () => {
    expect(cadena("(\\0\\12\\123)")).toBe("\x00\n\x53");
  });

  it("una cadena sin cerrar falla cerrado con un código", () => {
    expect(codigo(() => valor("(abierta"))).toBe("PDF_CADENA_ABIERTA");
  });

  it("una cadena más larga que el tope falla con un código, sin el contenido", () => {
    expect(codigo(() => valor(`(${"x".repeat(70_000)})`))).toBe("PDF_CADENA_LARGA");
  });
});

describe("léxico de PDF: otros valores", () => {
  it("lee cadenas hex, también con un dígito impar", () => {
    expect(cadena("<48 65 6C6c6f>")).toBe("Hello");
    expect(cadena("<4>")).toBe("@");
  });

  it("un carácter que no es hex en una cadena hex falla", () => {
    expect(codigo(() => valor("<4G>"))).toBe("PDF_OBJETO_INVALIDO");
  });

  it("lee nombres con #xx y números con signo, punto y sin parte entera", () => {
    expect(valor("/A#20B")).toEqual({ tipo: "nombre", v: "A B" });
    expect([valor("0.57"), valor("-5"), valor(".5"), valor("4."), valor("+3")]).toEqual([0.57, -5, 0.5, 4, 3]);
  });

  it("lee diccionarios con arreglos y referencias, y salta comentarios", () => {
    const v = valor("<< /Type /Pages % comentario\n /Kids [3 0 R 5 0 R] /Count 2 /Ok true /Nada null >>");
    expect(v).toEqual({
      tipo: "dic",
      v: new Map<string, PdfValor>([
        ["Type", { tipo: "nombre", v: "Pages" }],
        ["Kids", { tipo: "arreglo", v: [{ tipo: "ref", num: 3, gen: 0 }, { tipo: "ref", num: 5, gen: 0 }] }],
        ["Count", 2],
        ["Ok", true],
        ["Nada", null],
      ]),
    });
  });

  it("dos números sin R no son una referencia", () => {
    expect(valor("[1 0 0 1 20 30]")).toEqual({ tipo: "arreglo", v: [1, 0, 0, 1, 20, 30] });
  });

  it("un anidamiento más hondo que el tope falla con un código (sin recursión sin fin)", () => {
    expect(codigo(() => valor(`${"[".repeat(40)}${"]".repeat(40)}`))).toBe("PDF_PROFUNDIDAD_EXCESIVA");
  });

  it("un diccionario o arreglo sin cerrar falla", () => {
    expect(codigo(() => valor("<< /A 1"))).toBe("PDF_OBJETO_INVALIDO");
    expect(codigo(() => valor("[1 2"))).toBe("PDF_OBJETO_INVALIDO");
  });

  it("un número sin dígitos no es número", () => {
    expect(codigo(() => valor("-."))).toBe("PDF_OBJETO_INVALIDO");
  });

  it("los operadores de contenido salen como palabras (T*, ', Tj)", () => {
    const lex = new Lexico(bytes("T* ' (x) Tj"));
    expect([lex.siguiente(), lex.siguiente()]).toEqual([{ t: "palabra", v: "T*" }, { t: "palabra", v: "'" }]);
  });
});

describe("WinAnsi (cp1252)", () => {
  it("decodifica la raya, las tildes y el euro; un byte sin definir queda como U+FFFD", () => {
    expect(decodificarWinAnsi(new Uint8Array([0x96, 0xd3, 0xc9, 0x80, 0x41, 0x81]))).toBe("–ÓÉ€A�");
  });

  it("los bytes de 0xA0 a 0xFF son latin1", () => {
    expect(decodificarWinAnsi(new Uint8Array([0xa0, 0xf1, 0xfa]))).toBe(" ñú");
  });
});
