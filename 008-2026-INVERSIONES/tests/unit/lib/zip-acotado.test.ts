// Lector zip acotado (para xlsx, solo en los exportadores del Mac): sin ZIP64, cifrado ni comentario; métodos 0 y 8;
// CRC verificado; topes de archivo, entradas, tamaño por entrada y total y razón de compresión; cabecera local igual a
// la central; entradas contiguas sin solapes; nombres seguros. Cada rechazo, contra su par válido. Datos inventados.
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ErrorZip, TOPES_ZIP, abrirZipAcotado, crc32Zip, type ArchivoZip, type CodigoZip } from "@/lib/zip-acotado";
import { leerXmlAcotado } from "@/lib/xml-acotado";
import { bytesAzar } from "./fixtures/azar";
import {
  DORADO_ALMACENADO,
  DORADO_COMPRIMIDO,
  HOJA_FICTICIA,
  ZIP_DORADO,
  ZIP_DORADO_FLUJO,
  armarZip,
  ascii,
  extra,
  localizadorZip64,
  xlsxMinimo,
  type EntradaZip,
  type OpcionesZip,
} from "./fixtures/xlsx.ficticio";

const KiB = 1024;
const MiB = 1024 * KiB;
const texto = (b: Uint8Array) => new TextDecoder().decode(b);
const entrada = (nombre: string, contenido = `FICT ${nombre} 4613,27`, mas: Partial<EntradaZip> = {}): EntradaZip => ({ nombre, datos: ascii(contenido), ...mas });
const zip = (entradas: readonly EntradaZip[], opciones?: OpcionesZip) => armarZip(entradas, opciones);

/** Código del rechazo al abrir, o "ABIERTO". Otra excepción que no sea ErrorZip se deja pasar (la prueba falla). */
function alAbrir(bytes: Uint8Array): CodigoZip | "ABIERTO" {
  try {
    abrirZipAcotado(bytes);
    return "ABIERTO";
  } catch (e) {
    if (e instanceof ErrorZip) return e.codigo;
    throw e;
  }
}

/** Código del rechazo al abrir o al leer todas las entradas, o "LEIDO". */
function alLeer(bytes: Uint8Array): CodigoZip | "LEIDO" {
  try {
    const archivo = abrirZipAcotado(bytes);
    for (const n of archivo.nombres) archivo.leer(n);
    return "LEIDO";
  } catch (e) {
    if (e instanceof ErrorZip) return e.codigo;
    throw e;
  }
}

/** Par válido/inválido: el válido se lee entero y el inválido falla con el código exacto. */
function par(valido: Uint8Array, invalido: Uint8Array, codigo: CodigoZip): void {
  expect(alLeer(valido), "el par válido debe leerse").toBe("LEIDO");
  expect(alLeer(invalido)).toBe(codigo);
}

/** Mismo zip con un campo de 16 o 32 bits reemplazado en la posición dada. */
function conCampo(bytes: Uint8Array, posicion: number, valor: number, ancho: 2 | 4): Uint8Array {
  const copia = bytes.slice();
  const vista = new DataView(copia.buffer);
  if (ancho === 2) vista.setUint16(posicion, valor, true);
  else vista.setUint32(posicion, valor, true);
  return copia;
}

const UNA = [entrada("xl/workbook.xml")];
const DOS = [entrada("xl/workbook.xml"), entrada("xl/worksheets/sheet1.xml")];

describe("zip-acotado · lectura", () => {
  it("lee los vectores dorados de otra implementación (CPython zipfile): almacenado y deflate", () => {
    const archivo = abrirZipAcotado(ZIP_DORADO);
    expect(archivo.nombres).toEqual([DORADO_ALMACENADO.nombre, DORADO_COMPRIMIDO.nombre]);
    expect(texto(archivo.leer(DORADO_ALMACENADO.nombre))).toBe(DORADO_ALMACENADO.texto);
    expect(texto(archivo.leer(DORADO_COMPRIMIDO.nombre))).toBe(DORADO_COMPRIMIDO.texto);
  });

  it("lee el vector dorado escrito a un flujo (bit 3 y descriptor con firma)", () => {
    const archivo = abrirZipAcotado(ZIP_DORADO_FLUJO);
    expect(texto(archivo.leer(DORADO_ALMACENADO.nombre))).toBe(DORADO_ALMACENADO.texto);
    expect(texto(archivo.leer(DORADO_COMPRIMIDO.nombre))).toBe(DORADO_COMPRIMIDO.texto);
  });

  it("un xlsx mínimo: lista sus partes y la hoja se lee con el lector XML, con los valores como texto", () => {
    const archivo = abrirZipAcotado(xlsxMinimo());
    expect(archivo.nombres).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
    const hoja = archivo.leer("xl/worksheets/sheet1.xml");
    expect(texto(hoja)).toBe(HOJA_FICTICIA);
    const filas = leerXmlAcotado(hoja).hijos[0]!.hijos;
    expect(filas.map((f) => f.hijos.map((c) => c.hijos[0]?.texto))).toEqual([["0", "1"], ["46463", "4613.27"], ["46464", "37911.47"]]);
  });

  it("métodos 0 y 8, entradas vacías con los dos métodos, y un zip dentro de otro se devuelve como bytes (sin recursión)", () => {
    const interno = zip(UNA);
    const archivo = abrirZipAcotado(
      zip([entrada("a.txt", "FICT almacenado", { metodo: 0 }), entrada("b.txt", "FICT comprimido"), entrada("vacio0", "", { metodo: 0 }), entrada("vacio8", ""), { nombre: "interno.zip", datos: interno }]),
    );
    expect(texto(archivo.leer("a.txt"))).toBe("FICT almacenado");
    expect(texto(archivo.leer("b.txt"))).toBe("FICT comprimido");
    expect(archivo.leer("vacio0")).toEqual(new Uint8Array());
    expect(archivo.leer("vacio8")).toEqual(new Uint8Array());
    expect(archivo.leer("interno.zip")).toEqual(interno);
  });

  it("descriptor de datos (bit 3) con y sin firma", () => {
    expect(alLeer(zip([entrada("a", "FICT a", { descriptor: { firma: true } }), entrada("b", "FICT b", { descriptor: { firma: false }, metodo: 0 })]))).toBe("LEIDO");
  });

  it("las carpetas (nombre que termina en /, tamaño 0) se aceptan y no se listan", () => {
    const archivo = abrirZipAcotado(zip([entrada("xl/", "", { metodo: 0 }), entrada("xl/workbook.xml")]));
    expect(archivo.nombres).toEqual(["xl/workbook.xml"]);
    expect(() => archivo.leer("xl/")).toThrow(expect.objectContaining({ codigo: "ZIP_ENTRADA_INEXISTENTE" }));
    expect(alAbrir(zip([entrada("xl/", "x", { metodo: 0 })]))).toBe("ZIP_NOMBRE_INVALIDO");
  });

  it("un nombre que no está: ZIP_ENTRADA_INEXISTENTE (sin el nombre en el mensaje)", () => {
    const archivo = abrirZipAcotado(zip(UNA));
    try {
      archivo.leer("FICTMARCA.xml");
      expect.unreachable("debía rechazarse");
    } catch (e) {
      expect(e).toMatchObject({ codigo: "ZIP_ENTRADA_INEXISTENTE", name: "ErrorZip" });
      expect((e as Error).message).not.toContain("FICTMARCA");
    }
  });

  it("campos extra distintos en la cabecera local y en la central (TLV válidos) se aceptan", () => {
    const e = entrada("a", "FICT", { local: { extra: extra(0x5455, Uint8Array.of(3, 1, 2, 3, 4, 5, 6, 7, 8)) }, central: { extra: extra(0x5455, Uint8Array.of(3, 1, 2, 3, 4)) } });
    expect(alLeer(zip([e]))).toBe("LEIDO");
  });

  it("leer devuelve una copia propia cada vez (también con un Buffer o una vista con byteOffset de entrada)", () => {
    const base = zip([entrada("a", "FICT original", { metodo: 0 })]);
    const conRelleno = new Uint8Array(base.length + 7);
    conRelleno.set(base, 3);
    for (const bytes of [base, Buffer.from(base), conRelleno.subarray(3, 3 + base.length)]) {
      const archivo: ArchivoZip = abrirZipAcotado(bytes);
      const primera = archivo.leer("a");
      primera.fill(0x5a);
      expect(texto(archivo.leer("a"))).toBe("FICT original");
      expect(Buffer.isBuffer(archivo.leer("a"))).toBe(false);
    }
  });

  it("el archivo abierto y su lista de nombres están congelados", () => {
    const archivo = abrirZipAcotado(zip(DOS));
    expect(Object.isFrozen(archivo)).toBe(true);
    expect(Object.isFrozen(archivo.nombres)).toBe(true);
  });

  it("el CRC propio coincide con el estándar (vector «123456789») y con zlib.crc32", () => {
    expect(crc32Zip(ascii("123456789"))).toBe(0xcbf43926);
    expect(crc32Zip(new Uint8Array())).toBe(0);
    const datos = bytesAzar(4613, 3001);
    expect(crc32Zip(datos)).toBe(crc32(datos));
  });
});

describe("zip-acotado · no es un zip, comentario, multidisco y ZIP64", () => {
  it.each([
    ["vacío", new Uint8Array()],
    ["21 bytes", new Uint8Array(21)],
    ["bytes al azar", bytesAzar(1237, 300)],
    ["un PDF", ascii("%PDF-1.4\n%FICT\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF")],
    ["una página HTML de error", ascii("<!doctype html><html><head><title>HTTP Status 406</title></head></html>")],
  ])("%s: ZIP_INVALIDO", (_caso, bytes) => {
    expect(alAbrir(bytes)).toBe("ZIP_INVALIDO");
  });

  it("bytes después del registro de fin: ZIP_INVALIDO", () => {
    par(zip(UNA), zip(UNA, { cola: ascii("FICT") }), "ZIP_INVALIDO");
  });

  it("un comentario en el registro de fin (aunque esconda otro registro de fin): ZIP_COMENTARIO_NO_SOPORTADO", () => {
    par(zip(UNA), zip(UNA, { comentario: ascii("FICT comentario") }), "ZIP_COMENTARIO_NO_SOPORTADO");
    const falso = zip([], {}).subarray(0, 22);
    expect(alAbrir(zip(UNA, { comentario: Uint8Array.from([...ascii("x"), ...falso, ...ascii("yz")]) }))).toBe("ZIP_COMENTARIO_NO_SOPORTADO");
  });

  it("el largo de comentario declarado sin comentario: ZIP_ESTRUCTURA_INVALIDA", () => {
    par(zip(UNA), zip(UNA, { fin: { largoComentario: 3 } }), "ZIP_ESTRUCTURA_INVALIDA");
  });

  it.each([
    ["disco del registro", { disco: 1 }],
    ["disco del directorio central", { discoCentral: 1 }],
    ["entradas del disco distintas del total", { entradasDisco: 0 }],
  ])("multidisco (%s): ZIP_MULTIDISCO", (_caso, fin) => {
    par(zip(UNA), zip(UNA, { fin }), "ZIP_MULTIDISCO");
  });

  it("una entrada que empieza en otro disco: ZIP_MULTIDISCO", () => {
    par(zip(UNA), zip([entrada("a", "FICT", { central: { disco: 1 } })]), "ZIP_MULTIDISCO");
  });

  it.each([
    ["entradas en 0xFFFF", { fin: { entradas: 0xffff, entradasDisco: 0xffff } }],
    ["tamaño del directorio en 0xFFFFFFFF", { fin: { tamanoCentral: 0xffffffff } }],
    ["offset del directorio en 0xFFFFFFFF", { fin: { offsetCentral: 0xffffffff } }],
    ["localizador ZIP64 antes del fin", { antesDelFin: localizadorZip64() }],
  ])("ZIP64 (%s): ZIP64_NO_SOPORTADO", (_caso, opciones: OpcionesZip) => {
    par(zip(UNA), zip(UNA, opciones), "ZIP64_NO_SOPORTADO");
  });

  it.each([
    ["tamaño real en 0xFFFFFFFF", { central: { real: 0xffffffff } }],
    ["tamaño comprimido en 0xFFFFFFFF", { central: { comprimido: 0xffffffff } }],
    ["offset en 0xFFFFFFFF", { central: { offset: 0xffffffff } }],
    ["disco en 0xFFFF", { central: { disco: 0xffff } }],
    ["extra 0x0001 en la central", { central: { extra: extra(0x0001, new Uint8Array(8)) } }],
    ["extra 0x0001 en la local", { local: { extra: extra(0x0001, new Uint8Array(8)) } }],
  ])("ZIP64 en la entrada (%s): ZIP64_NO_SOPORTADO", (_caso, mas: Partial<EntradaZip>) => {
    par(zip(UNA), zip([entrada("xl/workbook.xml", undefined, mas)]), "ZIP64_NO_SOPORTADO");
  });
});

describe("zip-acotado · cifrado, banderas, métodos y CRC", () => {
  it.each([
    ["bit 0 (cifrado tradicional)", { banderas: 0x0001 }],
    ["bit 6 (cifrado fuerte)", { banderas: 0x0040 }],
    ["bit 13 (cabecera local enmascarada)", { banderas: 0x2000 }],
    ["método 99 (AES)", { metodo: 99, comprimidos: ascii("FICT") }],
    ["extra 0x9901 (AES)", { central: { extra: extra(0x9901, new Uint8Array(7)) } }],
  ])("cifrado (%s): ZIP_CIFRADO", (_caso, mas: Partial<EntradaZip>) => {
    par(zip(UNA), zip([entrada("xl/workbook.xml", undefined, mas)]), "ZIP_CIFRADO");
  });

  it.each([
    ["bit 4", 0x0010],
    ["bit 5 (datos parcheados)", 0x0020],
    ["bit 12", 0x1000],
  ])("bandera fuera de la lista blanca (%s): ZIP_FORMATO_NO_SOPORTADO", (_caso, banderas) => {
    par(zip([entrada("a", "FICT", { banderas: 0x0800 | 0x0002 })]), zip([entrada("a", "FICT", { banderas })]), "ZIP_FORMATO_NO_SOPORTADO");
  });

  it.each([1, 9, 12, 14, 93])("método %d: ZIP_METODO_NO_SOPORTADO", (metodo) => {
    par(zip(UNA), zip([entrada("xl/workbook.xml", undefined, { metodo, comprimidos: ascii("FICT comprimido") })]), "ZIP_METODO_NO_SOPORTADO");
  });

  it("almacenado con tamaño comprimido distinto del real: ZIP_ENTRADA_INVALIDA", () => {
    par(zip([entrada("a", "FICT", { metodo: 0 })]), zip([entrada("a", "FICT", { metodo: 0, real: 5 })]), "ZIP_ENTRADA_INVALIDA");
  });

  it("CRC malo en las dos cabeceras, o un bit volteado en los datos: ZIP_CRC_INVALIDO al leer", () => {
    const bueno = zip([entrada("a", "FICT 4613,27", { metodo: 0 })]);
    par(bueno, zip([entrada("a", "FICT 4613,27", { metodo: 0, crc: crc32(ascii("FICT 4613,27")) ^ 1 })]), "ZIP_CRC_INVALIDO");
    const volteado = bueno.slice();
    volteado[30 + 1 + 2] ^= 0x01;
    expect(alAbrir(volteado)).toBe("ABIERTO");
    expect(alLeer(volteado)).toBe("ZIP_CRC_INVALIDO");
  });

  it("deflate corrupto, truncado o con basura después del final: ZIP_ENTRADA_INVALIDA", () => {
    const datos = ascii("FICT 37911,47 ".repeat(9));
    const deflate = new Uint8Array(deflateRawSync(datos));
    par(zip([{ nombre: "a", datos, comprimidos: deflate }]), zip([{ nombre: "a", datos, comprimidos: deflate.subarray(0, deflate.length - 3) }]), "ZIP_ENTRADA_INVALIDA");
    expect(alLeer(zip([{ nombre: "a", datos, comprimidos: Uint8Array.from([...deflate, 0x46, 0x49]) }]))).toBe("ZIP_ENTRADA_INVALIDA");
    expect(alLeer(zip([{ nombre: "a", datos, comprimidos: new Uint8Array(deflate.length).fill(0xff) }]))).toBe("ZIP_ENTRADA_INVALIDA");
    expect(alLeer(zip([{ nombre: "a", datos: new Uint8Array(), comprimidos: new Uint8Array() }]))).toBe("ZIP_ENTRADA_INVALIDA");
  });

  it("tamaño real declarado menor que lo inflado: ZIP_INFLADO_EXCESIVO; mayor: ZIP_ENTRADA_INVALIDA", () => {
    const datos = ascii("FICT 37911,47 ".repeat(9));
    par(zip([{ nombre: "a", datos }]), zip([{ nombre: "a", datos, real: datos.length - 1 }]), "ZIP_INFLADO_EXCESIVO");
    expect(alLeer(zip([{ nombre: "a", datos, real: datos.length + 1 }]))).toBe("ZIP_ENTRADA_INVALIDA");
    expect(alLeer(zip([{ nombre: "a", datos: ascii("x"), real: 0 }]))).toBe("ZIP_INFLADO_EXCESIVO");
  });
});

describe("zip-acotado · cabecera local contra la central y descriptor", () => {
  it.each([
    ["nombre", { local: { nombre: ascii("xl/workbook.xmL") } }],
    ["largo del nombre", { local: { nombre: ascii("xl/workbook.xml2") } }],
    ["método", { local: { metodo: 0 } }],
    ["banderas", { local: { banderas: 0x0800 } }],
    ["CRC solo en la local", { local: { crc: 0x46494354 } }],
    ["tamaño comprimido", { local: { comprimido: 3 } }],
    ["tamaño real", { local: { real: 3 } }],
  ])("la local difiere en %s: ZIP_CABECERA_DISTINTA", (_caso, mas: Partial<EntradaZip>) => {
    par(zip(UNA), zip([entrada("xl/workbook.xml", undefined, mas)]), "ZIP_CABECERA_DISTINTA");
  });

  it("firma local mala, offset fuera de rango o extra TLV mal formado: ZIP_ESTRUCTURA_INVALIDA", () => {
    par(zip(UNA), zip([entrada("a", "FICT", { local: { firma: 0x04034b51 } })]), "ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip([entrada("a", "FICT", { central: { offset: 0x7ffff } })]))).toBe("ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip([entrada("a", "FICT", { central: { extra: Uint8Array.of(0x55, 0x54, 0x09) } })]))).toBe("ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip([entrada("a", "FICT", { local: { extra: Uint8Array.of(0x55, 0x54, 0x09, 0x00, 0x01) } })]))).toBe("ZIP_ESTRUCTURA_INVALIDA");
  });

  it("descriptor distinto de la central, ausente o con la local en valores distintos de 0: rechazado", () => {
    const valido = zip([entrada("a", "FICT", { descriptor: { firma: true } })]);
    par(valido, zip([entrada("a", "FICT", { descriptor: { firma: true, crc: 0x46494354 } })]), "ZIP_DESCRIPTOR_INVALIDO");
    expect(alAbrir(zip([entrada("a", "FICT", { descriptor: { firma: false, real: 9 } })]))).toBe("ZIP_DESCRIPTOR_INVALIDO");
    expect(alAbrir(zip([entrada("a", "FICT", { banderas: 0x0008 })]))).toBe("ZIP_DESCRIPTOR_INVALIDO");
    expect(alAbrir(zip([entrada("a", "FICT", { descriptor: { firma: true }, local: { real: 3 } })]))).toBe("ZIP_CABECERA_DISTINTA");
  });

  it("la cabecera local puede traer los valores verdaderos aunque haya descriptor", () => {
    const datos = ascii("FICT");
    const e: EntradaZip = { nombre: "a", datos, metodo: 0, descriptor: { firma: true }, local: { crc: crc32(datos), comprimido: 4, real: 4 } };
    expect(alLeer(zip([e]))).toBe("LEIDO");
  });
});

describe("zip-acotado · nombres", () => {
  it.each([
    "../a", "a/../b", "a/..", "./a", "a/./b", "/abs", "a\\b", "..\\a", "C:/x", "a\u0000b", "a\u0001b", "a\u007fb", "", "a//b", "ñ.xml",
  ])("nombre peligroso %j: ZIP_NOMBRE_INVALIDO", (nombre) => {
    par(zip([entrada("xl/a.xml")]), zip([entrada(nombre)]), "ZIP_NOMBRE_INVALIDO");
  });

  it("un nombre no ASCII con el bit 11 (UTF-8) tampoco pasa", () => {
    expect(alAbrir(zip([entrada("ñ.xml", "FICT", { banderas: 0x0800 })]))).toBe("ZIP_NOMBRE_INVALIDO");
  });

  it("nombres repetidos, exactos o que solo difieren en mayúsculas: ZIP_NOMBRE_DUPLICADO", () => {
    par(zip(DOS), zip([entrada("xl/workbook.xml"), entrada("xl/workbook.xml")]), "ZIP_NOMBRE_DUPLICADO");
    expect(alAbrir(zip([entrada("xl/workbook.xml"), entrada("XL/Workbook.xml")]))).toBe("ZIP_NOMBRE_DUPLICADO");
  });
});

describe("zip-acotado · tramos y directorio central", () => {
  it("dos entradas centrales que apuntan a la misma cabecera local (bomba por solape): ZIP_ESTRUCTURA_INVALIDA", () => {
    const base = zip(DOS);
    const segunda = zip([entrada("xl/workbook.xml"), entrada("xl/worksheets/sheet1.xml", undefined, { central: { offset: 0 } })]);
    par(base, segunda, "ZIP_ESTRUCTURA_INVALIDA");
  });

  it("solape parcial, hueco entre entradas y bytes antepuestos: ZIP_ESTRUCTURA_INVALIDA", () => {
    const solape = zip([entrada("a", "FICT a", { metodo: 0 }), entrada("b", "FICT b", { metodo: 0, central: { offset: 20 } })]);
    expect(alAbrir(solape)).toBe("ZIP_ESTRUCTURA_INVALIDA");
    par(zip(DOS), zip(DOS, { hueco: { indice: 0, bytes: ascii("FICT") } }), "ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip(DOS, { antes: ascii("MZ FICT autoextraible") }))).toBe("ZIP_ESTRUCTURA_INVALIDA");
  });

  it("datos que invaden el directorio central: ZIP_ESTRUCTURA_INVALIDA", () => {
    expect(alAbrir(zip([entrada("a", "FICT", { metodo: 0, comprimidos: ascii("FICT"), central: { comprimido: 60, real: 60 }, local: { comprimido: 60, real: 60 } })]))).toBe("ZIP_ESTRUCTURA_INVALIDA");
  });

  it("directorio central que no termina en el registro de fin, más grande que el archivo, o con otra cantidad de entradas", () => {
    const base = zip(DOS);
    par(base, zip(DOS, { fin: { tamanoCentral: 50 } }), "ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip(DOS, { fin: { tamanoCentral: 0x7fffff } }))).toBe("ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip(DOS, { fin: { entradas: 1, entradasDisco: 1 } }))).toBe("ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip(DOS, { fin: { entradas: 3, entradasDisco: 3 } }))).toBe("ZIP_ESTRUCTURA_INVALIDA");
    expect(alAbrir(zip([entrada("a", "FICT", { central: { comentario: new Uint8Array(400) } })]))).toBe("ABIERTO");
    expect(alAbrir(zip([entrada("a", "FICT", { central: { firma: 0x02014b51 } })]))).toBe("ZIP_ESTRUCTURA_INVALIDA");
  });

  it("un largo de comentario de la entrada que se sale del directorio central: ZIP_ESTRUCTURA_INVALIDA", () => {
    const base = zip(UNA);
    const inicioCentral = new DataView(base.buffer).getUint32(base.length - 6, true);
    expect(alAbrir(conCampo(base, inicioCentral + 32, 0x7fff, 2))).toBe("ZIP_ESTRUCTURA_INVALIDA");
  });

  it("un hueco después de la ÚLTIMA entrada (antes del directorio) o bytes sueltos en un zip sin entradas: ZIP_ESTRUCTURA_INVALIDA", () => {
    par(zip(DOS), zip(DOS, { hueco: { indice: 1, bytes: ascii("FICT") } }), "ZIP_ESTRUCTURA_INVALIDA");
    par(zip([]), zip([], { antes: ascii("FICT") }), "ZIP_ESTRUCTURA_INVALIDA");
  });

  it("bytes sueltos al final del directorio central (dentro del tamaño declarado): ZIP_ESTRUCTURA_INVALIDA", () => {
    const base = zip(UNA);
    const tamanoCentral = new DataView(base.buffer).getUint32(base.length - 10, true);
    par(base, zip(UNA, { antesDelFin: ascii("FICT"), fin: { tamanoCentral: tamanoCentral + 4 } }), "ZIP_ESTRUCTURA_INVALIDA");
  });

  it("un zip vacío (sin entradas) abre y no lista nada", () => {
    expect(abrirZipAcotado(zip([])).nombres).toEqual([]);
  });
});

describe("zip-acotado · bombas y topes (N pasa, N+1 no)", () => {
  /** Entrada con método 8 y `comprimido` bytes al azar que declara `real` bytes: sirve para los topes al abrir. */
  const declarada = (nombre: string, real: number, comprimido: number, semilla = 4613): EntradaZip => ({
    nombre,
    datos: new Uint8Array(),
    comprimidos: bytesAzar(semilla, comprimido),
    real,
    crc: 0x46494354,
  });

  it("los topes son estos y están congelados", () => {
    expect(TOPES_ZIP).toEqual({ bytesArchivo: 8 * MiB, entradas: 256, bytesPorEntrada: 16 * MiB, bytesTotales: 48 * MiB, razonMaxima: 100, graciaRazon: 64 * KiB, largoNombre: 256 });
    expect(Object.isFrozen(TOPES_ZIP)).toBe(true);
  });

  it("bytes del archivo: 8 MiB pasan, uno más no (antes de mirar la estructura)", () => {
    const fijo = zip([entrada("a", "", { metodo: 0 })]).length;
    const deLargo = (n: number) => zip([{ nombre: "a", datos: bytesAzar(37911, n - fijo), metodo: 0 }]);
    expect(deLargo(8 * MiB).length).toBe(8 * MiB);
    par(deLargo(8 * MiB), deLargo(8 * MiB + 1), "ZIP_DEMASIADO_GRANDE");
    expect(alAbrir(new Uint8Array(8 * MiB + 1))).toBe("ZIP_DEMASIADO_GRANDE");
  });

  it("entradas: 256 pasan, 257 no", () => {
    const de = (n: number) => zip(Array.from({ length: n }, (_v, k) => entrada(`xl/p${k}.xml`, `FICT ${k}`, { metodo: 0 })));
    par(de(256), de(257), "ZIP_DEMASIADAS_ENTRADAS");
  });

  it("tamaño declarado por entrada: 16 MiB abre, uno más no", () => {
    const comprimido = Math.ceil((16 * MiB + 1) / 100);
    expect(alAbrir(zip([declarada("a", 16 * MiB, comprimido)]))).toBe("ABIERTO");
    expect(alAbrir(zip([declarada("a", 16 * MiB + 1, comprimido)]))).toBe("ZIP_ENTRADA_GRANDE");
  });

  it("una entrada real de 16 MiB (con razón bajo el tope) se lee entera", { timeout: 30_000 }, () => {
    const datos = new Uint8Array(16 * MiB);
    datos.set(bytesAzar(1237, 200 * KiB));
    const archivo = abrirZipAcotado(zip([{ nombre: "xl/worksheets/sheet1.xml", datos }]));
    expect(archivo.leer("xl/worksheets/sheet1.xml").length).toBe(16 * MiB);
  });

  it("total declarado: 48 MiB abre, uno más no", () => {
    const comprimido = Math.ceil((16 * MiB) / 100);
    const tres = [declarada("a", 16 * MiB, comprimido, 1), declarada("b", 16 * MiB, comprimido, 2), declarada("c", 16 * MiB, comprimido, 3)];
    expect(alAbrir(zip([...tres, entrada("d", "", { metodo: 0 })]))).toBe("ABIERTO");
    expect(alAbrir(zip([...tres, entrada("d", "x", { metodo: 0 })]))).toBe("ZIP_DEMASIADO_CONTENIDO");
  });

  it("razón de compresión: exactamente 100 abre, un byte más no", () => {
    expect(alAbrir(zip([declarada("a", 100 * 4613, 4613)]))).toBe("ABIERTO");
    expect(alAbrir(zip([declarada("a", 100 * 4613 + 1, 4613)]))).toBe("ZIP_RAZON_EXCESIVA");
  });

  it("gracia de la razón: 64 KiB de ceros se leen; 64 KiB + 1 ya cuentan para la razón", () => {
    par(zip([{ nombre: "a", datos: new Uint8Array(64 * KiB) }]), zip([{ nombre: "a", datos: new Uint8Array(64 * KiB + 1) }]), "ZIP_RAZON_EXCESIVA");
  });

  it("una bomba real (16 MiB de ceros en unos KiB) se rechaza al abrir, sin inflar", () => {
    const bomba = zip([{ nombre: "xl/worksheets/sheet1.xml", datos: new Uint8Array(16 * MiB) }]);
    expect(bomba.length).toBeLessThan(64 * KiB);
    expect(alAbrir(bomba)).toBe("ZIP_RAZON_EXCESIVA");
  });

  it("una bomba que miente en el tamaño declarado la corta maxOutputLength al leer: ZIP_INFLADO_EXCESIVO", () => {
    const datos = new Uint8Array(1 * MiB);
    const mentira = zip([{ nombre: "a", datos, real: 4613 }]);
    expect(alAbrir(mentira)).toBe("ABIERTO");
    expect(alLeer(mentira)).toBe("ZIP_INFLADO_EXCESIVO");
  });

  it("largo de nombre: 256 bytes pasan, 257 no", () => {
    par(zip([entrada("n".repeat(256))]), zip([entrada("n".repeat(257))]), "ZIP_NOMBRE_INVALIDO");
  });

  it("los mensajes son fijos por código: nunca llevan el nombre de una entrada", () => {
    for (const bytes of [zip([entrada("../FICTMARCA")]), zip([entrada("FICTMARCA"), entrada("FICTMARCA")]), zip([entrada("FICTMARCA", "x", { metodo: 12 })])]) {
      try {
        abrirZipAcotado(bytes);
        expect.unreachable("debía rechazarse");
      } catch (e) {
        expect(e).toBeInstanceOf(ErrorZip);
        expect((e as ErrorZip).message).not.toContain("FICTMARCA");
      }
    }
  });

  it("una falla que no es del lector sale como ZIP_ERROR_INTERNO, sin la causa", () => {
    const traicionero = new Proxy(new Uint8Array(64), {
      get() {
        throw new Error("causa FICTMARCA");
      },
    });
    expect(() => abrirZipAcotado(traicionero)).toThrow(expect.objectContaining({ codigo: "ZIP_ERROR_INTERNO" }));
    try {
      abrirZipAcotado(traicionero);
    } catch (e) {
      expect((e as Error).message).not.toContain("FICTMARCA");
    }
  });

  it("leer con algo que no es un nombre conocido (aunque no sea texto) da ZIP_ENTRADA_INEXISTENTE", () => {
    const archivo = abrirZipAcotado(zip(UNA));
    expect(() => archivo.leer(Symbol("x") as unknown as string)).toThrow(expect.objectContaining({ codigo: "ZIP_ENTRADA_INEXISTENTE" }));
    expect(() => archivo.leer("__proto__")).toThrow(expect.objectContaining({ codigo: "ZIP_ENTRADA_INEXISTENTE" }));
  });
});
