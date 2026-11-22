/**
 * Construcción validada del paquete de hechos: los casos felices de los tres tipos y un rechazo por cada código, con
 * la posición del hecho y el campo, y sin datos en el mensaje.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO, CLAVE_ANCLA_REGLA } from "@/ia/catalogo";
import type { EntradaPaquete, PaqueteHechos } from "@/ia/contrato";
import { hashPaquete } from "@/ia/hash";
import { CODIGOS_ERROR_PAQUETE, ErrorPaquete, construirPaquete, esPaqueteConstruido, especieDe, idDeHecho, leerPaquete, type CodigoErrorPaquete } from "@/ia/paquete";
import { vistaCiega } from "@/ia/vista-ciega";
import { ENTRADAS_FICTICIAS, ESPECIE_ALFA, HOY_FICTICIO, entradaDiario, entradaReglasConAnclas, hecho } from "./apoyo/hechos.ficticio";

type Crudo = Record<string, unknown> & { hechos: Record<string, unknown>[] };
const copia = (): Crudo => structuredClone(entradaDiario()) as unknown as Crudo;
const construir = (crudo: unknown): PaqueteHechos => construirPaquete(crudo as EntradaPaquete);

function errorDe(crudo: unknown): ErrorPaquete {
  try {
    construir(crudo);
  } catch (e) {
    if (e instanceof ErrorPaquete) return e;
    throw e;
  }
  throw new Error("construirPaquete no lanzó");
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** `n` hechos distintos: un nombre de especie inventado y, a continuación, el valor de esa especie. */
function conHechos(n: number): Crudo {
  const crudo = copia();
  crudo.hechos = Array.from({ length: n }, (_, i) => {
    const id = idDeHecho(i + 1);
    if (i % 2 === 1) return { ...hecho(id, "VALOR_ESPECIE", "4613.27", "$ 4.613", { sujeto: idDeHecho(i) }) };
    const k = i / 2;
    const nombre = `FICTICIA-${LETRAS[Math.floor(k / 26)]}${LETRAS[k % 26]}`;
    return { ...hecho(id, "ESPECIE_NOMBRE", nombre, nombre) };
  });
  return crudo;
}

/** [código, descripción, mutación, hecho esperado, campo esperado] */
type Caso = readonly [CodigoErrorPaquete, string, (c: Crudo) => unknown, string | null, string | null];
const h = (c: Crudo, i: number): Record<string, unknown> => c.hechos[i] as Record<string, unknown>;

const CASOS: readonly Caso[] = [
  ["FORMA_INVALIDA", "la entrada no es un objeto", () => null, null, null],
  ["FORMA_INVALIDA", "la entrada es un arreglo", () => [], null, null],
  ["CAMPO_DESCONOCIDO", "un campo de más en la raíz", (c) => ({ ...c, extra: "x" }), null, null],
  ["CLAVE_PROHIBIDA", "un correo en la raíz", (c) => ({ ...c, correo: "x" }), null, null],
  ["CAMPO_FALTANTE", "faltan los avisos", (c) => ({ ...c, avisos: undefined }), null, "avisos"],
  ["TIPO_INVALIDO", "tipo fuera de la lista", (c) => ({ ...c, tipo: "SEMANAL" }), null, "tipo"],
  ["HOY_INVALIDO", "hoy no existe", (c) => ({ ...c, hoy: "2027-02-30" }), null, "hoy"],
  ["VERSIONES_CALCULO_INVALIDAS", "versiones con clave en mayúscula", (c) => ({ ...c, versionesCalculo: { Tablero: "tablero-v7" } }), null, "versionesCalculo"],
  ["VERSIONES_CALCULO_INVALIDAS", "versiones con clave prohibida", (c) => ({ ...c, versionesCalculo: { usuario: "tablero-v7" } }), null, "versionesCalculo"],
  ["VERSIONES_CALCULO_INVALIDAS", "versiones con valor no texto", (c) => ({ ...c, versionesCalculo: { tablero: 7 } }), null, "versionesCalculo"],
  ["VERSIONES_CALCULO_INVALIDAS", "versiones en arreglo", (c) => ({ ...c, versionesCalculo: ["tablero-v7"] }), null, "versionesCalculo"],
  ["VERSIONES_CALCULO_INVALIDAS", "demasiadas versiones", (c) => ({ ...c, versionesCalculo: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`calculo${"abcdefghijklmnopq"[i]}`, "v-ficticia"])) }), null, "versionesCalculo"],
  ["AVISOS_INVALIDOS", "aviso con minúsculas", (c) => ({ ...c, avisos: ["aviso libre"] }), null, "avisos"],
  ["AVISOS_INVALIDOS", "avisos repetidos", (c) => ({ ...c, avisos: ["AVISO_FICTICIO", "AVISO_FICTICIO"] }), null, "avisos"],
  ["AVISOS_INVALIDOS", "demasiados avisos", (c) => ({ ...c, avisos: Array.from({ length: 33 }, (_, i) => `AVISO_${i}`) }), null, "avisos"],
  ["AVISOS_INVALIDOS", "avisos que no son arreglo", (c) => ({ ...c, avisos: "AVISO" }), null, "avisos"],
  ["AVISOS_INVALIDOS", "avisos con huecos", (c) => ({ ...c, avisos: [, "AVISO"] }), null, "avisos"],
  ["FORMA_INVALIDA", "hechos que no son arreglo", (c) => ({ ...c, hechos: {} }), null, "hechos"],
  ["SIN_HECHOS", "sin hechos", (c) => ({ ...c, hechos: [] }), null, "hechos"],
  ["DEMASIADOS_HECHOS", "cien hechos", () => ({ ...conHechos(99), hechos: [...conHechos(99).hechos, {}] }), null, "hechos"],
  ["FORMA_INVALIDA", "un hecho que no es objeto", (c) => ({ ...c, hechos: [c.hechos[0], c.hechos[1], "H03"] }), "H03", null],
  ["CAMPO_DESCONOCIDO", "un campo de más en el hecho", (c) => (h(c, 2).extra = "x", c), "H03", null],
  ["CAMPO_DESCONOCIDO", "la etiqueta la pone el catálogo", (c) => (h(c, 2).etiqueta = "valor de las acciones", c), "H03", null],
  ["CAMPO_DESCONOCIDO", "la unidad la pone el catálogo", (c) => (h(c, 2).unidad = "PESOS", c), "H03", null],
  ["CLAVE_PROHIBIDA", "una cantidad en el hecho", (c) => (h(c, 2).cantidad = "7", c), "H03", null],
  ["CAMPO_FALTANTE", "falta la fuente", (c) => (delete h(c, 2).fuente, c), "H03", "fuente"],
  ["ID_NO_CONSECUTIVO", "un id que salta", (c) => (h(c, 2).id = "H04", c), "H03", "id"],
  ["ID_NO_CONSECUTIVO", "un id repetido", (c) => (h(c, 2).id = "H02", c), "H03", "id"],
  ["ID_NO_CONSECUTIVO", "un id sin dos dígitos", (c) => (h(c, 2).id = "H3", c), "H03", "id"],
  ["CLAVE_FUERA_DE_CATALOGO", "una clave de otro tipo", (c) => (h(c, 2).clave = "REGLA_NIVEL", c), "H03", "clave"],
  ["CLAVE_FUERA_DE_CATALOGO", "una clave del prototipo", (c) => (h(c, 2).clave = "constructor", c), "H03", "clave"],
  ["CLAVE_FUERA_DE_CATALOGO", "una clave que no es texto", (c) => (h(c, 2).clave = 7, c), "H03", "clave"],
  ["SUJETO_FALTANTE", "un hecho de especie sin sujeto", (c) => (delete h(c, 1).sujeto, c), "H02", "sujeto"],
  ["SUJETO_NO_PERMITIDO", "un hecho del portafolio con sujeto", (c) => (h(c, 2).sujeto = "H01", c), "H03", "sujeto"],
  ["SUJETO_INEXISTENTE", "un sujeto que no existe", (c) => (h(c, 1).sujeto = "H09", c), "H02", "sujeto"],
  ["SUJETO_INEXISTENTE", "un sujeto que es el mismo hecho", (c) => (h(c, 6).sujeto = "H07", c), "H07", "sujeto"],
  ["SUJETO_INEXISTENTE", "un sujeto mal formado", (c) => (h(c, 1).sujeto = "h01", c), "H02", "sujeto"],
  ["SUJETO_NO_ES_ESPECIE", "un sujeto que no es nombre de especie", (c) => (h(c, 6).sujeto = "H03", c), "H07", "sujeto"],
  ["VALOR_NO_DECIMAL", "un valor con formato es-CO", (c) => (h(c, 2).valor = "37.911,47", c), "H03", "valor"],
  ["VALOR_NO_DECIMAL", "un valor numérico", (c) => (h(c, 2).valor = 37911.47, c), "H03", "valor"],
  ["VALOR_NO_DECIMAL", "un valor con ceros sobrantes", (c) => (h(c, 2).valor = "37911.470", c), "H03", "valor"],
  ["VALOR_NO_FECHA", "una fecha que no existe", (c) => (h(c, 4).valor = "2027-02-30", c), "H05", "valor"],
  ["VALOR_NO_ENTERO", "un conteo con decimales", (c) => (h(c, 5).valor = "7.5", c), "H06", "valor"],
  ["VALOR_NEGATIVO", "un conteo negativo", (c) => (h(c, 5).valor = "-7", c), "H06", "valor"],
  ["NOMBRE_INVALIDO", "un nombre con doble espacio", (c) => (h(c, 0).valor = "FICTICIA  ALFA", c), "H01", "valor"],
  ["NOMBRE_INVALIDO", "un nombre que no es texto", (c) => (h(c, 0).valor = 7, c), "H01", "valor"],
  ["ESPECIE_REPETIDA", "la misma especie dos veces", (c) => ({ ...c, hechos: [...c.hechos, hecho("H08", "ESPECIE_NOMBRE", ESPECIE_ALFA.toLowerCase(), "x")] }), "H08", "valor"],
  ["PRESENTACION_INVALIDA", "una presentación vacía", (c) => (h(c, 2).presentacion = "", c), "H03", "presentacion"],
  ["PRESENTACION_INVALIDA", "una presentación sin cifra (sin dato)", (c) => (h(c, 2).presentacion = "—", c), "H03", "presentacion"],
  ["PRESENTACION_INVALIDA", "una presentación con espacio al borde", (c) => (h(c, 2).presentacion = " $ 37.911", c), "H03", "presentacion"],
  ["PRESENTACION_INVALIDA", "una presentación demasiado larga", (c) => (h(c, 2).presentacion = `$ ${"7".repeat(63)}`, c), "H03", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "una presentación que no sale del valor (un peso de más)", (c) => (h(c, 2).presentacion = "$ 37.912", c), "H03", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "una presentación con otro formato (con centavos)", (c) => (h(c, 2).presentacion = "$ 37.911,47", c), "H03", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "un porcentaje con «+»", (c) => (h(c, 6).presentacion = "+12,4 %", c), "H07", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "un conteo con su palabra", (c) => (h(c, 5).presentacion = "7 especies", c), "H06", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "un nombre que no es el valor", (c) => (h(c, 0).presentacion = "FICTICIA-BETA", c), "H01", "presentacion"],
  ["PRESENTACION_NO_COINCIDE", "una fecha con otro formato", (c) => (h(c, 4).presentacion = "16/03/2027", c), "H05", "presentacion"],
  ["FUENTE_INVALIDA", "una fuente vacía", (c) => (h(c, 2).fuente = "", c), "H03", "fuente"],
  ["FUENTE_INVALIDA", "una fuente con salto de línea", (c) => (h(c, 2).fuente = "fuente\nficticia", c), "H03", "fuente"],
  ["FECHA_INVALIDA", "una fecha sin ceros", (c) => (h(c, 2).fecha = "2027-3-16", c), "H03", "fecha"],
  ["FECHA_FUTURA", "una fecha después de hoy", (c) => (h(c, 2).fecha = "2027-03-18", c), "H03", "fecha"],
  ["CALIDAD_INVALIDA", "una calidad fuera de la lista", (c) => (h(c, 2).calidad = "BUENA", c), "H03", "calidad"],
  ["DIRECCION_INVALIDA", "una dirección fuera de la lista", (c) => (h(c, 2).direccion = "ARRIBA", c), "H03", "direccion"],
  ["CERCANIA_INVALIDA", "una cercanía fuera de la lista", (c) => (h(c, 2).cercania = "MEDIA", c), "H03", "cercania"],
  ["FRESCURA_INVALIDA", "una frescura fuera de la lista", (c) => (h(c, 2).frescura = "VIEJO", c), "H03", "frescura"],
  ["DIRECCION_NO_APLICA", "dirección en una clave que no la admite", (c) => (h(c, 4).direccion = "SUBE", c), "H05", "direccion"],
  ["CERCANIA_NO_APLICA", "cercanía en una clave que no la admite", (c) => (h(c, 2).cercania = "CERCA", c), "H03", "cercania"],
  ["OBLIGATORIO_INVALIDO", "obligatorio que no es booleano", (c) => (h(c, 2).obligatorio = "si", c), "H03", "obligatorio"],
  ["HECHO_REPETIDO", "la misma clave del portafolio dos veces", (c) => ({ ...c, hechos: [...c.hechos, hecho("H08", "VALOR_ACCIONES", "41377.19", "$ 41.377")] }), "H08", "clave"],
  ["HECHO_REPETIDO", "la misma clave de la misma especie dos veces", (c) => ({ ...c, hechos: [...c.hechos, hecho("H08", "VALOR_ESPECIE", "41377.19", "$ 41.377", { sujeto: "H01" })] }), "H08", "clave"],
];

/** Rechazos de leerPaquete (un paquete guardado que vuelve a entrar). */
const CASOS_LEER: readonly Caso[] = [
  ["FORMA_INVALIDA", "lo guardado no es un objeto", () => "paquete", null, null],
  ["CAMPO_FALTANTE", "lo guardado no trae el hash", (c) => ({ ...c, hash: undefined }), null, "hash"],
  ["VERSION_DISTINTA", "lo guardado es de otra versión del contrato", (c) => ({ ...c, version: "hechos-v2" }), null, "version"],
  ["GUARDADO_NO_COINCIDE", "la etiqueta guardada no es la del catálogo de hoy", (c) => (h(c, 2).etiqueta = "otra etiqueta", c), "H03", "etiqueta"],
  ["GUARDADO_NO_COINCIDE", "la unidad guardada no es la del catálogo de hoy", (c) => (h(c, 2).unidad = "DIAS", c), "H03", "unidad"],
  ["GUARDADO_NO_COINCIDE", "un valor cambiado con el hash viejo", (c) => (Object.assign(h(c, 2), { valor: "41377.19", presentacion: "$ 41.377" }), c), null, "hash"],
  ["PRESENTACION_NO_COINCIDE", "un valor cambiado sin su presentación", (c) => (h(c, 2).valor = "41377.19", c), "H03", "presentacion"],
  ["CAMPO_FALTANTE", "un hecho guardado sin etiqueta", (c) => (delete h(c, 2).etiqueta, c), "H03", "etiqueta"],
  ["FORMA_INVALIDA", "un hecho guardado que no es objeto", (c) => ({ ...c, hechos: [c.hechos[0], c.hechos[1], "H03"] }), "H03", null],
];

describe("construirPaquete · casos felices", () => {
  it.each(Object.keys(ENTRADAS_FICTICIAS) as (keyof typeof ENTRADAS_FICTICIAS)[])("arma el paquete %s con la etiqueta y la unidad del catálogo", (tipo) => {
    const entrada = ENTRADAS_FICTICIAS[tipo]();
    const paquete = construirPaquete(entrada);
    expect(paquete.version).toBe("hechos-v1");
    expect(paquete.tipo).toBe(tipo);
    expect(paquete.hoy).toBe(HOY_FICTICIO);
    expect(paquete.hechos).toHaveLength(entrada.hechos.length);
    paquete.hechos.forEach((hechoArmado, i) => {
      const catalogo = (CATALOGO[tipo] as Record<string, { etiqueta: string; unidad: string }>)[hechoArmado.clave];
      expect(hechoArmado.etiqueta).toBe(catalogo?.etiqueta);
      expect(hechoArmado.unidad).toBe(catalogo?.unidad);
      expect(hechoArmado.valor).toBe(entrada.hechos[i]?.valor);
      expect(hechoArmado.presentacion).toBe(entrada.hechos[i]?.presentacion);
    });
    expect(paquete.hash).toBe(hashPaquete(paquete));
  });

  it("congela todo el paquete en profundidad", () => {
    const paquete = construirPaquete(entradaDiario());
    expect(Object.isFrozen(paquete) && Object.isFrozen(paquete.hechos) && Object.isFrozen(paquete.avisos) && Object.isFrozen(paquete.versionesCalculo)).toBe(true);
    for (const h of paquete.hechos) expect(Object.isFrozen(h)).toBe(true);
  });

  it("no deja la clave sujeto cuando no viene, ni cuando viene como undefined", () => {
    const crudo = copia();
    h(crudo, 2).sujeto = undefined;
    const paquete = construir(crudo);
    expect(Object.hasOwn(paquete.hechos[2] as object, "sujeto")).toBe(false);
    expect(Object.hasOwn(paquete.hechos[3] as object, "sujeto")).toBe(false);
    expect(paquete.hechos[1]?.sujeto).toBe("H01");
  });

  it("copia campo por campo: cambiar la entrada después no cambia el paquete", () => {
    const entrada = copia();
    const paquete = construir(entrada);
    const hash = paquete.hash;
    h(entrada, 2).valor = "1";
    (entrada.avisos as string[]).push("OTRO");
    (entrada.versionesCalculo as Record<string, string>).tablero = "otro-v9";
    expect(paquete.hechos[2]?.valor).toBe("37911.47");
    expect(paquete.avisos).toEqual(["AVISO_FICTICIO"]);
    expect(paquete.versionesCalculo).toEqual({ tablero: "tablero-ficticio-v7" });
    expect(hashPaquete(paquete)).toBe(hash);
  });

  it("acepta una entrada sin prototipo y versiones de cálculo vacías", () => {
    const crudo = Object.assign(Object.create(null) as Crudo, copia(), { versionesCalculo: {} });
    expect(construir(crudo).versionesCalculo).toEqual({});
  });

  it("acepta noventa y nueve hechos", () => {
    expect(construir(conHechos(99)).hechos).toHaveLength(99);
  });
});

describe("construirPaquete · rechazos (cierra en fallo)", () => {
  it("las tablas de casos cubren cada código de error", () => {
    expect(new Set([...CASOS, ...CASOS_LEER].map(([codigo]) => codigo))).toEqual(new Set(CODIGOS_ERROR_PAQUETE));
  });

  it("dos hechos de la misma clave con especies distintas sí caben", () => {
    const crudo = copia();
    crudo.hechos.push(hecho("H08", "ESPECIE_NOMBRE", "FICTICIA-BETA", "FICTICIA-BETA"), hecho("H09", "VALOR_ESPECIE", "41377.19", "$ 41.377", { sujeto: "H08" }));
    expect(construir(crudo).hechos).toHaveLength(9);
  });

  it.each(CASOS)("%s: %s", (codigo, _descripcion, mutar, hechoEsperado, campoEsperado) => {
    const error = errorDe(mutar(copia()));
    expect(error.codigo).toBe(codigo);
    expect(error.hecho).toBe(hechoEsperado);
    expect(error.campo).toBe(campoEsperado);
    expect(error.name).toBe("ErrorPaquete");
  });

  it.each(CASOS)("el mensaje de %s (%s) no lleva datos: ni valores, ni nombres, ni claves recibidas", (_codigo, _descripcion, mutar) => {
    const { message } = errorDe(mutar(copia()));
    expect(message.replace(/H[0-9]{2}/g, "")).not.toMatch(/\p{N}/u);
    for (const dato of ["ficticia", "extra", "correo", "cantidad", "$", "%", "semanal", "buena", "arriba", "viejo"]) expect(message.toLowerCase()).not.toContain(dato);
  });
});

describe("idDeHecho", () => {
  it("numera de H01 a H99", () => {
    expect(idDeHecho(1)).toBe("H01");
    expect(idDeHecho(7)).toBe("H07");
    expect(idDeHecho(99)).toBe("H99");
  });

  it.each([0, 100, 1.5, -1, Number.NaN])("fuera de rango (%s): RangeError", (posicion) => {
    expect(() => idDeHecho(posicion)).toThrow(RangeError);
  });
});

describe("leerPaquete · un paquete guardado vuelve a entrar validado (TIPOS-ALTO-2)", () => {
  const guardado = (): Crudo => JSON.parse(JSON.stringify(construirPaquete(entradaDiario()))) as Crudo;

  function errorAlLeer(crudo: unknown): ErrorPaquete {
    try {
      leerPaquete(crudo);
    } catch (e) {
      if (e instanceof ErrorPaquete) return e;
      throw e;
    }
    throw new Error("leerPaquete no lanzó");
  }

  it("el JSON guardado vuelve igual, con el mismo hash, construido y con vista", () => {
    const original = construirPaquete(entradaDiario());
    const leido = leerPaquete(JSON.parse(JSON.stringify(original)));
    expect(leido).toEqual(original);
    expect(leido.hash).toBe(original.hash);
    expect(esPaqueteConstruido(leido)).toBe(true);
    expect(vistaCiega(leido)).toEqual(vistaCiega(original));
  });

  it.each(CASOS_LEER)("%s: %s", (codigo, _descripcion, mutar, hechoEsperado, campoEsperado) => {
    const error = errorAlLeer(mutar(guardado()));
    expect(error.codigo).toBe(codigo);
    expect(error.hecho).toBe(hechoEsperado);
    expect(error.campo).toBe(campoEsperado);
  });

  it("lo guardado con un hecho inválido se rechaza con el código de construirPaquete", () => {
    const crudo = guardado();
    h(crudo, 2).valor = "37.911,47";
    expect(errorAlLeer(crudo).codigo).toBe("VALOR_NO_DECIMAL");
  });
});

describe("construirPaquete · el ancla de cada regla (REGLA_DEL_PLAN): varias reglas por especie", () => {
  const base = (): Crudo => structuredClone(entradaReglasConAnclas()) as unknown as Crudo;
  const errorEn = (crudo: Crudo): ErrorPaquete => errorDe(crudo);

  it("arma un paquete con dos reglas de la misma especie y una de portafolio, cada una con su ancla", () => {
    const paquete = construir(base());
    const anclas = paquete.hechos.filter((x) => x.clave === CLAVE_ANCLA_REGLA);
    expect(anclas.map((x) => x.sujeto ?? null)).toEqual(["H01", "H01", null]);
    const niveles = paquete.hechos.filter((x) => x.clave === "REGLA_NIVEL");
    expect(niveles.map((x) => x.sujeto)).toEqual(["H02", "H05"]);
    expect(vistaCiega(paquete).hechos.find((x) => x.id === "H03")?.sujeto).toBe("H02");
  });

  it("sigue aceptando un hecho de regla que cita directo a la especie (compatibilidad de hechos-v1)", () => {
    expect(construir(structuredClone(ENTRADAS_FICTICIAS.REGLAS()) as unknown as Crudo).hechos[1]?.sujeto).toBe("H01");
  });

  it.each<readonly [string, (c: Crudo) => void, string]>([
    ["un ancla que cita a otra ancla", (c) => { h(c, 4).sujeto = "H02"; }, "H05"],
    ["un ancla que cita a un hecho de regla", (c) => { h(c, 4).sujeto = "H03"; }, "H05"],
    ["un dividendo que cita a un ancla", (c) => { h(c, 10).sujeto = "H02"; }, "H11"],
  ])("SUJETO_NO_ES_ESPECIE: %s", (_caso, mutar, hechoEsperado) => {
    const crudo = base();
    mutar(crudo);
    const error = errorEn(crudo);
    expect([error.codigo, error.hecho, error.campo]).toEqual(["SUJETO_NO_ES_ESPECIE", hechoEsperado, "sujeto"]);
  });

  it("HECHO_REPETIDO: dos niveles de la misma regla (la misma ancla)", () => {
    const crudo = base();
    h(crudo, 5).sujeto = "H02";
    const error = errorEn(crudo);
    expect([error.codigo, error.hecho, error.campo]).toEqual(["HECHO_REPETIDO", "H06", "clave"]);
  });

  it("el ancla no admite dirección ni cercanía, y su valor es un día", () => {
    const conDireccion = base();
    h(conDireccion, 1).direccion = "SUBE";
    expect(errorEn(conDireccion).codigo).toBe("DIRECCION_NO_APLICA");
    const conCercania = base();
    h(conCercania, 1).cercania = "CERCA";
    expect(errorEn(conCercania).codigo).toBe("CERCANIA_NO_APLICA");
    const conDecimal = base();
    Object.assign(h(conDecimal, 1), { valor: "37911.47", presentacion: "$ 37.911" });
    expect(errorEn(conDecimal).codigo).toBe("VALOR_NO_FECHA");
  });

  it("especieDe: el nombre de la especie de un hecho, siguiendo el ancla de su regla (dos saltos); null si no tiene", () => {
    const paquete = construir(base());
    const nombreDe = (id: string) => especieDe(paquete, id as never)?.valor ?? null;
    expect(["H01", "H02", "H03", "H04", "H06", "H07", "H11"].map(nombreDe)).toEqual(Array(7).fill("FICTICIA-BETA"));
    expect(["H08", "H09", "H10"].map(nombreDe)).toEqual([null, null, null]);
    expect(nombreDe("H12")).toBeNull();
    const diario = construir(copia());
    expect(especieDe(diario, "H02")?.id).toBe("H01");
    expect(especieDe(diario, "H03")).toBeNull();
  });

  it("especieDe solo acepta paquetes construidos", () => {
    expect(() => especieDe(structuredClone(construir(base())), "H03")).toThrow(/paquete construido/);
  });

  it("un ancla fuera de REGLAS es una clave fuera del catálogo", () => {
    const crudo = copia();
    crudo.hechos.push(hecho("H08", CLAVE_ANCLA_REGLA as never, "2027-02-03", "3-feb-2027"));
    expect(errorDe(crudo).codigo).toBe("CLAVE_FUERA_DE_CATALOGO");
  });
});
