// Lector XML acotado (SDMX-ML 2.1, solo para los exportadores del Mac): sin DTD, entidades, CDATA ni instrucciones;
// solo UTF-8; topes de bytes, profundidad, atributos, elementos y nombres; árbol inmutable con valores siempre como texto.
// Cada rechazo se prueba contra su par válido (difieren en un solo cambio). Datos inventados.
import { describe, expect, it } from "vitest";
import { ErrorXml, TOPES_XML, buscarAtributo, leerXmlAcotado, type CodigoXml, type ElementoXml } from "@/lib/xml-acotado";
import {
  MARCA,
  NS_COMUN,
  NS_GENERICO,
  NS_MENSAJE,
  NS_XML,
  OBSERVACIONES_FICTICIAS,
  SDMX_FICTICIO,
  anidado,
  conAtributos,
  conElementos,
  nombreDeLargo,
  rellenoHasta,
  utf8,
} from "./fixtures/sdmx.ficticio";

const MiB = 1024 * 1024;
const leer = (entrada: string | Uint8Array): ElementoXml => leerXmlAcotado(typeof entrada === "string" ? utf8(entrada) : entrada);

/** Código del rechazo, o "LEIDO". Una excepción que no sea ErrorXml se deja pasar (la prueba falla). */
function desenlace(entrada: string | Uint8Array): CodigoXml | "LEIDO" {
  try {
    leer(entrada);
    return "LEIDO";
  } catch (e) {
    if (e instanceof ErrorXml) return e.codigo;
    throw e;
  }
}

/** Par válido/inválido: el válido se lee y el inválido falla con el código exacto. */
function par(valido: string | Uint8Array, invalido: string | Uint8Array, codigo: CodigoXml): void {
  expect(desenlace(valido), "el par válido debe leerse").toBe("LEIDO");
  expect(desenlace(invalido)).toBe(codigo);
}

const hijosLocales = (e: ElementoXml, local: string): ElementoXml[] => e.hijos.filter((h) => h.local === local);

describe("xml-acotado · lectura", () => {
  it("un elemento vacío", () => {
    expect(leer("<a/>")).toEqual({ nombre: "a", local: "a", espacio: null, atributos: [], hijos: [], texto: "" });
  });

  it("el mensaje SDMX ficticio: nombres, espacios de nombres, atributos y valores como texto", () => {
    const raiz = leer(SDMX_FICTICIO);
    expect(raiz).toMatchObject({ nombre: "message:GenericData", local: "GenericData", espacio: NS_MENSAJE });
    const [cabecera, datos] = raiz.hijos;
    expect(cabecera?.hijos[0]).toMatchObject({ local: "ID", espacio: NS_MENSAJE, texto: "FICT_MENSAJE_4613" });
    const nombre = cabecera?.hijos[2]?.hijos[0];
    expect(nombre).toMatchObject({ local: "Name", espacio: NS_COMUN, texto: "Emisor ficticio & asociados" });
    expect(nombre?.atributos).toEqual([{ nombre: "xml:lang", local: "lang", espacio: NS_XML, valor: "es" }]);
    const serie = datos?.hijos[0];
    expect(serie).toMatchObject({ local: "Series", espacio: NS_GENERICO });
    const obs = hijosLocales(serie!, "Obs").map((o) => ({
      dia: buscarAtributo(hijosLocales(o, "ObsDimension")[0]!, "value"),
      valor: buscarAtributo(hijosLocales(o, "ObsValue")[0]!, "value"),
    }));
    expect(obs).toEqual(OBSERVACIONES_FICTICIAS);
  });

  it("los valores nunca se vuelven número: todo texto y todo valor es string, tal cual viene", () => {
    const raiz = leer('<a v="0001.50" w="1e400"><b>-0</b><b>NaN</b><b> 4613,27 </b></a>');
    expect(raiz.atributos.map((x) => x.valor)).toEqual(["0001.50", "1e400"]);
    expect(raiz.hijos.map((h) => h.texto)).toEqual(["-0", "NaN", " 4613,27 "]);
    const pila: ElementoXml[] = [leer(SDMX_FICTICIO)];
    while (pila.length) {
      const e = pila.pop()!;
      expect(typeof e.texto).toBe("string");
      for (const x of e.atributos) expect(typeof x.valor).toBe("string");
      pila.push(...e.hijos);
    }
  });

  it("el árbol es inmutable: nodos, listas y atributos congelados", () => {
    const raiz = leer('<a x="1"><b/></a>');
    expect(Object.isFrozen(raiz)).toBe(true);
    expect(Object.isFrozen(raiz.hijos)).toBe(true);
    expect(Object.isFrozen(raiz.atributos)).toBe(true);
    expect(Object.isFrozen(raiz.atributos[0])).toBe(true);
    expect(Object.isFrozen(raiz.hijos[0])).toBe(true);
    expect(() => (raiz.hijos as ElementoXml[]).push(raiz)).toThrow(TypeError);
  });

  it("el texto es el directo del elemento, sin recortar y sin los comentarios; CRLF y CR sueltos pasan a LF", () => {
    expect(leer("<a> x <!-- c --> y <b>z</b>\r\nw\r</a>")).toMatchObject({ texto: " x  y \nw\n" });
  });

  it("las cinco entidades predefinidas y las referencias numéricas válidas; lo expandido no se reinterpreta", () => {
    expect(leer("<a>&lt;&gt;&amp;&apos;&quot;</a>").texto).toBe("<>&'\"");
    expect(leer("<a>&#9;&#10;&#13;&#x41;&#0065;&#x1F600;&#xe9;</a>").texto).toBe("\t\n\rAA\u{1F600}é");
    expect(leer("<a>&#38;lt;</a>").texto).toBe("&lt;");
  });

  it("atributos: comillas de los dos tipos, espacios literales normalizados y referencias conservadas", () => {
    const raiz = leer(`<a p='di "hola"' q="l'x" r="a\tb\nc" s="x&#10;y&#9;z" t="&lt;&amp;"/>`);
    expect(raiz.atributos.map((x) => x.valor)).toEqual(['di "hola"', "l'x", "a b c", "x\ny\tz", "<&"]);
  });

  it("nombres de atributo como __proto__ o constructor no contaminan nada", () => {
    const raiz = leer('<a __proto__="FICT" constructor="x" toString="y"/>');
    expect(buscarAtributo(raiz, "__proto__")).toBe("FICT");
    expect(buscarAtributo(raiz, "constructor")).toBe("x");
    expect(buscarAtributo(raiz, "hasOwnProperty")).toBeUndefined();
    expect(({} as Record<string, unknown>).FICT).toBeUndefined();
  });

  it("buscarAtributo distingue el espacio de nombres del atributo", () => {
    const raiz = leer('<a xmlns:p="urn:fict:p" p:v="con" v="sin"/>');
    expect(buscarAtributo(raiz, "v")).toBe("sin");
    expect(buscarAtributo(raiz, "v", "urn:fict:p")).toBe("con");
    expect(buscarAtributo(raiz, "w")).toBeUndefined();
    expect(raiz.atributos).toHaveLength(2);
  });

  it("espacios de nombres: el de por defecto va a los elementos y no a los atributos; se re-declara y se desliga", () => {
    const raiz = leer('<a xmlns="urn:fict:d" x="1"><b xmlns="urn:fict:e"/><c xmlns=""/><p:d xmlns:p="urn:fict:p"><p:e xmlns:p="urn:fict:q"/></p:d></a>');
    expect(raiz).toMatchObject({ local: "a", espacio: "urn:fict:d" });
    expect(raiz.atributos[0]).toMatchObject({ local: "x", espacio: null });
    expect(raiz.hijos.map((h) => h.espacio)).toEqual(["urn:fict:e", null, "urn:fict:p"]);
    expect(raiz.hijos[2]?.hijos[0]).toMatchObject({ nombre: "p:e", local: "e", espacio: "urn:fict:q" });
  });

  it("xml:lang sin declarar y xmlns:xml ligado a su URI propio se aceptan", () => {
    expect(leer('<a xml:lang="es"/>').atributos[0]).toMatchObject({ espacio: NS_XML });
    expect(desenlace(`<a xmlns:xml="${NS_XML}"/>`)).toBe("LEIDO");
  });

  it.each([
    ["sin declaración", "<a/>"],
    ["declaración con comillas dobles", '<?xml version="1.0"?><a/>'],
    ["declaración con comillas simples y encoding", "<?xml version='1.0' encoding='UTF-8'?><a/>"],
    ["encoding en minúsculas y standalone", '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<a/>'],
    ["espacios alrededor del igual", '<?xml version = "1.0" ?><a/>'],
    ["BOM UTF-8 y declaración", "\uFEFF<?xml version=\"1.0\"?><a/>"],
    ["comentarios antes y después de la raíz", "<!-- antes --><a/><!-- después -->\n"],
    ["espacios dentro de las etiquetas", '<a\n  b="1"\t/>'],
    ["espacios antes del cierre", "<a></a  >"],
    ["U+007F y caracteres fuera del BMP en el texto", "<a>\u007F\u{1F600}ñ</a>"],
  ])("se lee: %s", (_caso, xml) => {
    expect(desenlace(xml)).toBe("LEIDO");
  });

  it("la entrada puede ser un Buffer o una vista con byteOffset distinto de 0", () => {
    expect(leerXmlAcotado(Buffer.from("<a>FICT</a>")).texto).toBe("FICT");
    const grande = utf8("xxxx<a>FICT</a>yyyy");
    expect(leerXmlAcotado(grande.subarray(4, grande.length - 4)).texto).toBe("FICT");
  });

  it("un XHTML bien formado SÍ se lee: el lector no valida esquemas (el consumidor valida raíz y espacio)", () => {
    expect(leer('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>')).toMatchObject({ local: "html" });
  });
});

describe("xml-acotado · prohibidos (DTD, entidades, CDATA, instrucciones)", () => {
  it.each([
    ["DOCTYPE simple", "<!DOCTYPE a><a/>"],
    ["DOCTYPE con subconjunto interno y entidad", '<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>'],
    ["billion laughs", '<!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><l>&b;</l>'],
    ["XXE con SYSTEM", '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'],
    ["entidad de parámetro", '<!DOCTYPE a [<!ENTITY % p "x"> %p;]><a/>'],
    ["doctype de HTML en minúsculas", "<!doctype html><html></html>"],
    ["declaración de elemento suelta", "<a><!ELEMENT a ANY></a>"],
  ])("%s: XML_DOCTYPE_PROHIBIDO", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_DOCTYPE_PROHIBIDO");
  });

  it("<!ENTITY en el cuerpo: XML_ENTIDAD_PROHIBIDA; dentro de un comentario no cuenta", () => {
    par('<a><!-- <!ENTITY x "y"> --></a>', '<a><!ENTITY x "y"></a>', "XML_ENTIDAD_PROHIBIDA");
  });

  it("CDATA: XML_CDATA_PROHIBIDO; ]]> suelto en el texto: XML_MAL_FORMADO", () => {
    par("<a>x</a>", "<a><![CDATA[x]]></a>", "XML_CDATA_PROHIBIDO");
    par("<a>]]</a>", "<a>]]></a>", "XML_MAL_FORMADO");
  });

  it.each([
    ["hoja de estilo", '<?xml-stylesheet href="x"?><a/>'],
    ["instrucción dentro del cuerpo", "<a><?php x ?></a>"],
    ["instrucción después de la raíz", "<a/><?p?>"],
    ["declaración después de un espacio", ' <?xml version="1.0"?><a/>'],
    ["declaración después de un comentario", '<!--c--><?xml version="1.0"?><a/>'],
    ["declaración en mayúsculas", '<?XML version="1.0"?><a/>'],
    ["segunda declaración", '<?xml version="1.0"?><?xml version="1.0"?><a/>'],
  ])("%s: XML_INSTRUCCION_PROHIBIDA", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_INSTRUCCION_PROHIBIDA");
  });

  it.each([
    ["sin pseudo-atributos", "<?xml?><a/>"],
    ["versión 1.1", '<?xml version="1.1"?><a/>'],
    ["sin versión", '<?xml encoding="UTF-8"?><a/>'],
    ["pseudo-atributo desconocido", '<?xml version="1.0" foo="x"?><a/>'],
    ["orden distinto", '<?xml version="1.0" standalone="yes" encoding="UTF-8"?><a/>'],
    ["sin comillas", "<?xml version=1.0?><a/>"],
    ["comillas mezcladas", "<?xml version=\"1.0'?><a/>"],
    ["standalone inválido", '<?xml version="1.0" standalone="maybe"?><a/>'],
    ["sin cerrar", '<?xml version="1.0"'],
  ])("declaración inválida (%s): XML_DECLARACION_INVALIDA", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_DECLARACION_INVALIDA");
  });
});

describe("xml-acotado · codificación y caracteres", () => {
  it.each([
    ["ISO-8859-1", '<?xml version="1.0" encoding="ISO-8859-1"?><a/>'],
    ["windows-1252", '<?xml version="1.0" encoding="windows-1252"?><a/>'],
    ["UTF-16 declarado", '<?xml version="1.0" encoding="UTF-16"?><a/>'],
  ])("encoding %s: XML_CODIFICACION_NO_SOPORTADA", (_caso, xml) => {
    par('<?xml version="1.0" encoding="UTF-8"?><a/>', xml, "XML_CODIFICACION_NO_SOPORTADA");
  });

  it.each([
    ["BOM UTF-16 LE", [0xff, 0xfe, 0x3c, 0x00, 0x61, 0x00, 0x2f, 0x00, 0x3e, 0x00]],
    ["BOM UTF-16 BE", [0xfe, 0xff, 0x00, 0x3c, 0x00, 0x61, 0x00, 0x2f, 0x00, 0x3e]],
    ["BOM UTF-32 BE", [0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x3c]],
  ])("%s: XML_CODIFICACION_NO_SOPORTADA", (_caso, bytes) => {
    expect(desenlace(Uint8Array.from(bytes))).toBe("XML_CODIFICACION_NO_SOPORTADA");
  });

  it.each([
    ["byte 0xFF", [0x3c, 0x61, 0x3e, 0xff, 0x3c, 0x2f, 0x61, 0x3e]],
    ["sobrelargo C0 AF", [0x3c, 0x61, 0x3e, 0xc0, 0xaf, 0x3c, 0x2f, 0x61, 0x3e]],
    ["sustituto codificado ED A0 80", [0x3c, 0x61, 0x3e, 0xed, 0xa0, 0x80, 0x3c, 0x2f, 0x61, 0x3e]],
    ["multibyte truncado al final", [0x3c, 0x61, 0x2f, 0x3e, 0xe2, 0x82]],
  ])("UTF-8 inválido (%s): XML_UTF8_INVALIDO", (_caso, bytes) => {
    expect(desenlace(Uint8Array.from(bytes))).toBe("XML_UTF8_INVALIDO");
  });

  it("UTF-16 sin BOM trae NUL: XML_CARACTER_INVALIDO", () => {
    expect(desenlace(Uint8Array.from([0x00, 0x3c, 0x00, 0x61, 0x00, 0x2f, 0x00, 0x3e]))).toBe("XML_CARACTER_INVALIDO");
  });

  it.each([
    ["U+0000", "\u0000"],
    ["U+0001", "\u0001"],
    ["U+000B", "\u000B"],
    ["U+001F", "\u001F"],
    ["U+FFFE", "\uFFFE"],
    ["U+FFFF", "\uFFFF"],
  ])("carácter literal %s: XML_CARACTER_INVALIDO (en texto y en atributo)", (_caso, c) => {
    par("<a>x</a>", `<a>${c}</a>`, "XML_CARACTER_INVALIDO");
    expect(desenlace(`<a b="${c}"/>`)).toBe("XML_CARACTER_INVALIDO");
  });

  it.each([
    "&#0;", "&#x0;", "&#1;", "&#x8;", "&#xB;", "&#xC;", "&#x1F;", "&#xD800;", "&#xDFFF;", "&#xFFFE;", "&#xFFFF;", "&#x110000;",
    "&#99999999999999999999;", "&#;", "&#x;", "&#X41;", "&#xG;", "&#-1;", "&#4 1;",
  ])("referencia numérica inválida %s: XML_REFERENCIA_INVALIDA", (ref) => {
    par("<a>&#x41;</a>", `<a>${ref}</a>`, "XML_REFERENCIA_INVALIDA");
  });

  it("entidad con nombre desconocida: XML_ENTIDAD_DESCONOCIDA (también en atributo)", () => {
    par("<a>&amp;</a>", "<a>&nbsp;</a>", "XML_ENTIDAD_DESCONOCIDA");
    expect(desenlace("<a>&foo;</a>")).toBe("XML_ENTIDAD_DESCONOCIDA");
    expect(desenlace('<a b="&foo;"/>')).toBe("XML_ENTIDAD_DESCONOCIDA");
  });

  it("& suelto, sin ; o con un nombre que no es ASCII: XML_MAL_FORMADO", () => {
    par("<a>&amp;</a>", "<a>& </a>", "XML_MAL_FORMADO");
    expect(desenlace("<a>&amp</a>")).toBe("XML_MAL_FORMADO");
    expect(desenlace("<a>&ámbito;</a>")).toBe("XML_MAL_FORMADO");
    expect(desenlace(`<a>&${"x".repeat(40)};</a>`)).toBe("XML_MAL_FORMADO");
  });
});

describe("xml-acotado · atributos, espacios de nombres y nombres", () => {
  it("atributo duplicado por nombre calificado, por nombre expandido o xmlns repetido: XML_ATRIBUTO_DUPLICADO", () => {
    par('<a x="1" y="2"/>', '<a x="1" x="2"/>', "XML_ATRIBUTO_DUPLICADO");
    par('<a xmlns:p="urn:f" xmlns:q="urn:g" p:x="1" q:x="2"/>', '<a xmlns:p="urn:f" xmlns:q="urn:f" p:x="1" q:x="2"/>', "XML_ATRIBUTO_DUPLICADO");
    par('<a xmlns:p="urn:f"/>', '<a xmlns:p="urn:f" xmlns:p="urn:f"/>', "XML_ATRIBUTO_DUPLICADO");
  });

  it.each([
    ["sin comillas", "<a x=1/>"],
    ["sin igual", '<a x "1"/>'],
    ["< dentro del valor", '<a x="<"/>'],
    ["sin espacio entre atributos", '<a x="1"y="2"/>'],
    ["atributo sin valor", "<a x/>"],
  ])("atributo mal formado (%s): XML_MAL_FORMADO", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_MAL_FORMADO");
  });

  it("prefijo no declarado (elemento, atributo o declarado solo en un hermano): XML_PREFIJO_DESCONOCIDO", () => {
    par('<p:a xmlns:p="urn:f"/>', "<p:a/>", "XML_PREFIJO_DESCONOCIDO");
    par('<a xmlns:p="urn:f" p:x="1"/>', '<a p:x="1"/>', "XML_PREFIJO_DESCONOCIDO");
    par('<r><a xmlns:p="urn:f"><p:b/></a></r>', '<r><a xmlns:p="urn:f"/><p:b/></r>', "XML_PREFIJO_DESCONOCIDO");
  });

  it.each([
    ["desligar un prefijo", '<a xmlns:p=""/>'],
    ["re-ligar xml a otro URI", '<a xmlns:xml="urn:otro"/>'],
    ["ligar xmlns", '<a xmlns:xmlns="urn:f"/>'],
    ["ligar otro prefijo al URI de xml", `<a xmlns:p="${NS_XML}"/>`],
    ["el espacio por defecto al URI de xml", `<a xmlns="${NS_XML}"/>`],
    ["ligar al URI de xmlns", '<a xmlns:p="http://www.w3.org/2000/xmlns/"/>'],
  ])("declaración de espacio inválida (%s): XML_ESPACIO_INVALIDO", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_ESPACIO_INVALIDO");
  });

  it("el cierre se compara por nombre calificado, no por espacio: XML_ETIQUETA_DESCUADRADA", () => {
    par('<a:x xmlns:a="urn:f" xmlns:b="urn:f"></a:x>', '<a:x xmlns:a="urn:f" xmlns:b="urn:f"></b:x>', "XML_ETIQUETA_DESCUADRADA");
    expect(desenlace("<a><b></a></b>")).toBe("XML_ETIQUETA_DESCUADRADA");
  });

  it.each([["<1a/>"], ["<a:b:c/>"], ["<:a/>"], ["<a:/>"], ["<ñ/>"], ['<a ñ="1"/>'], ['<a 1x="1"/>']])("nombre inválido %s: XML_NOMBRE_INVALIDO", (xml) => {
    expect(desenlace(xml)).toBe("XML_NOMBRE_INVALIDO");
  });

  it("espacio después de < o entre / y >: XML_MAL_FORMADO", () => {
    par("<a/>", "< a/>", "XML_MAL_FORMADO");
    expect(desenlace("<a/ >")).toBe("XML_MAL_FORMADO");
    expect(desenlace("<a></ a>")).toBe("XML_MAL_FORMADO");
  });
});

describe("xml-acotado · estructura y HTML en vez de XML", () => {
  it.each([["vacío", ""], ["solo espacios", " \n\t "], ["solo la declaración", '<?xml version="1.0"?>'], ["solo un comentario", "<!-- c -->"]])(
    "%s: XML_SIN_RAIZ",
    (_caso, xml) => {
      expect(desenlace(xml)).toBe("XML_SIN_RAIZ");
    },
  );

  it.each([
    ["dos raíces", "<a/><b/>"],
    ["texto antes de la raíz", "x<a/>"],
    ["texto después de la raíz", "<a/>x"],
    ["un cierre suelto", "</a>"],
    ["una referencia fuera de la raíz", "&amp;<a/>"],
    ["un cuerpo JSON de error", '{"error":"FICT"}'],
    ["comentario con -- adentro", "<a><!-- x -- y --></a>"],
    ["comentario que termina en ---", "<a><!-- x ---></a>"],
    ["un <! desconocido", "<a><!x></a>"],
  ])("%s: XML_MAL_FORMADO", (_caso, xml) => {
    expect(desenlace(xml)).toBe("XML_MAL_FORMADO");
  });

  it.each([["sin cerrar", "<a><b/>"], ["comentario sin cerrar", "<a><!-- x"], ["etiqueta sin cerrar", '<a b="1"'], ["valor sin cerrar", '<a b="1/>'], ["cierre sin >", "<a></a"]])(
    "%s: XML_INCOMPLETO",
    (_caso, xml) => {
      expect(desenlace(xml)).toBe("XML_INCOMPLETO");
    },
  );

  it("HTML en vez de XML: con doctype, con etiquetas vacías sin cerrar o con &nbsp;", () => {
    expect(desenlace("<!doctype html><html><head><title>HTTP Status 406</title></head></html>")).toBe("XML_DOCTYPE_PROHIBIDO");
    expect(desenlace('<html><head><meta charset="utf-8"></head></html>')).toBe("XML_ETIQUETA_DESCUADRADA");
    expect(desenlace("<p>a&nbsp;b</p>")).toBe("XML_ENTIDAD_DESCONOCIDA");
    expect(desenlace("<p>uno<br>dos</p>")).toBe("XML_ETIQUETA_DESCUADRADA");
  });

  it("el mensaje del error es fijo por código: nunca lleva bytes ni texto de la entrada", () => {
    for (const xml of [`<${MARCA}>`, `<a>&${MARCA};</a>`, `<a ${MARCA}="1" ${MARCA}="2"/>`, `<!DOCTYPE ${MARCA}>`]) {
      try {
        leer(xml);
        expect.unreachable("debía rechazarse");
      } catch (e) {
        expect(e).toBeInstanceOf(ErrorXml);
        expect((e as ErrorXml).name).toBe("ErrorXml");
        expect((e as ErrorXml).message).not.toContain(MARCA);
        expect((e as ErrorXml).message.length).toBeGreaterThan(10);
      }
    }
  });

  it("una falla que no es del lector sale como XML_ERROR_INTERNO, sin la causa", () => {
    const traicionero = new Proxy(new Uint8Array(8), {
      get() {
        throw new Error(`causa con ${MARCA}`);
      },
    });
    try {
      leerXmlAcotado(traicionero);
      expect.unreachable("debía rechazarse");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorXml);
      expect((e as ErrorXml).codigo).toBe("XML_ERROR_INTERNO");
      expect((e as ErrorXml).message).not.toContain(MARCA);
    }
  });
});

describe("xml-acotado · topes (N pasa, N+1 no)", () => {
  it("los topes son estos y están congelados", () => {
    expect(TOPES_XML).toEqual({ bytes: 4 * MiB, profundidad: 32, atributosPorElemento: 64, elementos: 200_000, largoNombre: 256 });
    expect(Object.isFrozen(TOPES_XML)).toBe(true);
  });

  it("bytes: 4 MiB pasa, uno más no; el tope se mira antes de decodificar; la BOM cuenta", () => {
    par(rellenoHasta(4 * MiB), rellenoHasta(4 * MiB + 1), "XML_DEMASIADO_GRANDE");
    par(rellenoHasta(4 * MiB, true), rellenoHasta(4 * MiB + 1, true), "XML_DEMASIADO_GRANDE");
    expect(desenlace(new Uint8Array(4 * MiB + 1).fill(0xff))).toBe("XML_DEMASIADO_GRANDE");
  });

  it("profundidad: 32 niveles pasan, 33 no; 100 000 niveles fallan con el código, sin desbordar la pila", () => {
    par(anidado(32), anidado(33), "XML_PROFUNDIDAD_EXCESIVA");
    expect(desenlace(anidado(100_000))).toBe("XML_PROFUNDIDAD_EXCESIVA");
  });

  it("atributos por elemento: 64 pasan, 65 no; las declaraciones xmlns cuentan", () => {
    par(conAtributos(64), conAtributos(65), "XML_DEMASIADOS_ATRIBUTOS");
    const conEspacios = (n: number) => `<a xmlns="urn:f" xmlns:p="urn:g" ${Array.from({ length: n }, (_v, k) => `a${k}="${k}"`).join(" ")}/>`;
    par(conEspacios(62), conEspacios(63), "XML_DEMASIADOS_ATRIBUTOS");
  });

  it("elementos en total: 200 000 pasan (con la raíz), 200 001 no", () => {
    par(conElementos(200_000), conElementos(200_001), "XML_DEMASIADOS_ELEMENTOS");
  });

  it("largo de nombre: 256 pasa, 257 no (en elemento, en atributo y en prefijo:local)", () => {
    par(`<${nombreDeLargo(256)}/>`, `<${nombreDeLargo(257)}/>`, "XML_NOMBRE_INVALIDO");
    par(`<a ${nombreDeLargo(256)}="1"/>`, `<a ${nombreDeLargo(257)}="1"/>`, "XML_NOMBRE_INVALIDO");
    const calificado = (n: number) => `<p:${nombreDeLargo(n - 2)} xmlns:p="urn:f"/>`;
    par(calificado(256), calificado(257), "XML_NOMBRE_INVALIDO");
  });

  it("rendimiento lineal: 4 MiB de referencias, un atributo enorme y muchos hermanos en poco tiempo", { timeout: 30_000 }, () => {
    const inicio = performance.now();
    expect(leer(`<a>${"&amp;".repeat(800_000)}</a>`).texto.length).toBe(800_000);
    expect(leer(`<a v="${"x".repeat(4 * MiB - 16)}"/>`).atributos[0]?.valor.length).toBe(4 * MiB - 16);
    expect(leer(conElementos(200_000)).hijos).toHaveLength(199_999);
    expect(desenlace(`<a>${"&#x41;".repeat(600_000)}</a>`)).toBe("LEIDO");
    expect(performance.now() - inicio).toBeLessThan(15_000);
  });
});
