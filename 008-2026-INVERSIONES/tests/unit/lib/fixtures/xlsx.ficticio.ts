/**
 * Generadores de zip (y de un xlsx mínimo) para las pruebas del lector acotado (`src/lib/zip-acotado.ts`). Todo el
 * contenido es inventado (`FICT…`, fechas de 2027). No se versiona ningún `.zip` ni `.xlsx` suelto: se arman en código.
 * `armarZip` escribe un zip correcto por defecto y deja torcer cada campo (perillas) para las mutaciones.
 * El CRC lo calcula `zlib.crc32` de Node, NO el del lector: así un error compartido entre escritor y lector se nota.
 */
import { crc32, deflateRawSync } from "node:zlib";

export const FIRMA_LOCAL = 0x04034b50;
export const FIRMA_CENTRAL = 0x02014b50;
export const FIRMA_FIN = 0x06054b50;
export const FIRMA_DESCRIPTOR = 0x08074b50;
export const FIRMA_LOCALIZADOR_ZIP64 = 0x07064b50;

/** 2027-03-17 09:41:12 en formato DOS. */
const FECHA_DOS = ((2027 - 1980) << 9) | (3 << 5) | 17;
const HORA_DOS = (9 << 11) | (41 << 5) | (12 >> 1);

const enc = new TextEncoder();
export const ascii = (texto: string): Uint8Array => enc.encode(texto);

/** Campos de una cabecera (local o central) que una mutación puede torcer. */
export interface CamposCabecera {
  readonly firma: number;
  readonly version: number;
  readonly banderas: number;
  readonly metodo: number;
  readonly crc: number;
  readonly comprimido: number;
  readonly real: number;
  readonly nombre: Uint8Array;
  readonly extra: Uint8Array;
}

export interface CamposCentral extends CamposCabecera {
  readonly disco: number;
  readonly offset: number;
  readonly comentario: Uint8Array;
}

export interface Descriptor {
  readonly firma: boolean;
  readonly crc?: number;
  readonly comprimido?: number;
  readonly real?: number;
}

export interface EntradaZip {
  readonly nombre: string;
  readonly datos: Uint8Array;
  /** 8 (deflate) por defecto. */
  readonly metodo?: number;
  /** Bytes comprimidos tal cual (si no, deflateRawSync de `datos` con el método 8, o `datos` con otro). */
  readonly comprimidos?: Uint8Array;
  readonly banderas?: number;
  /** Lo que se escribe en las dos cabeceras (y en el descriptor); por defecto, lo verdadero. */
  readonly crc?: number;
  readonly real?: number;
  readonly local?: Partial<CamposCabecera>;
  readonly central?: Partial<CamposCentral>;
  /** Bit 3: CRC y tamaños después de los datos; la cabecera local los lleva en 0. */
  readonly descriptor?: Descriptor;
}

export interface CamposFin {
  readonly disco: number;
  readonly discoCentral: number;
  readonly entradasDisco: number;
  readonly entradas: number;
  readonly tamanoCentral: number;
  readonly offsetCentral: number;
  readonly largoComentario: number;
}

export interface OpcionesZip {
  /** Bytes antes de la primera entrada (los offsets los cuentan, como un autoextraíble). */
  readonly antes?: Uint8Array;
  /** Bytes sueltos después de la entrada `indice` (un hueco entre entradas). */
  readonly hueco?: { readonly indice: number; readonly bytes: Uint8Array };
  /** Bytes entre el directorio central y el fin (p. ej. un localizador ZIP64). */
  readonly antesDelFin?: Uint8Array;
  readonly comentario?: Uint8Array;
  /** Bytes después del registro de fin. */
  readonly cola?: Uint8Array;
  readonly fin?: Partial<CamposFin>;
}

class Escritor {
  private readonly partes: Uint8Array[] = [];
  largo = 0;
  u16(v: number): this {
    return this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff));
  }
  u32(v: number): this {
    return this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff));
  }
  bytes(b: Uint8Array): this {
    this.partes.push(b);
    this.largo += b.length;
    return this;
  }
  resultado(): Uint8Array {
    const salida = new Uint8Array(this.largo);
    let p = 0;
    for (const b of this.partes) {
      salida.set(b, p);
      p += b.length;
    }
    return salida;
  }
}

function comprimir(e: EntradaZip): Uint8Array {
  if (e.comprimidos) return e.comprimidos;
  return (e.metodo ?? 8) === 8 ? new Uint8Array(deflateRawSync(e.datos)) : e.datos;
}

interface Armada {
  readonly central: CamposCentral;
}

function escribirEntrada(w: Escritor, e: EntradaZip): Armada {
  const comprimidos = comprimir(e);
  const banderas = e.banderas ?? (e.descriptor ? 0x08 : 0);
  const base: CamposCabecera = {
    firma: FIRMA_LOCAL,
    version: 20,
    banderas,
    metodo: e.metodo ?? 8,
    crc: e.crc ?? crc32(e.datos),
    comprimido: comprimidos.length,
    real: e.real ?? e.datos.length,
    nombre: ascii(e.nombre),
    extra: new Uint8Array(),
  };
  const ceros = e.descriptor ? { crc: 0, comprimido: 0, real: 0 } : {};
  const local: CamposCabecera = { ...base, ...ceros, ...e.local };
  const offset = w.largo;
  w.u32(local.firma).u16(local.version).u16(local.banderas).u16(local.metodo).u16(HORA_DOS).u16(FECHA_DOS);
  w.u32(local.crc).u32(local.comprimido).u32(local.real).u16(local.nombre.length).u16(local.extra.length);
  w.bytes(local.nombre).bytes(local.extra).bytes(comprimidos);
  if (e.descriptor) {
    if (e.descriptor.firma) w.u32(FIRMA_DESCRIPTOR);
    w.u32(e.descriptor.crc ?? base.crc).u32(e.descriptor.comprimido ?? base.comprimido).u32(e.descriptor.real ?? base.real);
  }
  const central: CamposCentral = { ...base, firma: FIRMA_CENTRAL, disco: 0, offset, comentario: new Uint8Array(), ...e.central };
  return { central };
}

function escribirCentral(w: Escritor, c: CamposCentral): void {
  w.u32(c.firma).u16(0x0314).u16(c.version).u16(c.banderas).u16(c.metodo).u16(HORA_DOS).u16(FECHA_DOS);
  w.u32(c.crc).u32(c.comprimido).u32(c.real).u16(c.nombre.length).u16(c.extra.length).u16(c.comentario.length);
  w.u16(c.disco).u16(0).u32(0o100644 << 16).u32(c.offset);
  w.bytes(c.nombre).bytes(c.extra).bytes(c.comentario);
}

/** Arma un zip: correcto por defecto; cada perilla tuerce un solo campo. */
export function armarZip(entradas: readonly EntradaZip[], opciones: OpcionesZip = {}): Uint8Array {
  const w = new Escritor();
  if (opciones.antes) w.bytes(opciones.antes);
  const centrales = entradas.map((e, k) => {
    const { central } = escribirEntrada(w, e);
    if (opciones.hueco?.indice === k) w.bytes(opciones.hueco.bytes);
    return central;
  });
  const inicioCentral = w.largo;
  for (const c of centrales) escribirCentral(w, c);
  const tamanoCentral = w.largo - inicioCentral;
  if (opciones.antesDelFin) w.bytes(opciones.antesDelFin);
  const comentario = opciones.comentario ?? new Uint8Array();
  const fin: CamposFin = {
    disco: 0,
    discoCentral: 0,
    entradasDisco: entradas.length,
    entradas: entradas.length,
    tamanoCentral,
    offsetCentral: inicioCentral,
    largoComentario: comentario.length,
    ...opciones.fin,
  };
  w.u32(FIRMA_FIN).u16(fin.disco).u16(fin.discoCentral).u16(fin.entradasDisco).u16(fin.entradas);
  w.u32(fin.tamanoCentral).u32(fin.offsetCentral).u16(fin.largoComentario).bytes(comentario);
  if (opciones.cola) w.bytes(opciones.cola);
  return w.resultado();
}

/** Campo extra TLV (id, datos). */
export function extra(id: number, datos: Uint8Array): Uint8Array {
  const w = new Escritor();
  return w.u16(id).u16(datos.length).bytes(datos).resultado();
}

/** Localizador ZIP64 de 20 bytes (lo que un zip ZIP64 pone justo antes del registro de fin). */
export function localizadorZip64(): Uint8Array {
  return new Escritor().u32(FIRMA_LOCALIZADOR_ZIP64).u32(0).u32(0).u32(0).u32(1).resultado();
}

/**
 * Vectores dorados escritos por OTRA implementación (zipfile de CPython 3.14, con fecha fija 2027-03-17 09:41:12):
 * una entrada almacenada y una con deflate. `ZIP_DORADO_FLUJO` es el mismo zip escrito a un flujo sin `seek`, así que
 * lleva el bit 3 y un descriptor con firma después de cada entrada. Se generaron con:
 *   python3 -I -c 'import io,zipfile,base64; …ZipInfo("FICT/almacenado.ficticio.txt",(2027,3,17,9,41,12))…'
 * (guion completo en el cuerpo del PR). El contenido es inventado.
 */
export const ZIP_DORADO = Buffer.from(
  "UEsDBBQAAAAAACZNcV7E/mssGAAAABgAAAAcAAAARklDVC9hbG1hY2VuYWRvLmZpY3RpY2lvLnR4dEZJQ1QgNDYxMywyNyBhbG1hY2VuYWRvClBLAwQUAAAACAAmTXFe+vB34R8AAACwAAAAHAAAAEZJQ1QvY29tcHJpbWlkby5maWN0aWNpby50eHRz83QOUTA2tzQ01DExV0jOzy0oyszNTMlXcBuUElwAUEsBAhQDFAAAAAAAJk1xXsT+aywYAAAAGAAAABwAAAAAAAAAAAAAAIABAAAAAEZJQ1QvYWxtYWNlbmFkby5maWN0aWNpby50eHRQSwECFAMUAAAACAAmTXFe+vB34R8AAACwAAAAHAAAAAAAAAAAAAAAgAFSAAAARklDVC9jb21wcmltaWRvLmZpY3RpY2lvLnR4dFBLBQYAAAAAAgACAJQAAACrAAAAAAA=",
  "base64",
);
export const ZIP_DORADO_FLUJO = Buffer.from(
  "UEsDBBQACAAAACZNcV4AAAAAAAAAAAAAAAAcAAAARklDVC9hbG1hY2VuYWRvLmZpY3RpY2lvLnR4dEZJQ1QgNDYxMywyNyBhbG1hY2VuYWRvClBLBwjE/mssGAAAABgAAABQSwMEFAAIAAgAJk1xXgAAAAAAAAAAAAAAABwAAABGSUNUL2NvbXByaW1pZG8uZmljdGljaW8udHh0c/N0DlEwNrc0NNQxMVdIzs8tKMrMzUzJV3AblBJcAFBLBwj68HfhHwAAALAAAABQSwECFAMUAAgAAAAmTXFexP5rLBgAAAAYAAAAHAAAAAAAAAAAAAAAgAEAAAAARklDVC9hbG1hY2VuYWRvLmZpY3RpY2lvLnR4dFBLAQIUAxQACAAIACZNcV768HfhHwAAALAAAAAcAAAAAAAAAAAAAACAAWIAAABGSUNUL2NvbXByaW1pZG8uZmljdGljaW8udHh0UEsFBgAAAAACAAIAlAAAAMsAAAAAAA==",
  "base64",
);
export const DORADO_ALMACENADO = { nombre: "FICT/almacenado.ficticio.txt", texto: "FICT 4613,27 almacenado\n" } as const;
export const DORADO_COMPRIMIDO = { nombre: "FICT/comprimido.ficticio.txt", texto: `${"FICT 37911,47 comprimido ".repeat(7)}\n` } as const;

/** Hoja ficticia: valores y fechas inventados, como texto. */
export const HOJA_FICTICIA = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  "<sheetData>",
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
  '<row r="2"><c r="A2"><v>46463</v></c><c r="B2"><v>4613.27</v></c></row>',
  '<row r="3"><c r="A3"><v>46464</v></c><c r="B3"><v>37911.47</v></c></row>',
  "</sheetData>",
  "</worksheet>",
].join("");

/** Un xlsx mínimo (deflate), con la estructura OPC de un libro de una hoja. */
export function xlsxMinimo(): Uint8Array {
  const partes: [string, string][] = [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="FICT" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    ["xl/sharedStrings.xml", '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><si><t>Fecha ficticia</t></si><si><t>Valor ficticio</t></si></sst>'],
    ["xl/worksheets/sheet1.xml", HOJA_FICTICIA],
  ];
  return armarZip(partes.map(([nombre, texto]) => ({ nombre, datos: ascii(texto) })));
}
